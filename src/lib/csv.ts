import { Product } from '../types';
import Papa from 'papaparse';

export const UTF8_BOM = '\uFEFF';

export const EXPORT_COLUMNS: (keyof Product)[] = [
  'name',
  'sku',
  'price',
  'cost',
  'stock',
  'minStock',
  'category',
  'description',
  'taxable',
  'active',
  'isWeightBased',
  'pricePerUnit',
  'unit',
  'image',
  'trackInventory',
];

function toCsvRow(product: Product) {
  const row: Record<string, unknown> = {};
  for (const col of EXPORT_COLUMNS) {
    row[col] = product[col] ?? '';
  }
  return row;
}

export function exportProductCsv(products: Product[]) {
  const data = products.map(toCsvRow);
  const csv = Papa.unparse({ fields: EXPORT_COLUMNS, data });
  const blob = new Blob([UTF8_BOM + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `products-${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
