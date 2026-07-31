import { useApp } from './useApp';
import { generateNextInvoiceNumber } from '../lib/invoiceUtils';

export function useInvoiceGeneration() {
  const { state } = useApp();

  return async () => {
    const { invoiceNumber } = generateNextInvoiceNumber(state.settings);
    return invoiceNumber;
  };
}

export function useInvoiceStats() {
  const { state } = useApp();

  return () => {
    const totalInvoices = state.sales.length;
    const currentCounter = state.settings.invoiceCounter;
    const prefix = state.settings.invoicePrefix;
    const { invoiceNumber: nextInvoiceNumber } = generateNextInvoiceNumber(state.settings);

    return {
      totalInvoices,
      currentCounter,
      prefix,
      nextInvoiceNumber,
    };
  };
}
