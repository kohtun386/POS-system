import { describe, it, expect } from 'vitest';
import { buildDailyReportBody } from '../../dailyReport';
import type { Sale, CartItem } from '../../../types';

const item = (product: { id: string; name: string }, subtotal: number): CartItem => ({
  product: product as never,
  quantity: 1,
  discount: 0,
  discountType: 'fixed',
  subtotal,
});

const sale = (partial: Partial<Sale> & { timestamp: Date }): Sale => ({
  id: 's1',
  shopId: 'shop1',
  invoiceNumber: 'INV-1',
  items: [],
  paymentMethod: 'cash',
  status: 'completed',
  cashier: 'test',
  ...partial,
});

describe('buildDailyReportBody', () => {
  it('sums only today\'s sales and lists top products by revenue', () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const sales = [
      sale({
        timestamp: today,
        total: 5000,
        items: [
          item({ id: 'p1', name: 'Latte' }, 4000),
          item({ id: 'p2', name: 'Espresso' }, 1000),
        ],
      }),
      // yesterday — must be excluded
      sale({ timestamp: yesterday, total: 99999, items: [] }),
    ];

    const body = buildDailyReportBody(sales);

    expect(body).toContain('Revenue: 5000.00');
    expect(body).toContain('Transactions: 1');
    expect(body).toContain('Latte');
    expect(body).not.toContain('99999');
    // Espresso (1000) sorts below Latte (4000) and is cut off at top-5 — but it's within 5, so included
    expect(body).toContain('Espresso');
  });
});
