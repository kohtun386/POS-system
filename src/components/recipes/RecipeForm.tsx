import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calculator } from 'lucide-react';
import { Recipe, Product } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import { recipesService, recipeLinesService } from '../../lib/services';
import { swalConfig } from '../../lib/sweetAlert';

interface RecipeFormProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  product: Product | undefined;
}

interface RecipeLineForm {
  id?: string;
  rawMaterialId: string;
  rawMaterialName: string;
  quantity: string;
  recipeUnit: string;
  recipeQuantity: string;
  wastagePercent: string;
  isOptional: boolean;
  notes: string;
}

export function RecipeForm({ isOpen, onClose, recipe, product }: RecipeFormProps) {
  const { state, dispatch } = useApp();
  const [instructions, setInstructions] = useState('');
  const [prepTimeSeconds, setPrepTimeSeconds] = useState('');
  const [lines, setLines] = useState<RecipeLineForm[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && recipe) {
      setInstructions(recipe.instructions || '');
      setPrepTimeSeconds(recipe.prepTimeSeconds?.toString() || '');
      // Load existing recipe lines
      recipeLinesService.getByRecipeId(recipe.id).then(existingLines => {
        setLines(existingLines.map(line => ({
          id: line.id,
          rawMaterialId: line.rawMaterialId,
          rawMaterialName: line.rawMaterialName,
          quantity: line.quantity.toString(),
          recipeUnit: line.recipeUnit || '',
          recipeQuantity: line.recipeQuantity?.toString() || '',
          wastagePercent: line.wastagePercent.toString(),
          isOptional: line.isOptional,
          notes: line.notes || '',
        })));
      });
    } else if (isOpen) {
      setInstructions('');
      setPrepTimeSeconds('');
      setLines([]);
    }
  }, [isOpen, recipe]);

  const addLine = () => {
    setLines(prev => [...prev, {
      rawMaterialId: '',
      rawMaterialName: '',
      quantity: '',
      recipeUnit: '',
      recipeQuantity: '',
      wastagePercent: '0',
      isOptional: false,
      notes: '',
    }]);
  };

  const removeLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof RecipeLineForm, value: string | boolean) => {
    setLines(prev => prev.map((line, i) => {
      if (i !== index) return line;
      const updated = { ...line, [field]: value };

      // Auto-fill material name when material is selected
      if (field === 'rawMaterialId') {
        const material = state.rawMaterials.find(rm => rm.id === value);
        if (material) {
          updated.rawMaterialName = material.name;
          updated.recipeUnit = material.baseUnit;
        }
      }

      return updated;
    }));
  };

  const calculateTheoreticalCost = (): number => {
    return lines.reduce((total, line) => {
      const material = state.rawMaterials.find(rm => rm.id === line.rawMaterialId);
      if (!material || !material.costPerUnit) return total;
      const qty = parseFloat(line.quantity) || 0;
      const wastage = parseFloat(line.wastagePercent) || 0;
      return total + (qty * (1 + wastage / 100) * material.costPerUnit);
    }, 0);
  };

  const handleSave = async () => {
    if (!product) return;
    if (lines.length === 0) {
      swalConfig.warning('Add at least one recipe line');
      return;
    }

    const invalidLines = lines.filter(l => !l.rawMaterialId || !l.quantity);
    if (invalidLines.length > 0) {
      swalConfig.warning('All lines must have a material and quantity');
      return;
    }

    setIsSaving(true);
    try {
      swalConfig.loading('Saving recipe...');

      let savedRecipe = recipe;
      if (recipe) {
        savedRecipe = await recipesService.update(recipe.id, {
          instructions: instructions || undefined,
          prepTimeSeconds: prepTimeSeconds ? parseInt(prepTimeSeconds) : undefined,
        });
        dispatch({ type: 'UPDATE_RECIPE', payload: savedRecipe });
      } else {
        savedRecipe = await recipesService.create({
          shopId: state.activeShopId,
          productId: product.id,
          productName: product.name,
          servingSize: 1,
          servingUnit: 'serving',
          prepTimeSeconds: prepTimeSeconds ? parseInt(prepTimeSeconds) : undefined,
          instructions: instructions || undefined,
          isActive: true,
        });
        dispatch({ type: 'ADD_RECIPE', payload: savedRecipe });
      }

      // Save recipe lines
      const linesToSave = lines.map(line => ({
        shopId: state.activeShopId,
        recipeId: savedRecipe!.id,
        rawMaterialId: line.rawMaterialId,
        rawMaterialName: line.rawMaterialName,
        quantity: parseFloat(line.quantity),
        recipeUnit: line.recipeUnit || undefined,
        recipeQuantity: line.recipeQuantity ? parseFloat(line.recipeQuantity) : undefined,
        wastagePercent: parseFloat(line.wastagePercent) || 0,
        isOptional: line.isOptional,
        notes: line.notes || undefined,
      }));

      await recipeLinesService.bulkReplace(savedRecipe.id, linesToSave);

      swalConfig.success('Recipe saved');
      onClose();
    } catch (error) {
      console.error('Error saving recipe:', error);
      swalConfig.error('Failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !product) return null;

  const theoreticalCost = calculateTheoreticalCost();

  return (
    <div className="modal-overlay">
      <div className="modal max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="modal-header">
          <div>
            <h2 className="text-lg font-bold font-fraunces text-[#473b32] dark:text-[#f0ece5]">
              {recipe ? 'Edit Recipe' : 'Create Recipe'}
            </h2>
            <p className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-[#ad9e8a] hover:text-[#7d6b57] p-2 rounded-xl hover:bg-[#f0ece5] dark:hover:bg-[#3b2613] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="modal-body overflow-y-auto flex-1 space-y-4">
          {/* Recipe Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-1">Prep Time (seconds)</label>
              <input type="number" min="0" value={prepTimeSeconds} onChange={e => setPrepTimeSeconds(e.target.value)} className="input" placeholder="e.g., 120" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-1">Theoretical Cost</label>
              <div className="input bg-[#f0ece5] dark:bg-[#3b2613] flex items-center">
                <Calculator className="h-4 w-4 mr-2 text-[#ad9e8a]" />
                <span className="font-semibold text-[#473b32] dark:text-[#f0ece5]">
                  {state.settings.currency} {theoreticalCost.toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-1">Instructions</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} className="textarea" rows={2} placeholder="Optional preparation instructions..." />
          </div>

          {/* Recipe Lines */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-[#473b32] dark:text-[#f0ece5]">Ingredients</h3>
              <button onClick={addLine} className="btn btn-secondary btn-sm">
                <Plus className="h-4 w-4" />
                <span>Add Ingredient</span>
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => {
                const material = state.rawMaterials.find(rm => rm.id === line.rawMaterialId);
                return (
                  <div key={index} className="border border-[#ded7cc] dark:border-[#54463b] rounded-xl p-3 space-y-3">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      {/* Material Select */}
                      <div className="col-span-4">
                        <label className="block text-xs text-[#7d6b57] dark:text-[#c6bbab] mb-1">Material</label>
                        <select
                          value={line.rawMaterialId}
                          onChange={e => updateLine(index, 'rawMaterialId', e.target.value)}
                          className="select text-sm"
                        >
                          <option value="">Select material...</option>
                          {state.rawMaterials.filter(rm => rm.isActive).map(rm => (
                            <option key={rm.id} value={rm.id}>{rm.name} ({rm.baseUnit})</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <label className="block text-xs text-[#7d6b57] dark:text-[#c6bbab] mb-1">Qty (base)</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={line.quantity}
                          onChange={e => updateLine(index, 'quantity', e.target.value)}
                          className="input text-sm"
                          placeholder="0"
                        />
                      </div>

                      {/* Recipe Unit Display */}
                      <div className="col-span-2">
                        <label className="block text-xs text-[#7d6b57] dark:text-[#c6bbab] mb-1">Recipe Unit</label>
                        <input
                          type="text"
                          value={line.recipeUnit}
                          onChange={e => updateLine(index, 'recipeUnit', e.target.value)}
                          className="input text-sm"
                          placeholder={material?.baseUnit || 'unit'}
                        />
                      </div>

                      {/* Wastage */}
                      <div className="col-span-2">
                        <label className="block text-xs text-[#7d6b57] dark:text-[#c6bbab] mb-1">Wastage %</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={line.wastagePercent}
                          onChange={e => updateLine(index, 'wastagePercent', e.target.value)}
                          className="input text-sm"
                        />
                      </div>

                      {/* Remove */}
                      <div className="col-span-2 flex items-center space-x-2">
                        <label className="flex items-center space-x-1 text-xs text-[#7d6b57] dark:text-[#c6bbab]">
                          <input
                            type="checkbox"
                            checked={line.isOptional}
                            onChange={e => updateLine(index, 'isOptional', e.target.checked)}
                            className="rounded"
                          />
                          <span>Optional</span>
                        </label>
                        <button onClick={() => removeLine(index)} className="btn btn-ghost btn-sm text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Notes */}
                    <input
                      type="text"
                      value={line.notes}
                      onChange={e => updateLine(index, 'notes', e.target.value)}
                      className="input text-sm"
                      placeholder="Notes (e.g., froth to 65°C)"
                    />
                  </div>
                );
              })}

              {lines.length === 0 && (
                <div className="text-center py-6 text-[#ad9e8a]">
                  No ingredients added yet. Click "Add Ingredient" to start.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary btn-md px-6">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="btn btn-primary btn-md px-6">
            {isSaving ? 'Saving...' : 'Save Recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}
