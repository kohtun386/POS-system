import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { StockItem } from '../../types';
import { stockItemsService } from '../../lib/services';
import { useApp, useCapability } from '../../context/SupabaseAppContext';
import { swalConfig } from '../../lib/sweetAlert';
import { UpgradePrompt } from '../ui/UpgradePrompt';

interface StockItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: StockItem | null;
  onSaved: () => void;
}

function StockItemModal({ isOpen, onClose, item, onSaved }: StockItemModalProps) {
  const { state } = useApp();
  const currentShop = state.shop;

  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: 'piece',
    lowThreshold: '',
    category: '',
    notes: '',
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        quantity: item.quantity.toString(),
        unit: item.unit,
        lowThreshold: item.lowThreshold.toString(),
        category: item.category,
        notes: item.notes,
      });
    } else {
      setFormData({ name: '', quantity: '', unit: 'piece', lowThreshold: '', category: '', notes: '' });
    }
  }, [item, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop) return;
    if (!formData.name.trim()) return swalConfig.error('Stock item name is required');

    const quantity = parseFloat(formData.quantity || '0');
    const lowThreshold = parseFloat(formData.lowThreshold || '0');
    if (quantity < 0) return swalConfig.error('Quantity cannot be negative');

    try {
      swalConfig.loading(item ? 'Updating stock item...' : 'Adding stock item...');
      if (item) {
        await stockItemsService.update(item.id, {
          name: formData.name,
          quantity,
          unit: formData.unit,
          lowThreshold,
          category: formData.category,
          notes: formData.notes,
        });
      } else {
        await stockItemsService.create({
          shopId: currentShop.id,
          name: formData.name,
          quantity,
          unit: formData.unit,
          lowThreshold,
          category: formData.category,
          notes: formData.notes,
        });
      }
      swalConfig.success(item ? 'Stock item updated!' : 'Stock item added!');
      onSaved();
      onClose();
    } catch (err) {
      console.error('Stock item save error:', err);
      swalConfig.error('Failed to save stock item.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-secondary-200">
          <h2 className="text-xl font-bold text-secondary-900">{item ? 'Edit Stock Item' : 'Add Stock Item'}</h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600 p-2 rounded-xl hover:bg-secondary-100 transition-colors">
            <span className="sr-only">Close</span>
            <span aria-hidden="true" className="text-xl">&times;</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-secondary-700 mb-1">Item Name *</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input" placeholder="e.g. Coffee Beans, Milk" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Current Quantity</label>
              <input type="number" step="any" min="0" value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="input" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Unit</label>
              <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="select">
                <option value="piece">Piece</option>
                <option value="kg">Kilogram</option>
                <option value="g">Gram</option>
                <option value="l">Litre</option>
                <option value="ml">Millilitre</option>
                <option value="box">Box</option>
                <option value="pack">Pack</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Low Stock Threshold</label>
              <input type="number" step="any" min="0" value={formData.lowThreshold}
                onChange={(e) => setFormData({ ...formData, lowThreshold: e.target.value })} className="input" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Category</label>
              <input type="text" value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input" placeholder="e.g. Beans, Dairy" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="textarea" rows={2} placeholder="Optional notes..." />
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t border-secondary-200">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">{item ? 'Update' : 'Add'} Stock Item</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Adjustment modal — inline for stock count corrections
function AdjustModal({ isOpen, onClose, item, onSaved }: { isOpen: boolean; onClose: () => void; item: StockItem | null; onSaved: () => void }) {
  const [newQty, setNewQty] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (item) {
      setNewQty(item.quantity.toString());
      setReason('');
    }
  }, [item, isOpen]);

  const handleAdjust = async () => {
    if (!item) return;
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty < 0) return swalConfig.error('Quantity must be a valid non-negative number');
    if (!reason.trim()) return swalConfig.error('Please provide a reason for the adjustment');

    try {
      swalConfig.loading('Adjusting stock...');
      await stockItemsService.adjust(item.id, qty, reason);
      swalConfig.success('Stock adjusted successfully!');
      onSaved();
      onClose();
    } catch (err) {
      console.error('Adjust error:', err);
      swalConfig.error('Failed to adjust stock.');
    }
  };

  if (!isOpen || !item) return null;

  const diff = parseFloat(newQty || '0') - item.quantity;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-secondary-900 mb-1">Adjust Stock: {item.name}</h2>
          <p className="text-sm text-secondary-500 mb-4">Current count: {item.quantity} {item.unit}</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">New Quantity *</label>
              <input type="number" step="any" min="0" value={newQty}
                onChange={(e) => setNewQty(e.target.value)} className="input text-lg" autoFocus />
            </div>
            {newQty && (
              <div className={`text-sm font-medium ${diff > 0 ? 'text-success-600' : diff < 0 ? 'text-danger-600' : 'text-secondary-500'}`}>
                {diff > 0 ? `+${diff}` : diff} {item.unit} from previous count
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Reason *</label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                className="input" placeholder="e.g. Weekly count, Damaged, Used" />
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t border-secondary-200">
              <button onClick={onClose} className="btn btn-secondary">Cancel</button>
              <button onClick={handleAdjust} className="btn btn-primary">Confirm Adjustment</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component
export function StockOverviewManager() {
  const { state } = useApp();
  const canStockOverview = useCapability('stock_overview');
  const currentShop = state.shop;

  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);

  const loadItems = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const data = await stockItemsService.getAll(currentShop.id);
      setItems(data);
    } catch (err) {
      console.error('Failed to load stock items:', err);
    } finally {
      setLoading(false);
    }
  }, [currentShop]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = items.filter(i => i.quantity <= i.lowThreshold && i.lowThreshold > 0);

  if (!canStockOverview) {
    return (
      <div className="p-4 lg:p-6 space-y-6 bg-secondary-50 min-h-full">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <Package className="h-16 w-16 text-secondary-300" />
          <h2 className="text-2xl font-bold text-secondary-900">Stock Overview</h2>
          <p className="text-secondary-500 max-w-md">This feature is available on Growth tier and above.</p>
          <UpgradePrompt feature="Stock Overview" tier="growth" onClose={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-secondary-50 min-h-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-secondary-900">Stock Overview</h1>
          <p className="text-secondary-600 mt-1">Supply-level stock tracking and manual adjustments</p>
        </div>
        <button onClick={() => { setEditingItem(null); setShowAddModal(true); }} className="btn btn-primary">
          <Plus className="h-5 w-5" />
          <span>Add Stock Item</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="stat-card bg-gradient-to-br from-primary-500 to-primary-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-primary-100 text-sm font-medium">Total Items</p>
              <p className="text-2xl lg:text-3xl font-bold">{items.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl"><Package className="h-6 w-6 lg:h-8 lg:w-8" /></div>
          </div>
        </div>
        <div className="stat-card bg-gradient-to-br from-warning-500 to-warning-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-warning-100 text-sm font-medium">Low Stock</p>
              <p className="text-2xl lg:text-3xl font-bold">{lowStockItems.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl"><AlertTriangle className="h-6 w-6 lg:h-8 lg:w-8" /></div>
          </div>
        </div>
        <div className="stat-card bg-gradient-to-br from-purple-500 to-purple-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-purple-100 text-sm font-medium">Categories</p>
              <p className="text-2xl lg:text-3xl font-bold">{new Set(items.map(i => i.category).filter(Boolean)).size || 0}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl"><ArrowUpDown className="h-6 w-6 lg:h-8 lg:w-8" /></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 h-5 w-5" />
            <input type="text" placeholder="Search stock items..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="input pl-10" />
          </div>
        </div>
      </div>

      {/* Stock Items Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-secondary-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-secondary-500">
            <Package className="h-12 w-12 mx-auto text-secondary-300 mb-3" />
            <p>{items.length === 0 ? 'No stock items yet. Add your first supply item above.' : 'No items match your search.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Item</th>
                  <th className="table-header-cell">Category</th>
                  <th className="table-header-cell text-right">Quantity</th>
                  <th className="table-header-cell text-right">Low Threshold</th>
                  <th className="table-header-cell">Status</th>
                  <th className="table-header-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-secondary-50 divide-y divide-secondary-200">
                {filtered.map((item) => {
                  const isLow = item.lowThreshold > 0 && item.quantity <= item.lowThreshold;
                  return (
                    <tr key={item.id} className="table-row">
                      <td className="table-cell">
                        <div className="font-semibold text-secondary-900">{item.name}</div>
                        {item.notes && <div className="text-xs text-secondary-500 mt-0.5">{item.notes}</div>}
                      </td>
                      <td className="table-cell">
                        {item.category ? <span className="badge badge-info">{item.category}</span> : '—'}
                      </td>
                      <td className="table-cell text-right">
                        <span className={`font-medium ${isLow ? 'text-warning-600' : 'text-secondary-900'}`}>
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="table-cell text-right text-secondary-600">
                        {item.lowThreshold > 0 ? `${item.lowThreshold} ${item.unit}` : '—'}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${isLow ? 'badge-warning' : 'badge-success'}`}>
                          {isLow ? 'Low Stock' : 'OK'}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => setAdjustItem(item)}
                            className="text-success-600 hover:text-success-900 p-2 rounded-xl hover:bg-success-50 transition-colors"
                            title="Adjust stock count">
                            <ArrowUpDown className="h-4 w-4" />
                          </button>
                          <button onClick={() => { setEditingItem(item); setShowAddModal(true); }}
                            className="text-primary-600 hover:text-primary-900 p-2 rounded-xl hover:bg-primary-50 transition-colors">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={async () => {
                              const result = await swalConfig.deleteConfirm(`stock item "${item.name}"`);
                              if (result.isConfirmed) {
                                await stockItemsService.delete(item.id);
                                swalConfig.success('Stock item deleted.');
                                loadItems();
                              }
                            }}
                            className="text-danger-600 hover:text-danger-900 p-2 rounded-xl hover:bg-danger-50 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StockItemModal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingItem(null); }} item={editingItem} onSaved={loadItems} />
      <AdjustModal isOpen={!!adjustItem} onClose={() => setAdjustItem(null)} item={adjustItem} onSaved={loadItems} />
    </div>
  );
}
