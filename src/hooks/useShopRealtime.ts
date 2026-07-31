import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Product, Sale, CartItem, Payment, AppliedDiscount } from '../types';
import type { AppAction } from '../context/reducers/types';

/**
 * Maps a raw Supabase products row (snake_case) to the frontend Product type (camelCase).
 */
function mapProductRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    sku: row.sku as string,
    barcode: (row.barcode as string) || undefined,
    price: row.price as number,
    cost: (row.cost as number) || 0,
    stock: (row.stock as number) || 0,
    minStock: (row.min_stock as number) || 0,
    category: row.category as string,
    description: (row.description as string) || '',
    image: (row.image as string) || undefined,
    taxable: (row.taxable as boolean) ?? true,
    active: (row.active as boolean) ?? true,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    isWeightBased: (row.is_weight_based as boolean) ?? false,
    pricePerUnit: (row.price_per_unit as number) || undefined,
    unit: (row.unit as string) || undefined,
    trackInventory: (row.track_inventory as boolean) ?? false,
  };
}

/**
 * Maps a raw Supabase sales row (snake_case) to the frontend Sale type (camelCase).
 */
function mapSaleRow(row: Record<string, unknown>): Sale {
  return {
    id: row.id as string,
    invoiceNumber: row.invoice_number as string,
    customerId: (row.customer_id as string) || undefined,
    customerName: (row.customer_name as string) || undefined,
    items: parseJsonField<CartItem[]>(row.items, []),
    subtotal: row.subtotal as number,
    discountAmount: (row.discount_amount as number) || 0,
    taxAmount: (row.tax_amount as number) || 0,
    total: row.total as number,
    paymentMethod: (row.payment_method as Sale['paymentMethod']) || 'cash',
    payments: parseJsonField<Payment[] | undefined>(row.payments, undefined),
    cardDetails: parseJsonField(row.card_details, undefined),
    status: (row.status as Sale['status']) || 'completed',
    cashier: (row.cashier as string) || '',
    cashierId: (row.cashier_id as string) || undefined,
    cashierRole: (row.cashier_role as Sale['cashierRole']) || undefined,
    timestamp: new Date(row.created_at as string),
    receiptNumber: (row.receipt_number as string) || '',
    receiptPrinted: undefined,
    notes: (row.notes as string) || undefined,
    appliedDiscounts: parseJsonField<AppliedDiscount[] | undefined>(row.applied_discounts, undefined),
    freeGifts: parseJsonField<CartItem[] | undefined>(row.free_gifts, undefined),
  };
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

interface UseShopRealtimeOptions {
  activeShopId: string;
  dispatch: React.Dispatch<AppAction>;
}

/**
 * Subscribes to Supabase Realtime for products (UPDATE) and sales (INSERT)
 * scoped to the active shop. Cleans up subscriptions on unmount or shop change.
 *
 * Graceful degradation: logs warnings on failure, never throws (PRD §4.2).
 */
export function useShopRealtime({ activeShopId, dispatch }: UseShopRealtimeOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!activeShopId) return;

    const productsChannel = supabase
      .channel(`realtime:products:${activeShopId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `shop_id=eq.${activeShopId}`,
        },
        (payload) => {
          try {
            const product = mapProductRow(payload.new as Record<string, unknown>);
            dispatch({ type: 'UPDATE_PRODUCT', payload: product });
          } catch (err) {
            console.warn('[Realtime] Failed to map product update:', err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Products channel error — falling back to manual refresh');
        }
      });

    const salesChannel = supabase
      .channel(`realtime:sales:${activeShopId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales',
          filter: `shop_id=eq.${activeShopId}`,
        },
        (payload) => {
          try {
            const sale = mapSaleRow(payload.new as Record<string, unknown>);
            dispatch({ type: 'ADD_SALE', payload: sale });
          } catch (err) {
            console.warn('[Realtime] Failed to map sale insert:', err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Sales channel error — falling back to manual refresh');
        }
      });

    channelRef.current = productsChannel;

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(salesChannel);
      channelRef.current = null;
    };
  }, [activeShopId, dispatch]);
}
