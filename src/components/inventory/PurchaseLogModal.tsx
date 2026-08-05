import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { PurchaseLog } from '../../types';
import { purchaseLogsService } from '../../lib/services';
import { useApp } from '../../hooks/useApp';
import { useModalEscape } from '../../hooks/useModalEscape';
import { swalConfig } from '../../lib/sweetAlert';

interface PurchaseLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEntry: PurchaseLog | null;
  onSaved: () => void;
}

export function PurchaseLogModal({ isOpen, onClose, editingEntry, onSaved }: PurchaseLogModalProps) {
  const { state } = useApp();
  const currentShop = state.shop;
  useModalEscape(onClose, isOpen);

  const [formData, setFormData] = useState({
    supplier: '',
    item: '',
    quantity: '',
    unit: 'piece',
    unitCost: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.item.trim()) e.item = 'Item name is required';
    if (!formData.supplier.trim()) e.supplier = 'Supplier is required';
    const qty = parseFloat(formData.quantity);
    if (!qty || qty <= 0) e.quantity = 'Quantity must be greater than 0';
    const cost = parseFloat(formData.unitCost);
    if (isNaN(cost) || cost < 0) e.unitCost = 'Unit cost cannot be negative';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop) return;
    if (!validate()) return;

    const quantity = parseFloat(formData.quantity);
    const unitCost = parseFloat(formData.unitCost);

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
      <div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-xl font-bold text-secondary-900">
            {editingEntry ? 'Edit Purchase' : 'Record Purchase'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm p-2">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="modal-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Item *</label>
                <input
                  type="text"
                  value={formData.item}
                  onChange={(e) => { setFormData({ ...formData, item: e.target.value }); if (errors.item) setErrors(prev => { const n = { ...prev }; delete n.item; return n; }); }}
                  className={`input ${errors.item ? 'border-danger-500' : ''}`}
                  placeholder="e.g. Coffee beans, Milk"
                  required
                  aria-invalid={!!errors.item}
                  aria-describedby={errors.item ? 'error-item' : undefined}
                />
                {errors.item && <p id="error-item" className="text-danger-600 text-xs mt-1" role="alert">{errors.item}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Supplier *</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => { setFormData({ ...formData, supplier: e.target.value }); if (errors.supplier) setErrors(prev => { const n = { ...prev }; delete n.supplier; return n; }); }}
                  className={`input ${errors.supplier ? 'border-danger-500' : ''}`}
                  placeholder="e.g. ABC Suppliers"
                  aria-invalid={!!errors.supplier}
                  aria-describedby={errors.supplier ? 'error-supplier' : undefined}
                />
                {errors.supplier && <p id="error-supplier" className="text-danger-600 text-xs mt-1" role="alert">{errors.supplier}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={formData.quantity}
                  onChange={(e) => { setFormData({ ...formData, quantity: e.target.value }); if (errors.quantity) setErrors(prev => { const n = { ...prev }; delete n.quantity; return n; }); }}
                  className={`input ${errors.quantity ? 'border-danger-500' : ''}`}
                  placeholder="0"
                  required
                  aria-invalid={!!errors.quantity}
                  aria-describedby={errors.quantity ? 'error-quantity' : undefined}
                />
                {errors.quantity && <p id="error-quantity" className="text-danger-600 text-xs mt-1" role="alert">{errors.quantity}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Unit</label>
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
                <label className="block text-sm font-medium text-secondary-700 mb-1">Unit Cost (MMK) *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={formData.unitCost}
                  onChange={(e) => { setFormData({ ...formData, unitCost: e.target.value }); if (errors.unitCost) setErrors(prev => { const n = { ...prev }; delete n.unitCost; return n; }); }}
                  className={`input ${errors.unitCost ? 'border-danger-500' : ''}`}
                  placeholder="0"
                  required
                  aria-invalid={!!errors.unitCost}
                  aria-describedby={errors.unitCost ? 'error-unitCost' : undefined}
                />
                {errors.unitCost && <p id="error-unitCost" className="text-danger-600 text-xs mt-1" role="alert">{errors.unitCost}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-secondary-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="textarea"
                rows={2}
                placeholder="Optional notes..."
              />
            </div>

            {formData.quantity && formData.unitCost && (
              <div className="bg-secondary-50 rounded-xl p-4 mt-4">
                <p className="text-sm text-secondary-500">Total Cost</p>
                <p className="text-2xl font-bold text-secondary-900">
                  MMK {(parseFloat(formData.quantity || '0') * parseFloat(formData.unitCost || '0')).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-md">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-md">
              {editingEntry ? 'Update' : 'Record'} Purchase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
