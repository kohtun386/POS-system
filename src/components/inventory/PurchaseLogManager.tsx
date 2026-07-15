import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, ShoppingCart, Calendar, TrendingUp, Filter } from 'lucide-react';
import { PurchaseLog } from '../../types';
import { purchaseLogsService } from '../../lib/services';
import { useApp, useCapability } from '../../context/SupabaseAppContext';
import { DEFAULT_CURRENCY } from '../../lib/constants';
import { PurchaseLogModal } from './PurchaseLogModal';
import { swalConfig } from '../../lib/sweetAlert';
import { UpgradePrompt } from '../ui/UpgradePrompt';

export function PurchaseLogManager() {
  const { state } = useApp();
  const canPurchaseLog = useCapability('purchase_log');
  const currentShop = state.shop;

  const [purchases, setPurchases] = useState<PurchaseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PurchaseLog | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Date range filter — default to current month
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const loadPurchases = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const from = new Date(filterYear, filterMonth, 1);
      const to = new Date(filterYear, filterMonth + 1, 0);
      const data = await purchaseLogsService.getAll(currentShop.id, from, to);
      setPurchases(data);
    } catch (err) {
      console.error('Failed to load purchases:', err);
      swalConfig.error('Failed to load purchase data.');
    } finally {
      setLoading(false);
    }
  }, [currentShop, filterMonth, filterYear]);

  useEffect(() => { loadPurchases(); }, [loadPurchases]);

  const filteredPurchases = purchases.filter(p =>
    p.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCost = purchases.reduce((sum, p) => sum + p.totalCost, 0);

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

  const handleEdit = (entry: PurchaseLog) => {
    setEditingEntry(entry);
    setShowModal(true);
  };

  const handleDelete = async (id: string, itemName: string) => {
    const result = await swalConfig.deleteConfirm(`purchase of "${itemName}"`);
    if (result.isConfirmed) {
      try {
        swalConfig.loading('Deleting purchase...');
        await purchaseLogsService.delete(id);
        swalConfig.success('Purchase deleted.');
        loadPurchases();
      } catch (err) {
        console.error('Delete error:', err);
        swalConfig.error('Failed to delete purchase.');
      }
    }
  };

  if (!canPurchaseLog) {
    return (
      <div className="p-4 lg:p-6 space-y-6 bg-gray-50 min-h-full">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <ShoppingCart className="h-16 w-16 text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-900">Purchase Log</h2>
          <p className="text-gray-500 max-w-md">This feature is available on Growth tier and above.</p>
          <UpgradePrompt feature="Purchase Log" tier="growth" onClose={() => setShowUpgrade(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-gray-50 min-h-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Purchase Log</h1>
          <p className="text-gray-600 mt-1">Record supplier purchases and stock intake</p>
        </div>
        <button onClick={() => { setEditingEntry(null); setShowModal(true); }} className="btn btn-primary">
          <Plus className="h-5 w-5" />
          <span>Record Purchase</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="stat-card bg-gradient-to-br from-blue-500 to-blue-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Purchases</p>
              <p className="text-2xl lg:text-3xl font-bold">{purchases.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl">
              <ShoppingCart className="h-6 w-6 lg:h-8 lg:w-8" />
            </div>
          </div>
        </div>
        <div className="stat-card bg-gradient-to-br from-green-500 to-green-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-green-100 text-sm font-medium">Total Cost ({DEFAULT_CURRENCY})</p>
              <p className="text-xl lg:text-2xl font-bold">{totalCost.toLocaleString()}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl">
              <TrendingUp className="h-6 w-6 lg:h-8 lg:w-8" />
            </div>
          </div>
        </div>
        <div className="stat-card bg-gradient-to-br from-purple-500 to-purple-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-purple-100 text-sm font-medium">Unique Items</p>
              <p className="text-2xl lg:text-3xl font-bold">{new Set(purchases.map(p => p.item)).size}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl">
              <Filter className="h-6 w-6 lg:h-8 lg:w-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0 gap-4">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1 w-full lg:w-auto">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search by item or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <select
                value={`${filterYear}-${filterMonth}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split('-').map(Number);
                  setFilterYear(y);
                  setFilterMonth(m);
                }}
                className="select pl-10 min-w-[200px]"
              >
                {monthOptions().map(opt => (
                  <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredPurchases.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>No purchases recorded for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Date</th>
                  <th className="table-header-cell">Item</th>
                  <th className="table-header-cell">Supplier</th>
                  <th className="table-header-cell text-right">Quantity</th>
                  <th className="table-header-cell text-right">Unit Cost</th>
                  <th className="table-header-cell text-right">Total Cost</th>
                  <th className="table-header-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="table-row">
                    <td className="table-cell text-sm text-gray-600">
                      {purchase.purchaseDate.toLocaleDateString()}
                    </td>
                    <td className="table-cell font-semibold text-gray-900">{purchase.item}</td>
                    <td className="table-cell text-gray-600">{purchase.supplier || '—'}</td>
                    <td className="table-cell text-right">{purchase.quantity} {purchase.unit}</td>
                    <td className="table-cell text-right">{DEFAULT_CURRENCY} {purchase.unitCost.toLocaleString()}</td>
                    <td className="table-cell text-right font-semibold">{DEFAULT_CURRENCY} {purchase.totalCost.toLocaleString()}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(purchase)}
                          className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(purchase.id, purchase.item)}
                          className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PurchaseLogModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingEntry(null); }}
        editingEntry={editingEntry}
        onSaved={loadPurchases}
      />
    </div>
  );
}
