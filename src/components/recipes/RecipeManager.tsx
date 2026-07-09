import { useState } from 'react';
import { Plus, Search, Edit, Trash2, ChefHat, Copy } from 'lucide-react';
import { Recipe, Product } from '../../types';
import { useApp, useCapability } from '../../context/SupabaseAppContext';
import { recipesService } from '../../lib/services';
import { RecipeForm } from './RecipeForm';
import { swalConfig } from '../../lib/sweetAlert';
import Swal from 'sweetalert2';
import { UpgradePrompt } from '../ui/UpgradePrompt';

export function RecipeManager() {
  const { state, dispatch } = useApp();
<<<<<<< HEAD
  const inventoryEnabled = useFeatureFlag('inventory');
=======
  const inventoryEnabled = useCapability('inventory');
  const recipeBomEnabled = useCapability('recipe_bom');
>>>>>>> feature/vision-v3-migration
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  if (!inventoryEnabled || !recipeBomEnabled) {
    return (
      <div className="p-6 text-center">
        <ChefHat className="h-12 w-12 mx-auto text-[#ad9e8a] mb-4" />
        <h2 className="text-lg font-semibold text-[#473b32] dark:text-[#f0ece5]">
          {!inventoryEnabled ? 'Inventory Tracking Disabled' : 'Recipe Management Disabled'}
        </h2>
        <div className="mt-2 max-w-md mx-auto">
          <UpgradePrompt feature="Recipe management" tier="growth" onClose={() => {}} />
        </div>
      </div>
    );
  }

  // Build a list of all products with their recipe status
  const productsWithRecipes = state.products.map(product => {
    const recipe = state.recipes.find(r => r.productId === product.id);
    return { product, recipe };
  });

  const filteredProducts = productsWithRecipes.filter(({ product }) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const recipesWithCount = state.recipes.length;
  const productsWithoutRecipe = productsWithRecipes.filter(({ recipe }) => !recipe).length;

  const handleCreateRecipe = (product: Product) => {
    setEditingRecipe(null);
    setSelectedProduct(product);
    setShowForm(true);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowForm(true);
  };

  const handleDeleteRecipe = async (recipe: Recipe) => {
    const result = await swalConfig.deleteConfirm(`recipe for ${recipe.productName}`);
    if (result.isConfirmed) {
      try {
        swalConfig.loading('Deleting recipe...');
        await recipesService.delete(recipe.id);
        dispatch({ type: 'DELETE_RECIPE', payload: recipe.id });
        swalConfig.success('Recipe deleted');
      } catch (error) {
        console.error('Error deleting recipe:', error);
        swalConfig.error('Failed to delete recipe');
      }
    }
  };

  const handleDuplicate = async (recipe: Recipe) => {
    // Find products without a recipe to duplicate to
    const availableProducts = state.products.filter(p =>
      !state.recipes.some(r => r.productId === p.id) && p.id !== recipe.productId
    );

    if (availableProducts.length === 0) {
      swalConfig.warning('No available products to duplicate recipe to');
      return;
    }

    // Build id → name map for the select dropdown
    const productOptions: Record<string, string> = {};
    for (const p of availableProducts) {
      productOptions[p.id] = p.name;
    }

    const { value: selectedId } = await Swal.fire({
      title: 'Duplicate Recipe',
      text: 'Select a product to create a duplicate recipe for:',
      input: 'select',
      inputOptions: productOptions,
      inputPlaceholder: 'Choose a product...',
      showCancelButton: true,
      confirmButtonColor: '#9a693a',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Duplicate',
      cancelButtonText: 'Cancel',
      background: '#ffffff',
      color: '#374151',
      customClass: {
        popup: 'rounded-3xl shadow-2xl border border-gray-100',
        title: 'text-gray-900 font-bold text-xl mb-2',
        htmlContainer: 'text-gray-600 text-base',
        confirmButton: 'bg-[#9a693a] hover:bg-[#7a4f2c] text-white font-medium py-3 px-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 mr-3',
        cancelButton: 'bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl transition-all duration-200',
        actions: 'gap-3 mt-6'
      },
      buttonsStyling: false
    });

    if (selectedId) {
      try {
        swalConfig.loading('Duplicating recipe...');
        const newRecipe = await recipesService.duplicate(recipe.id, selectedId);
        dispatch({ type: 'ADD_RECIPE', payload: newRecipe });
        swalConfig.success('Recipe duplicated');
      } catch (error) {
        console.error('Error duplicating recipe:', error);
        swalConfig.error('Failed to duplicate recipe');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingRecipe(null);
    setSelectedProduct(null);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-gray-50 dark:bg-[#1a0f08] min-h-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-fraunces text-[#473b32] dark:text-[#f0ece5]">Recipes</h1>
          <p className="text-[#7d6b57] dark:text-[#c6bbab] mt-1">Define bill of materials for your products</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Total Products</div>
          <div className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5]">{state.products.length}</div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Recipes Defined</div>
          <div className="text-2xl font-bold">{recipesWithCount}</div>
        </div>
        <div className={`stat-card ${productsWithoutRecipe > 0 ? 'stat-card-warning' : ''}`}>
          <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Missing Recipes</div>
          <div className="text-2xl font-bold">{productsWithoutRecipe}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#ad9e8a]" />
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* Product List with Recipe Status */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr className="table-header">
                <th className="table-header-cell">Product</th>
                <th className="table-header-cell">SKU</th>
                <th className="table-header-cell">Category</th>
                <th className="table-header-cell">Recipe Status</th>
                <th className="table-header-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(({ product, recipe }) => (
                <tr key={product.id} className="table-row">
                  <td className="table-cell font-medium text-[#473b32] dark:text-[#f0ece5]">{product.name}</td>
                  <td className="table-cell text-[#7d6b57] dark:text-[#c6bbab]">{product.sku}</td>
                  <td className="table-cell text-[#7d6b57] dark:text-[#c6bbab]">{product.category}</td>
                  <td className="table-cell">
                    {recipe ? (
                      <span className="badge badge-success">Defined</span>
                    ) : (
                      <span className="badge badge-warning">Not Set</span>
                    )}
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex justify-end space-x-1">
                      {recipe ? (
                        <>
                          <button onClick={() => handleEditRecipe(recipe)} className="btn btn-ghost btn-sm" title="Edit Recipe">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDuplicate(recipe)} className="btn btn-ghost btn-sm" title="Duplicate Recipe">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteRecipe(recipe)} className="btn btn-ghost btn-sm text-red-600 hover:text-red-700" title="Delete Recipe">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleCreateRecipe(product)} className="btn btn-primary btn-sm">
                          <Plus className="h-4 w-4" />
                          <span>Create Recipe</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-cell text-center py-8 text-[#ad9e8a]">
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <RecipeForm
          isOpen={showForm}
          onClose={handleFormClose}
          recipe={editingRecipe}
          product={editingRecipe ? state.products.find(p => p.id === editingRecipe.productId) : selectedProduct}
        />
      )}
    </div>
  );
}
