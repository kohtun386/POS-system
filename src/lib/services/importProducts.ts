import Papa from 'papaparse';
import { categoriesService } from './categories';
import { productsService } from './products';
import { supabase } from '../supabase';

export const REQUIRED_HEADERS = ['name', 'sku', 'price', 'category'] as const;

export type ImportRowStatus = 'valid' | 'error' | 'duplicate_shop_sku' | 'duplicate_in_batch';

export interface NormalizedRow {
  [key: string]: string | number | boolean | null;
  name: string;
  sku: string;
  price: number;
  category: string;
  cost: number | null;
  stock: number | null;
  minStock: number | null;
  taxable: boolean;
  active: boolean;
  isWeightBased: boolean;
  trackInventory: boolean;
  description: string | null;
  image: string | null;
  pricePerUnit: number | null;
  unit: string | null;
}

export interface ParsedCsv {
  headers: string[];
  normalizedRows: NormalizedRow[];
}

export interface RowError {
  line: number;
  field?: string;
  message: string;
}

export interface RowResult {
  line: number;
  status: 'created' | 'skipped' | 'failed';
  productId?: string;
  error?: string;
}

export interface ImportHooks {
  onProgress?: (current: number, total: number) => void;
}

export interface ImportResult {
  createdCategories: number;
  createdProducts: number;
  skippedProducts: number;
  failedProducts: number;
  rowResults: RowResult[];
}

export function parseCsv(fileContent: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase().replace(/[\s_]+/g, ''),
  });

  const headers = result.meta.fields || [];
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }
  if (result.data.length > 500) {
    throw new Error('CSV contains more than 500 rows. Split into smaller files.');
  }

  const normalizedRows = result.data.map((row, idx) => normalizeRow(row, idx + 2));
  return { headers, normalizedRows };
}

function normalizeRow(row: Record<string, string>, lineNumber: number): NormalizedRow {
  return {
    name: row.name ?? '',
    sku: row.sku ?? '',
    price: parseNumeric(row.price, 0),
    category: row.category ?? '',
    cost: row.cost !== '' ? parseNumeric(row.cost, 0) : null,
    stock: row.stock !== '' ? parseNumeric(row.stock, 0) : null,
    minStock: row.minstock !== '' ? parseNumeric(row.minstock, 0) : null,
    description: row.description || null,
    image: row.image || null,
    taxable: parseBool(row.taxable, true),
    active: parseBool(row.active, true),
    isWeightBased: parseBool(row.isweightbased, false),
    pricePerUnit: row.priceperunit !== '' ? parseNumeric(row.priceperunit, null) : null,
    unit: row.unit || null,
    trackInventory: parseBool(row.trackinventory, true),
  };
}

export function validateRow(row: NormalizedRow, lineNumber: number): RowError[] {
  const errors: RowError[] = [];
  if (!row.name) errors.push({ line: lineNumber, field: 'name', message: 'Name is required' });
  if (!row.sku) errors.push({ line: lineNumber, field: 'sku', message: 'SKU is required' });
  if (row.price === null || row.price === undefined || row.price < 0)
    errors.push({ line: lineNumber, field: 'price', message: 'Price must be >= 0' });
  if (!row.category) errors.push({ line: lineNumber, field: 'category', message: 'Category is required' });

  if (row.cost !== null && row.cost < 0)
    errors.push({ line: lineNumber, field: 'cost', message: 'Cost must be >= 0' });
  if (row.stock !== null && row.stock < 0)
    errors.push({ line: lineNumber, field: 'stock', message: 'Stock must be >= 0' });
  if (row.minStock !== null && row.minStock < 0)
    errors.push({ line: lineNumber, field: 'minStock', message: 'Min stock must be >= 0' });

  return errors;
}

export function checkInBatchDuplicates(rows: NormalizedRow[]): RowError[] {
  const skuMap = new Map<string, number[]>();
  const errors: RowError[] = [];

  rows.forEach((row, idx) => {
    if (!row.sku) return;
    const sku = row.sku.toLowerCase();
    const line = idx + 2;
    const list = skuMap.get(sku) ?? [];
    list.push(line);
    skuMap.set(sku, list);
  });

  for (const [, lines] of skuMap) {
    if (lines.length > 1) {
      for (const line of lines) {
        errors.push({
          line,
          field: 'sku',
          message: `Duplicate SKU in file — also on line(s) ${lines.filter((l) => l !== line).join(', ')}`,
        });
      }
    }
  }

  return errors;
}

export async function checkShopSkus(rows: NormalizedRow[], shopId: string): Promise<RowError[]> {
  const skuSet = new Set(rows.map((r) => r.sku.toLowerCase()).filter(Boolean));
  if (skuSet.size === 0) return [];

  const { data, error } = await supabase
    .from('products')
    .select('sku')
    .eq('shop_id', shopId)
    .in('sku', [...skuSet]);

  if (error) throw error;

  const existingSkus = new Set((data ?? []).map((d) => d.sku.toLowerCase()));
  const errors: RowError[] = [];

  rows.forEach((row, idx) => {
    if (existingSkus.has(row.sku.toLowerCase())) {
      errors.push({
        line: idx + 2,
        field: 'sku',
        message: `SKU "${row.sku}" already exists in this shop`,
      });
    }
  });

  return errors;
}

export async function mapCategories(
  rows: NormalizedRow[],
  shopId: string
): Promise<Map<string, { id: string; name: string; willCreate: boolean }>> {
  const allCategories = await categoriesService.getAll(shopId);
  const catMap = new Map<string, { id: string; name: string; willCreate: boolean }>();
  const uniqueNames = [...new Set(rows.map((r) => r.category).filter(Boolean))];

  for (const name of uniqueNames) {
    const trimmed = name.trim();
    const existing = allCategories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      catMap.set(trimmed.toLowerCase(), { id: existing.id, name: existing.name, willCreate: false });
    } else {
      catMap.set(trimmed.toLowerCase(), { id: '', name: trimmed, willCreate: true });
    }
  }

  return catMap;
}

export async function importProducts(
  validRows: NormalizedRow[],
  categoryMap: Map<string, { id: string; name: string; willCreate: boolean }>,
  shopId: string,
  hooks?: ImportHooks
): Promise<ImportResult> {
  const rowResults: RowResult[] = [];
  let createdCategories = 0;
  let createdProducts = 0;
  let skippedProducts = 0;
  let failedProducts = 0;

  // Create missing categories first
  for (const [key, entry] of categoryMap.entries()) {
    if (!entry.willCreate) continue;
    try {
      const cat = await categoriesService.create(shopId, { name: entry.name });
      categoryMap.set(key, { id: cat.id, name: cat.name, willCreate: false });
      createdCategories++;
    } catch (err) {
      // Race-condition fallback: category may have been created by another request
      if (err instanceof Error && err.message.includes('already exists')) {
        const all = await categoriesService.getAll(shopId);
        const existing = all.find((c) => c.name.toLowerCase() === entry.name.toLowerCase());
        if (existing) {
          categoryMap.set(key, { id: existing.id, name: existing.name, willCreate: false });
        } else {
          // If we still can't find it, fail rows that depend on this category
          for (let i = 0; i < validRows.length; i++) {
            if (validRows[i].category.toLowerCase() === entry.name.toLowerCase()) {
              rowResults.push({ line: i + 2, status: 'failed', error: `Failed to create category "${entry.name}"` });
              failedProducts++;
            }
          }
          continue;
        }
      } else {
        throw err;
      }
    }
  }

  // Import products sequentially
  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    const line = i + 2;
    hooks?.onProgress?.(i + 1, validRows.length);

    const catEntry = categoryMap.get(row.category.toLowerCase());
    if (!catEntry || !catEntry.id) {
      rowResults.push({ line, status: 'failed', error: `Category "${row.category}" not found` });
      failedProducts++;
      continue;
    }

    try {
      const product = await productsService.create({
        name: row.name,
        sku: row.sku,
        price: row.price,
        cost: row.cost ?? 0,
        stock: row.stock ?? 0,
        minStock: row.minStock ?? 0,
        category: catEntry.name,
        description: row.description ?? undefined,
        image: row.image ?? undefined,
        taxable: row.taxable,
        active: row.active,
        isWeightBased: row.isWeightBased,
        pricePerUnit: row.pricePerUnit ?? undefined,
        unit: row.unit ?? undefined,
        trackInventory: row.trackInventory,
      });

      rowResults.push({ line, status: 'created', productId: product.id });
      createdProducts++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      rowResults.push({ line, status: 'failed', error: message });
      failedProducts++;
    }
  }

  return { createdCategories, createdProducts, skippedProducts, failedProducts, rowResults };
}

function parseNumeric(val: string | undefined, fallback: number | null): number {
  if (val === undefined || val === '') return fallback ?? 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback ?? 0;
}

function parseBool(val: string | undefined, fallback: boolean): boolean {
  if (val === undefined || val === '') return fallback;
  const v = val.toLowerCase();
  if (['true', '1', 'yes'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  return fallback;
}
