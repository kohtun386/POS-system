// Currency utilities — MMK-only (Myanmar market scope)
// Multi-currency support removed. App operates exclusively in MMK.

// Currency configuration interface
export interface CurrencyConfig {
    id: string;
    code: string;
    name: string;
    symbol: string;
    symbolPosition: 'before' | 'after';
    decimalPlaces: number;
    isActive: boolean;
    isBaseCurrency: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// MMK configuration (hardcoded for Myanmar market)
const MMK_CONFIG: CurrencyConfig = {
    id: 'mmk-default',
    code: 'MMK',
    name: 'Myanmar Kyat',
    symbol: 'K',
    symbolPosition: 'before',
    decimalPlaces: 0,
    isActive: true,
    isBaseCurrency: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

// Currency utilities class — MMK-only
export class CurrencyUtils {
    // Get base currency — always returns MMK
    static async getBaseCurrency(): Promise<CurrencyConfig> {
        return MMK_CONFIG;
    }

    // Format currency amount — MMK formatting (K symbol, no decimals)
    static formatCurrency(amount: number, _currencyCode: string = 'MMK'): string {
        const formatted = Math.round(amount).toLocaleString();
        return `${MMK_CONFIG.symbol}${formatted}`;
    }

    // Get currency by code — returns MMK config or null
    static getCurrencyByCode(currencyCode: string): CurrencyConfig | null {
        if (currencyCode === 'MMK') return MMK_CONFIG;
        return null;
    }

    // Validate currency code — only MMK is valid
    static isValidCurrency(currencyCode: string): boolean {
        return currencyCode === 'MMK';
    }

    // Get currency symbol — always returns 'K'
    static getCurrencySymbol(_currencyCode: string = 'MMK'): string {
        return MMK_CONFIG.symbol;
    }
}

// Export utility functions for easier usage
export const {
    getBaseCurrency,
    formatCurrency,
    getCurrencyByCode,
    isValidCurrency,
    getCurrencySymbol,
} = CurrencyUtils;
