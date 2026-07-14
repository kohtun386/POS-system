import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useApp } from '../../context/SupabaseAppContext';
import { purchaseLogsService, salesService } from '../../lib/services';
import { DEFAULT_CURRENCY } from '../../lib/constants';

export function SimpleProfitReport() {
  const { state } = useApp();
  const currentShop = state.currentShop;

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [revenue, setRevenue] = useState(0);
  const [purchases, setPurchases] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      // Calculate revenue from sales in the selected month
      const from = new Date(selectedYear, selectedMonth, 1);
      const to = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      const salesData = await salesService.getAll(currentShop.id);
      const monthSales = salesData.filter(s => {
        const d = new Date(s.timestamp);
        return d >= from && d <= to && s.status === 'completed';
      });
      const totalRevenue = monthSales.reduce((sum, s) => sum + s.total, 0);

      // Calculate purchases from purchase log in the same month
      const totalPurchases = await purchaseLogsService.getMonthlyTotal(currentShop.id, selectedYear, selectedMonth + 1);

      setRevenue(totalRevenue);
      setPurchases(totalPurchases);
    } catch (err) {
      console.error('Failed to load profit data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentShop, selectedMonth, selectedYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const profit = revenue - purchases;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';

  const monthOptions = () => {
    const opts: { label: string; month: number; year: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({
        label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
        month: d.getMonth(),
        year: d.getFullYear(),
      });
    }
    return opts;
  };

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="flex items-center space-x-4">
        <Calendar className="h-5 w-5 text-gray-400" />
        <select
          value={`${selectedYear}-${selectedMonth}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split('-').map(Number);
            setSelectedYear(y);
            setSelectedMonth(m);
          }}
          className="select min-w-[220px]"
        >
          {monthOptions().map(opt => (
            <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
            <div className="stat-card bg-gradient-to-br from-blue-500 to-blue-600">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Revenue</p>
                  <p className="text-2xl lg:text-3xl font-bold">{DEFAULT_CURRENCY} {revenue.toLocaleString()}</p>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl"><TrendingUp className="h-6 w-6 lg:h-8 lg:w-8" /></div>
              </div>
            </div>
            <div className="stat-card bg-gradient-to-br from-orange-500 to-orange-600">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Purchases</p>
                  <p className="text-2xl lg:text-3xl font-bold">{DEFAULT_CURRENCY} {purchases.toLocaleString()}</p>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl"><DollarSign className="h-6 w-6 lg:h-8 lg:w-8" /></div>
              </div>
            </div>
            <div className={`stat-card bg-gradient-to-br ${profit >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'}`}>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className={`${profit >= 0 ? 'text-green-100' : 'text-red-100'} text-sm font-medium`}>Profit</p>
                  <p className="text-2xl lg:text-3xl font-bold">{DEFAULT_CURRENCY} {profit.toLocaleString()}</p>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl">
                  {profit >= 0
                    ? <TrendingUp className="h-6 w-6 lg:h-8 lg:w-8" />
                    : <TrendingDown className="h-6 w-6 lg:h-8 lg:w-8" />}
                </div>
              </div>
            </div>
          </div>

          {/* Profit Formula Summary */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Profit Calculation</h3>
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="space-y-3 text-lg">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Revenue</span>
                  <span className="font-semibold">{DEFAULT_CURRENCY} {revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Purchases</span>
                  <span className="font-semibold text-orange-600">- {DEFAULT_CURRENCY} {purchases.toLocaleString()}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900">Net Profit</span>
                  <span className={`text-xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {DEFAULT_CURRENCY} {profit.toLocaleString()}
                  </span>
                </div>
                {revenue > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Profit Margin</span>
                    <span className="font-medium text-gray-700">{margin}%</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Formula: Revenue - Purchases = Profit. Purchases are recorded in Purchase Log (Growth+).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
