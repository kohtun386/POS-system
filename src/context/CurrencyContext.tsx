import React, { createContext, useContext, ReactNode } from 'react';

// MMK-only configuration (Myanmar market scope)
const MMK_CONFIG = {
  code: 'MMK',
  name: 'Myanmar Kyat',
  symbol: 'K',
  symbolPosition: 'before' as const,
  decimalPlaces: 0,
};

// Currency context interface — MMK-only, no multi-currency
interface CurrencyContextType {
  state: {
    baseCurrency: typeof MMK_CONFIG;
    displayCurrency: string;
  };
  formatAmount: (amount: number, currency?: string) => string;
  getCurrencyByCode: (code: string) => typeof MMK_CONFIG | null;
}

// Create context
const CurrencyContext = createContext<CurrencyContextType | null>(null);

// Currency provider component — hardcoded to MMK
interface CurrencyProviderProps {
  children: ReactNode;
  initialDisplayCurrency?: string;
}

export function CurrencyProvider({ children, initialDisplayCurrency = 'MMK' }: CurrencyProviderProps) {
  // Format amount in MMK (K symbol, no decimals)
  const formatAmount = (amount: number, _currency?: string): string => {
    const formatted = Math.round(amount).toLocaleString();
    return `${MMK_CONFIG.symbol}${formatted}`;
  };

  // Get currency config — always returns MMK
  const getCurrencyByCode = (code: string): typeof MMK_CONFIG | null => {
    if (code === 'MMK') return MMK_CONFIG;
    return null;
  };

  const contextValue: CurrencyContextType = {
    state: {
      baseCurrency: MMK_CONFIG,
      displayCurrency: initialDisplayCurrency,
    },
    formatAmount,
    getCurrencyByCode,
  };

  return (
    <CurrencyContext.Provider value={contextValue}>
      {children}
    </CurrencyContext.Provider>
  );
}

// Hook to use currency context
export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

// Hook for currency formatting
export function useCurrencyFormat() {
  const { formatAmount, state } = useCurrency();

  const format = (amount: number, _currency?: string) => {
    return formatAmount(amount, state.displayCurrency);
  };

  return { format, displayCurrency: state.displayCurrency };
}

// Export types
export type { CurrencyContextType };
