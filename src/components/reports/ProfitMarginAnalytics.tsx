import { useMemo } from 'react';
import { useApp } from '../../context/SupabaseAppContext';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface ProfitMarginAnalyticsProps {
  dateRange: string;
}

export function ProfitMarginAnalytics({ dateRange }: ProfitMarginAnalyticsProps) {
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

  // Per-product margin breakdown
  const productMargins = useMemo(() => {
    const productMap: Record<string, {
      name: string;
      revenue: number;
      cost: number;
      quantity: number;
      margin: number;
      marginPct: number;
    }> = {};

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const id = item.product.id;
        if (!productMap[id]) {
          productMap[id] = {
            name: item.product.name,
            revenue: 0,
            cost: 0,
            quantity: 0,
            margin: 0,
            marginPct: 0,
          };
        }
        productMap[id].revenue += item.subtotal;
        productMap[id].cost += (item.product.cost || 0) * item.quantity;
        productMap[id].quantity += item.quantity;
      });
    });

    return Object.values(productMap)
      .map((p) => ({
        ...p,
        margin: p.revenue - p.cost,
        marginPct: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.margin - a.margin);
  }, [filteredSales]);

  const totalRevenue = productMargins.reduce((sum, p) => sum + p.revenue, 0);
  const totalCOGS = productMargins.reduce((sum, p) => sum + p.cost, 0);
  const overallMargin = totalRevenue > 0 ? ((totalRevenue - totalCOGS) / totalRevenue) * 100 : 0;

  const chartData = productMargins.map((p) => ({
    name: p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name,
    margin: Number(p.marginPct.toFixed(1)),
  }));

  const getBarColor = (margin: number) => {
    if (margin >= 60) return '#059669';
    if (margin >= 40) return '#9a693a';
    if (margin >= 20) return '#f57323';
    return '#dc2626';
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-secondary-900 dark:text-secondary-100">
            Overall Margin
          </h3>
          <span className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
            {overallMargin.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-secondary-100 dark:bg-[#3d2d1f] rounded-full h-3">
          <div
            className="bg-primary-600 h-3 rounded-full transition-all"
            style={{ width: `${Math.min(overallMargin, 100)}%` }}
          />
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-secondary-900 dark:text-secondary-100 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-primary-600" />
            Margin by Product
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece5" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [`${value}%`, 'Margin']} />
              <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.margin)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table">
          <thead className="table-header">
            <tr>
              <th className="table-header-cell">Product</th>
              <th className="table-header-cell text-right">Qty Sold</th>
              <th className="table-header-cell text-right">Revenue</th>
              <th className="table-header-cell text-right">Cost</th>
              <th className="table-header-cell text-right">Margin</th>
              <th className="table-header-cell text-right">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {productMargins.map((product) => (
              <tr key={product.name} className="table-row">
                <td className="table-cell font-medium">{product.name}</td>
                <td className="table-cell text-right">{product.quantity}</td>
                <td className="table-cell text-right">
                  {product.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="table-cell text-right">
                  {product.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className={`table-cell text-right font-semibold ${product.margin >= 0 ? 'text-[#059669]' : 'text-danger-600'}`}>
                  {product.margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="table-cell text-right">
                  <span
                    className="badge"
                    style={{ backgroundColor: getBarColor(product.marginPct), color: '#fff' }}
                  >
                    {product.marginPct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
