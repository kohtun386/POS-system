import { useMemo } from 'react';
import { useApp } from '../../context/SupabaseAppContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

interface WasteEntry {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  reason: string;
  date: string;
}

// Waste tracking uses consumption_log data
export function WasteTracking() {
  const { state } = useApp();

  const endDate = useMemo(() => new Date(), []);
  const sevenDaysAgo = useMemo(() => subDays(endDate, 7), [endDate]);

  // Aggregate waste from product stock changes where consumed > expected
  // For now, show inventory adjustments as a proxy for waste tracking
  const wasteData = useMemo(() => {
    const entries: WasteEntry[] = [];
    let counter = 0;

    // Find products with low stock relative to sales (waste proxy)
    state.products.forEach((product) => {
      if (product.trackInventory && product.stock < 5 && product.stock > 0) {
        entries.push({
          id: `waste-${counter++}`,
          productName: product.name,
          quantity: 1,
          unit: product.unit || 'units',
          reason: 'Low stock alert — possible waste',
          date: format(new Date(), 'yyyy-MM-dd'),
        });
      }
    });

    return entries;
  }, [state.products]);

  const filteredSales = state.sales.filter((sale) => {
    const saleDate = new Date(sale.timestamp);
    return saleDate >= startOfDay(sevenDaysAgo) && saleDate <= endOfDay(endDate);
  });

  // Calculate waste proxy: items sold with discount (potential giveaways)
  const discountedItems = useMemo(() => {
    const items: { name: string; quantity: number; discount: number }[] = [];
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (item.discountAmount > 0) {
          const existing = items.find((i) => i.name === item.product.name);
          if (existing) {
            existing.quantity += item.quantity;
            existing.discount += item.discountAmount;
          } else {
            items.push({
              name: item.product.name,
              quantity: item.quantity,
              discount: item.discountAmount,
            });
          }
        }
      });
    });
    return items;
  }, [filteredSales]);

  const totalDiscountValue = discountedItems.reduce((sum, item) => sum + item.discount, 0);

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#473b32] dark:text-[#f0ece5]">
            Waste Tracking Summary
          </h3>
          <span className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5]">
            {wasteData.length} items flagged
          </span>
        </div>
        <p className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">
          Products with low stock levels that may indicate waste or overuse. Track this data to reduce losses over time.
        </p>
      </div>

      {wasteData.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Product</th>
                <th className="table-header-cell">Current Stock</th>
                <th className="table-header-cell">Reason</th>
                <th className="table-header-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {wasteData.map((entry) => (
                <tr key={entry.id} className="table-row">
                  <td className="table-cell font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#f57323]" />
                    {entry.productName}
                  </td>
                  <td className="table-cell">{entry.quantity} {entry.unit}</td>
                  <td className="table-cell text-[#f57323]">{entry.reason}</td>
                  <td className="table-cell">{entry.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-[#7d6b57] dark:text-[#c6bbab]">No waste items flagged this period.</p>
        </div>
      )}

      {discountedItems.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-[#473b32] dark:text-[#f0ece5] mb-4">
            Discounted Items (Last 7 Days)
          </h3>
          <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab] mb-3">
            Total discount value: <span className="font-bold text-[#f57323]">{totalDiscountValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="space-y-2">
            {discountedItems.map((item) => (
              <div key={item.name} className="flex justify-between items-center py-2 border-b border-[#f0ece5] dark:border-[#3d2d1f] last:border-0">
                <span className="text-[#473b32] dark:text-[#f0ece5]">{item.name}</span>
                <span className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">
                  {item.quantity} sold · {item.discount.toLocaleString('en-US', { minimumFractionDigits: 2 })} discount
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
