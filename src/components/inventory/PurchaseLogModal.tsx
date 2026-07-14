import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { PurchaseLog } from '../../types';
import { purchaseLogsService } from '../../lib/services';
import { useApp } from '../../context/SupabaseAppContext';
import { swalConfig } from '../../lib/sweetAlert';

interface PurchaseLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEntry: PurchaseLog | null;
  onSaved: () => void;
}

export function PurchaseLogModal({ isOpen, onClose, editingEntry, onSaved }: PurchaseLogModalProps) {
  const { state } = useApp();
  const currentShop = state.currentShop;

  const [formData, setFormData] = useState({
    supplier: '',
    item: '',
    quantity: '',
    unit: 'piece',
    unitCost: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        supplier: editingEntry.supplier,
        item: editingEntry.item,
        quantity: editingEntry.quantity.toString(),
        unit: editingEntry.unit,
        unitCost: editingEntry.unitCost.toString(),
        purchaseDate: editingEntry.purchaseDate.toISOString().split('T')[0],
        notes: editingEntry.notes,
      });
    } else {
      setFormData({
        supplier: '',
        item: '',
        quantity: '',
        unit: 'piece',
        unitCost: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
  }, [editingEntry, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop) return;

    const quantity = parseFloat(formData.quantity);
    const unitCost = parseFloat(formData.unitCost);
    if (!quantity || quantity <= 0) return swalConfig.error('Quantity must be greater than 0');
    if (!formData.item.trim()) return swalConfig.error('Item name is required');
    if (unitCost < 0) return swalConfig.error('Unit cost cannot be negative');

    try {
      swalConfig.loading(editingEntry ? 'Updating purchase...' : 'Recording purchase...');
      if (editingEntry) {
        await purchaseLogsService.update(editingEntry.id, {
          supplier: formData.supplier,
          item: formData.item,
          quantity,
          unit: formData.unit,
          unitCost,
          purchaseDate: new Date(formData.purchaseDate),
          notes: formData.notes,
        });
      } else {
        await purchaseLogsService.create({
          shopId: currentShop.id,
          supplier: formData.supplier,
          item: formData.item,
          quantity,
          unit: formData.unit,
          unitCost,
          purchaseDate: new Date(formData.purchaseDate),
          notes: formData.notes,
        });
      }
      swalConfig.success(editingEntry ? 'Purchase updated!' : 'Purchase recorded!');
      onSaved();
      onClose();
    } catch (err) {
      console.error('Purchase save error:', err);
      swalConfig.error('Failed to save purchase. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {editingEntry ? 'Edit Purchase' : 'Record Purchase'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
              <input
                type="text"
                value={formData.item}
                onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                className="input"
                placeholder="e.g. Coffee beans, Milk"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="input"
                placeholder="e.g. ABC Suppliers"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="input"
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="select"
              >
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost (MMK) *</label>
              <input
                type="number"
                step="any"
                min="0"
                value={formData.unitCost}
                onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                className="input"
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
              <input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="textarea"
              rows={2}
              placeholder="Optional notes..."
            />
          </div>

          {formData.quantity && formData.unitCost && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                MMK {(parseFloat(formData.quantity || '0') * parseFloat(formData.unitCost || '0')).toLocaleString()}
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingEntry ? 'Update' : 'Record'} Purchase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
