import type { AppSettings } from '../types';
import type { AppAction } from '../context/reducers/types';

export function getNextInvoiceNumber(settings: AppSettings): string {
  const nextCounter = settings.invoiceCounter + 1;
  return `${settings.invoicePrefix}-${nextCounter.toString().padStart(6, '0')}`;
}

export function generateNextInvoiceNumber(settings: AppSettings): { invoiceNumber: string; newCounter: number } {
  const newCounter = settings.invoiceCounter + 1;
  const invoiceNumber = `${settings.invoicePrefix}-${newCounter.toString().padStart(6, '0')}`;
  return { invoiceNumber, newCounter };
}

export function resetInvoiceCounter(dispatch: React.Dispatch<AppAction>, newCounter: number = 0) {
  dispatch({ type: 'INCREMENT_INVOICE_COUNTER', payload: newCounter });
}

export function setInvoicePrefix(dispatch: React.Dispatch<AppAction>, prefix: string) {
  dispatch({ type: 'SET_SETTINGS', payload: { invoicePrefix: prefix } });
}
