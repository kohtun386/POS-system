import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { RawMaterial } from '../../types';
import { useApp, useCapability } from '../../context/SupabaseAppContext';
import { rawMaterialsService } from '../../lib/services';
import { RawMaterialModal } from './RawMaterialModal';
import { swalConfig } from '../../lib/sweetAlert';
import { UpgradePrompt } from '../ui/UpgradePrompt';

export function RawMaterialManager() {
  const { state, dispatch } = useApp();
<<<<<<< HEAD
  const inventoryEnabled = useFeatureFlag('inventory');
=======
  const inventoryEnabled = useCapability('inventory');
  const rawMaterialsEnabled = useCapability('raw_materials');
>>>>>>> feature/vision-v3-migration
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  if (!inventoryEnabled || !rawMaterialsEnabled) {
    return (
      <div className="p-6 text-center">
        <Package className="h-12 w-12 mx-auto text-[#ad9e8a] mb-4" />
        <h2 className="text-lg font-semibold text-[#473b32] dark:text-[#f0ece5]">
          {!inventoryEnabled ? 'Inventory Tracking Disabled' : 'Raw Materials Disabled'}
        </h2>
        <div className="mt-2 max-w-md mx-auto">
          <UpgradePrompt feature="Raw material management" tier="growth" onClose={() => {}} />
        </div>
      </div>
    );
  }

  const categories = ['All', 'ingredient', 'packaging', 'consumable'];

  const filteredMaterials = state.rawMaterials
    .filter(rm => {
      const matchesSearch = rm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (rm.sku && rm.sku.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || rm.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortBy) {
        case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case 'stock': aVal = a.currentStock; bVal = b.currentStock; break;
        case 'category': aVal = a.category; bVal = b.category; break;
        default: aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase();
      }
      return sortOrder === 'asc' ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) : (aVal > bVal ? -1 : aVal < bVal ? 1 : 0);
    });

  const lowStockMaterials = state.rawMaterials.filter(rm => rm.isActive && rm.currentStock <= rm.minimumStock);
  const totalValue = state.rawMaterials.reduce((sum, rm) => sum + (rm.currentStock * (rm.costPerUnit || 0)), 0);

  const handleAdd = () => {
    setEditingMaterial(null);
    setShowModal(true);
  };

  const handleEdit = (material: RawMaterial) => {
    setEditingMaterial(material);
    setShowModal(true);
  };

  const handleSave = async (data: Omit<RawMaterial, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      swalConfig.loading(editingMaterial ? 'Updating...' : 'Creating...');
      if (editingMaterial) {
        const updated = await rawMaterialsService.update(editingMaterial.id, data);
        dispatch({ type: 'UPDATE_RAW_MATERIAL', payload: updated });
        swalConfig.success('Raw material updated');
      } else {
        const created = await rawMaterialsService.create({ ...data, shopId: state.activeShopId });
        dispatch({ type: 'ADD_RAW_MATERIAL', payload: created });
        swalConfig.success('Raw material created');
      }
    } catch (error) {
      console.error('Error saving raw material:', error);
      swalConfig.error('Failed to save raw material');
    }
  };

  const handleDelete = async (material: RawMaterial) => {
    const result = await swalConfig.deleteConfirm(material.name);
    if (result.isConfirmed) {
      try {
        swalConfig.loading('Deleting...');
        await rawMaterialsService.delete(material.id);
        dispatch({ type: 'DELETE_RAW_MATERIAL', payload: material.id });
        swalConfig.success('Raw material deleted');
      } catch (error) {
        console.error('Error deleting raw material:', error);
        swalConfig.error('Failed to delete raw material');
      }
    }
  };

  const handleRestock = async (material: RawMaterial) => {
    const { value: qty } = await swalConfig.confirm(
      `Restock ${material.name}`,
      `Current stock: ${material.currentStock} ${material.baseUnit}. Enter quantity to add:`,
      'Restock'
    );
    if (qty && parseFloat(qty) > 0) {
      try {
        swalConfig.loading('Restocking...');
        const updated = await rawMaterialsService.restock(material.id, parseFloat(qty));
        dispatch({ type: 'UPDATE_RAW_MATERIAL', payload: updated });
        swalConfig.success(`Added ${qty} ${material.baseUnit} to ${material.name}`);
      } catch (error) {
        console.error('Error restocking:', error);
        swalConfig.error('Failed to restock');
      }
    }
  };

  const toggleSort = (col: 'name' | 'stock' | 'category') => {
    if (sortBy === col) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-gray-50 dark:bg-[#1a0f08] min-h-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-fraunces text-[#473b32] dark:text-[#f0ece5]">Raw Materials</h1>
          <p className="text-[#7d6b57] dark:text-[#c6bbab] mt-1">Manage ingredients, packaging, and consumables</p>
        </div>
        <button onClick={handleAdd} className="btn btn-primary btn-lg">
          <Plus className="h-5 w-5" />
          <span>Add Material</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Total Materials</div>
          <div className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5]">{state.rawMaterials.length}</div>
        </div>
        <div className={`stat-card ${lowStockMaterials.length > 0 ? 'stat-card-warning' : ''}`}>
          <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Low Stock Alerts</div>
          <div className="text-2xl font-bold">{lowStockMaterials.length}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Inventory Value</div>
          <div className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5]">{state.settings.currency} {totalValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockMaterials.length > 0 && (
        <div className="bg-[#fef3c7] dark:bg-[#78350f]/20 border border-[#fbbf24] dark:border-[#92400e]/50 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-[#d97706]" />
            <span className="font-semibold text-[#92400e] dark:text-[#fbbf24]">Low Stock Materials</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockMaterials.map(rm => (
              <span key={rm.id} className="badge badge-warning text-xs">{rm.name}: {rm.currentStock} {rm.baseUnit}</span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#ad9e8a]" />
          <input
            type="text"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
            >
              {cat === 'All' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr className="table-header">
                <th className="table-header-cell cursor-pointer" onClick={() => toggleSort('name')}>
                  <div className="flex items-center space-x-1">
                    <span>Name</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="table-header-cell">SKU</th>
                <th className="table-header-cell cursor-pointer" onClick={() => toggleSort('category')}>
                  <div className="flex items-center space-x-1">
                    <span>Category</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="table-header-cell cursor-pointer" onClick={() => toggleSort('stock')}>
                  <div className="flex items-center space-x-1">
                    <span>Stock</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="table-header-cell">Min Stock</th>
                <th className="table-header-cell">Unit</th>
                <th className="table-header-cell">Cost/Unit</th>
                <th className="table-header-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map(material => (
                <tr key={material.id} className="table-row">
                  <td className="table-cell font-medium text-[#473b32] dark:text-[#f0ece5]">{material.name}</td>
                  <td className="table-cell text-[#7d6b57] dark:text-[#c6bbab]">{material.sku || '—'}</td>
                  <td className="table-cell">
                    <span className="badge badge-info text-xs">{material.category}</span>
                  </td>
                  <td className="table-cell">
                    <span className={material.currentStock <= material.minimumStock ? 'text-red-600 font-semibold' : 'font-medium'}>
                      {material.currentStock}
                    </span>
                  </td>
                  <td className="table-cell text-[#7d6b57] dark:text-[#c6bbab]">{material.minimumStock}</td>
                  <td className="table-cell text-[#7d6b57] dark:text-[#c6bbab]">{material.baseUnit}</td>
                  <td className="table-cell text-[#7d6b57] dark:text-[#c6bbab]">
                    {material.costPerUnit !== undefined ? `${state.settings.currency} ${material.costPerUnit.toFixed(4)}` : '—'}
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex justify-end space-x-1">
                      <button onClick={() => handleRestock(material)} className="btn btn-ghost btn-sm text-green-600 hover:text-green-700" title="Restock">
                        <Package className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleEdit(material)} className="btn btn-ghost btn-sm" title="Edit">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(material)} className="btn btn-ghost btn-sm text-red-600 hover:text-red-700" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8 text-[#ad9e8a]">
                    No raw materials found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RawMaterialModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        material={editingMaterial}
      />
    </div>
  );
}
