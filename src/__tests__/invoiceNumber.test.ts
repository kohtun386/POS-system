import { describe, it, expect } from 'vitest';
import { getNextInvoiceNumber, generateNextInvoiceNumber } from '../context/SupabaseAppContext';
import { AppSettings } from '../types';

// Helper to create minimal AppSettings for testing
function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    storeName: 'Test Coffee',
    storeAddress: '123 Main St',
    storePhone: '555-0100',
    storeEmail: 'test@coffee.com',
    taxRate: 0.1,
    currency: 'USD',
    baseCurrency: 'USD',
    interfaceMode: 'touch',
    autoBackup: true,
    receiptPrinter: true,
    theme: 'light',
    invoicePrefix: 'INV',
    invoiceCounter: 1000,
    ...overrides,
  };
}

describe('getNextInvoiceNumber', () => {
  it('increments the counter by 1', () => {
    const settings = makeSettings({ invoiceCounter: 1000 });
    const result = getNextInvoiceNumber(settings);
    expect(result).toBe('INV-001001');
  });

  it('pads the counter to 6 digits', () => {
    const settings = makeSettings({ invoiceCounter: 5 });
    const result = getNextInvoiceNumber(settings);
    expect(result).toBe('INV-000006');
  });

  it('uses the configured prefix', () => {
    const settings = makeSettings({ invoicePrefix: 'ORD', invoiceCounter: 99 });
    const result = getNextInvoiceNumber(settings);
    expect(result).toBe('ORD-000100');
  });
});

describe('generateNextInvoiceNumber', () => {
  it('returns both the invoice number and new counter', () => {
    const settings = makeSettings({ invoiceCounter: 42 });
    const result = generateNextInvoiceNumber(settings);

    expect(result.invoiceNumber).toBe('INV-000043');
    expect(result.newCounter).toBe(43);
  });

  it('does not mutate the original settings', () => {
    const settings = makeSettings({ invoiceCounter: 100 });
    generateNextInvoiceNumber(settings);
    expect(settings.invoiceCounter).toBe(100);
  });
});
