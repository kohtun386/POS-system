import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { RawMaterial } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';

interface RawMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (material: Omit<RawMaterial, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  material?: RawMaterial | null;
}

const BASE_UNITS = ['ml', 'g', 'l', 'kg', 'unit', 'oz'];
const CATEGORIES = [
  { value: 'ingredient', label: 'Ingredient' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'consumable', label: 'Consumable' },
];

export function RawMaterialModal({ isOpen, onClose, onSave, material }: RawMaterialModalProps) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState<'ingredient' | 'packaging' | 'consumable'>('ingredient');
  const [currentStock, setCurrentStock] = useState('0');
  const [minimumStock, setMinimumStock] = useState('0');
  const [baseUnit, setBaseUnit] = useState('ml');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (material) {
        setName(material.name);
        setSku(material.sku || '');
        setCategory(material.category);
        setCurrentStock(material.currentStock.toString());
        setMinimumStock(material.minimumStock.toString());
        setBaseUnit(material.baseUnit);
        setCostPerUnit(material.costPerUnit?.toString() || '');
        setNotes(material.notes || '');
      } else {
        setName('');
        setSku('');
        setCategory('ingredient');
        setCurrentStock('0');
        setMinimumStock('0');
        setBaseUnit('ml');
        setCostPerUnit('');
        setNotes('');
      }
    }
  }, [isOpen, material]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      swalConfig.warning('Name is required');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        sku: sku.trim() || undefined,
        category,
        currentStock: parseFloat(currentStock) || 0,
        minimumStock: parseFloat(minimumStock) || 0,
        baseUnit,
        costPerUnit: costPerUnit ? parseFloat(costPerUnit) : undefined,
        isActive: true,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Error saving raw material:', error);
      swalConfig.error('Failed to save raw material');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg">
        <div className="modal-header">
          <h2 className="text-lg font-bold font-fraunces text-[#473b32] dark:text-[#f0ece5]">
            {material ? 'Edit Raw Material' : 'Add Raw Material'}
          </h2>
          <button onClick={onClose} className="text-[#ad9e8a] hover:text-[#7d6b57] p-2 rounded-xl hover:bg-[#f0ece5] dark:hover:bg-[#3b2613] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-1">Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" placeholder="e.g., Whole Milk" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-1">SKU</label>
                <input type="text" value={sku} onChange={e => setSku(e.target.value)} className="input" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value as 'ingredient' | 'packaging' | 'consumable')} className="select">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-1">Base Unit</label>
                <select value={baseUnit} onChange={e => setBaseUnit(e.target.value)} className="select">
                  {BASE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-1">Cost per Unit</label>
                <input type="number" step="0.0001" min="0" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} className="input" placeholder="0.00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-1">Current Stock</label>
                <input type="number" step="0.001" min="0" value={currentStock} onChange={e => setCurrentStock(e.target.value)} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-1">Minimum Stock</label>
                <input type="number" step="0.001" min="0" value={minimumStock} onChange={e => setMinimumStock(e.target.value)} className="input" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="textarea" rows={2} placeholder="Optional notes..." />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-md px-6">Cancel</button>
            <button type="submit" disabled={isSaving} className="btn btn-primary btn-md px-6">
              {isSaving ? 'Saving...' : material ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
