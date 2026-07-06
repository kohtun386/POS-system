import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Package, TrendingDown, Filter } from 'lucide-react';
import { ConsumptionLog } from '../../types';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { consumptionLogService } from '../../lib/services';

export function ConsumptionReport() {
  const inventoryEnabled = useFeatureFlag('inventory');
  const [logs, setLogs] = useState<ConsumptionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedMaterial, setSelectedMaterial] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState('All');

  useEffect(() => {
    if (!inventoryEnabled) return;
    loadLogs();
  }, [inventoryEnabled, dateFrom, dateTo, loadLogs]);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);

      const allLogs = await consumptionLogService.getAll({ from, to });
      setLogs(allLogs);
    } catch (error) {
      console.error('Error loading consumption logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  if (!inventoryEnabled) {
    return (
      <div className="p-6 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-[#ad9e8a] mb-4" />
        <h2 className="text-lg font-semibold text-[#473b32] dark:text-[#f0ece5]">Inventory Tracking Disabled</h2>
        <p className="text-[#7d6b57] dark:text-[#c6bbab] mt-2">Enable the inventory_tracking feature flag to view consumption reports.</p>
      </div>
    );
  }

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesMaterial = selectedMaterial === 'All' || log.rawMaterialId === selectedMaterial;
    const matchesProduct = selectedProduct === 'All' || log.productId === selectedProduct;
    return matchesMaterial && matchesProduct;
  });

  // Compute summaries
  const totalConsumed = filteredLogs.reduce((sum, log) => sum + log.quantityConsumed, 0);
  const totalWastage = filteredLogs.reduce((sum, log) => sum + log.wastageAmount, 0);

  // Group by material
  const byMaterial = filteredLogs.reduce((acc, log) => {
    const key = log.rawMaterialId;
    if (!acc[key]) {
      acc[key] = {
        materialId: log.rawMaterialId,
        materialName: log.rawMaterialName,
        totalConsumed: 0,
        unit: log.unit,
        wastage: 0,
      };
    }
    acc[key].totalConsumed += log.quantityConsumed;
    acc[key].wastage += log.wastageAmount;
    return acc;
  }, {} as Record<string, { materialId: string; materialName: string; totalConsumed: number; unit: string; wastage: number }>);

  // Group by product
  const byProduct = filteredLogs.reduce((acc, log) => {
    const key = log.productId;
    if (!acc[key]) {
      acc[key] = {
        productId: log.productId,
        productName: log.productName,
        totalItems: 0,
      };
    }
    acc[key].totalItems++;
    return acc;
  }, {} as Record<string, { productId: string; productName: string; totalItems: number }>);

  const uniqueMaterials = [...new Set(logs.map(l => l.rawMaterialId))];
  const uniqueProducts = [...new Set(logs.map(l => l.productId))];

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-gray-50 dark:bg-[#1a0f08] min-h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold font-fraunces text-[#473b32] dark:text-[#f0ece5]">Consumption Report</h1>
        <p className="text-[#7d6b57] dark:text-[#c6bbab] mt-1">Track raw material consumption from sales</p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Filter className="h-4 w-4 text-[#ad9e8a]" />
          <span className="font-medium text-[#473b32] dark:text-[#f0ece5]">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-[#7d6b57] dark:text-[#c6bbab] mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input input-sm" />
          </div>
          <div>
            <label className="block text-xs text-[#7d6b57] dark:text-[#c6bbab] mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input input-sm" />
          </div>
          <div>
            <label className="block text-xs text-[#7d6b57] dark:text-[#c6bbab] mb-1">Material</label>
            <select value={selectedMaterial} onChange={e => setSelectedMaterial(e.target.value)} className="select select-sm">
              <option value="All">All Materials</option>
              {uniqueMaterials.map(id => {
                const log = logs.find(l => l.rawMaterialId === id);
                return <option key={id} value={id}>{log?.rawMaterialName}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#7d6b57] dark:text-[#c6bbab] mb-1">Product</label>
            <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="select select-sm">
              <option value="All">All Products</option>
              {uniqueProducts.map(id => {
                const log = logs.find(l => l.productId === id);
                return <option key={id} value={id}>{log?.productName}</option>;
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 text-[#ad9e8a]" />
            <span className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Total Entries</span>
          </div>
          <div className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5]">{filteredLogs.length}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center space-x-2">
            <TrendingDown className="h-4 w-4 text-[#ad9e8a]" />
            <span className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Total Consumed</span>
          </div>
          <div className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5]">{totalConsumed.toFixed(1)}</div>
        </div>
        <div className="stat-card stat-card-warning">
          <div className="flex items-center space-x-2">
            <TrendingDown className="h-4 w-4 text-[#d97706]" />
            <span className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Total Wastage</span>
          </div>
          <div className="text-2xl font-bold">{totalWastage.toFixed(1)}</div>
        </div>
      </div>

      {/* By Material Summary */}
      {Object.keys(byMaterial).length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-[#473b32] dark:text-[#f0ece5] mb-3">By Material</h3>
          <div className="space-y-2">
            {Object.values(byMaterial).sort((a, b) => b.totalConsumed - a.totalConsumed).map(mat => (
              <div key={mat.materialId} className="flex justify-between items-center p-2 bg-[#faf8f5] dark:bg-[#2a1a10] rounded-lg">
                <span className="font-medium text-[#473b32] dark:text-[#f0ece5]">{mat.materialName}</span>
                <div className="text-right">
                  <span className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">
                    {mat.totalConsumed.toFixed(1)} {mat.unit}
                  </span>
                  {mat.wastage > 0 && (
                    <span className="ml-2 text-xs text-[#d97706]">(+{mat.wastage.toFixed(1)} wastage)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Product Summary */}
      {Object.keys(byProduct).length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-[#473b32] dark:text-[#f0ece5] mb-3">By Product</h3>
          <div className="space-y-2">
            {Object.values(byProduct).sort((a, b) => b.totalItems - a.totalItems).map(prod => (
              <div key={prod.productId} className="flex justify-between items-center p-2 bg-[#faf8f5] dark:bg-[#2a1a10] rounded-lg">
                <span className="font-medium text-[#473b32] dark:text-[#f0ece5]">{prod.productName}</span>
                <span className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">{prod.totalItems} deductions</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Log Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#ded7cc] dark:border-[#54463b]">
          <h3 className="font-semibold text-[#473b32] dark:text-[#f0ece5]">Detailed Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr className="table-header">
                <th className="table-header-cell">Date</th>
                <th className="table-header-cell">Product</th>
                <th className="table-header-cell">Material</th>
                <th className="table-header-cell">Consumed</th>
                <th className="table-header-cell">Wastage</th>
                <th className="table-header-cell">Stock Before</th>
                <th className="table-header-cell">Stock After</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center py-8 text-[#ad9e8a]">Loading...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center py-8 text-[#ad9e8a]">No consumption data found</td>
                </tr>
              ) : (
                filteredLogs.slice(0, 100).map(log => (
                  <tr key={log.id} className="table-row">
                    <td className="table-cell text-sm text-[#7d6b57] dark:text-[#c6bbab]">
                      {new Date(log.consumedAt).toLocaleString()}
                    </td>
                    <td className="table-cell font-medium text-[#473b32] dark:text-[#f0ece5]">{log.productName}</td>
                    <td className="table-cell text-[#7d6b57] dark:text-[#c6bbab]">{log.rawMaterialName}</td>
                    <td className="table-cell">
                      {log.quantityConsumed.toFixed(1)} {log.unit}
                    </td>
                    <td className="table-cell">
                      {log.wastageAmount > 0 ? (
                        <span className="text-[#d97706]">{log.wastageAmount.toFixed(1)}</span>
                      ) : '—'}
                    </td>
                    <td className="table-cell text-[#7d6b57] dark:text-[#c6bbab]">{log.stockBefore.toFixed(1)}</td>
                    <td className="table-cell text-[#7d6b57] dark:text-[#c6bbab]">{log.stockAfter.toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredLogs.length > 100 && (
          <div className="p-3 text-center text-sm text-[#ad9e8a]">
            Showing first 100 of {filteredLogs.length} entries
          </div>
        )}
      </div>
    </div>
  );
}
