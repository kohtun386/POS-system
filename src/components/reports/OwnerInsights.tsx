import { useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../../context/SupabaseAppContext';
import { subDays, startOfDay, endOfDay } from 'date-fns';

interface OwnerInsightsProps {
  dateRange: string;
}

export function OwnerInsights({ dateRange }: OwnerInsightsProps) {
  const { state } = useApp();

  const endDate = useMemo(() => new Date(), []);
  const startDate = useMemo(
    () => subDays(endDate, parseInt(dateRange) || 7),
    [endDate, dateRange],
  );

  const filteredSales = state.sales.filter((sale) => {
    const saleDate = new Date(sale.timestamp);
    return saleDate >= startOfDay(startDate) && saleDate <= endOfDay(endDate);
  });

  // Revenue = total of all sales
  const totalRevenue = useMemo(
    () => filteredSales.reduce((sum, sale) => sum + sale.total, 0),
    [filteredSales],
  );

  // COGS = cost of goods sold (sum of product cost * quantity)
  const totalCOGS = useMemo(
    () =>
      filteredSales.reduce((sum, sale) => {
        return (
          sum +
          sale.items.reduce((itemSum, item) => {
            const cost = item.product.cost || 0;
            return itemSum + cost * item.quantity;
          }, 0)
        );
      }, 0),
    [filteredSales],
  );

  const totalProfit = totalRevenue - totalCOGS;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const totalTransactions = filteredSales.length;
  const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  return (
    <div className="space-y-6">
      {/* 3 key numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Revenue</span>
            <DollarSign className="h-5 w-5 text-[#9a693a]" />
          </div>
          <div className="text-3xl font-bold text-[#473b32] dark:text-[#f0ece5]">
            {totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#a8978a] dark:text-[#8a7d70] mt-1">
            {totalTransactions} transactions
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">COGS</span>
            <TrendingDown className="h-5 w-5 text-[#e55c13]" />
          </div>
          <div className="text-3xl font-bold text-[#473b32] dark:text-[#f0ece5]">
            {totalCOGS.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#a8978a] dark:text-[#8a7d70] mt-1">
            Cost of goods sold
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Profit</span>
            <TrendingUp className="h-5 w-5 text-[#059669]" />
          </div>
          <div className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'}`}>
            {totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#a8978a] dark:text-[#8a7d70] mt-1">
            {profitMargin.toFixed(1)}% margin
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="card p-5">
        <h3 className="font-semibold text-[#473b32] dark:text-[#f0ece5] mb-4">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Avg Order Value</div>
            <div className="text-lg font-bold text-[#473b32] dark:text-[#f0ece5]">
              {avgOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Total Transactions</div>
            <div className="text-lg font-bold text-[#473b32] dark:text-[#f0ece5]">
              {totalTransactions}
            </div>
          </div>
          <div>
            <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Profit Margin</div>
            <div className="text-lg font-bold text-[#473b32] dark:text-[#f0ece5]">
              {profitMargin.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">COGS Ratio</div>
            <div className="text-lg font-bold text-[#473b32] dark:text-[#f0ece5]">
              {totalRevenue > 0 ? ((totalCOGS / totalRevenue) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
