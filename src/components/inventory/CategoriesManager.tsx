import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Search, Edit, Trash2, Tag } from 'lucide-react';
import { Category } from '../../types';
import { useActiveShopId } from '../../hooks/useApp';
import { swalConfig } from '../../lib/sweetAlert';
import { CategoryModal } from './CategoryModal';

export interface CategoriesManagerHandle {
  openAddModal: () => void;
}

export const CategoriesManager = forwardRef<CategoriesManagerHandle>(
  function CategoriesManager(_props, ref) {
  const shopId = useActiveShopId();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { categoriesService } = await import('../../lib/services');
      const data = await categoriesService.getAll(shopId);
      setCategories(data);

      // Fetch product counts for all categories in parallel
      const counts = await Promise.all(
        data.map(async (cat) => {
          try {
            const count = await categoriesService.getProductCount(shopId, cat.name);
            return { id: cat.id, count };
          } catch {
            return { id: cat.id, count: 0 };
          }
        })
      );
      const countMap: Record<string, number> = {};
      for (const { id, count } of counts) {
        countMap[id] = count;
      }
      setProductCounts(countMap);
    } catch (error) {
      console.error('Error loading categories:', error);
      swalConfig.error('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setShowModal(true);
  };

  const handleDeleteCategory = async (category: Category) => {
    const count = productCounts[category.id] ?? 0;
    if (count > 0) {
      swalConfig.error(`Cannot delete "${category.name}" — ${count} product(s) still use it. Reassign them first.`);
      return;
    }

    const result = await swalConfig.deleteConfirm('category');
    if (result.isConfirmed) {
      try {
        swalConfig.loading('Deleting category...');
        const { categoriesService } = await import('../../lib/services');
        await categoriesService.delete(category.id);
        setCategories(prev => prev.filter(c => c.id !== category.id));
        swalConfig.success('Category deleted successfully!');
      } catch (error) {
        console.error('Error deleting category:', error);
        swalConfig.error(error instanceof Error ? error.message : 'Failed to delete category.');
      }
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setShowModal(true);
  };

  useImperativeHandle(ref, () => ({
    openAddModal: () => handleAddCategory(),
  }));

  const toggleCategoryStatus = async (category: Category) => {
    try {
      swalConfig.loading(`${category.active ? 'Deactivating' : 'Activating'} category...`);
      const { categoriesService } = await import('../../lib/services');
      await categoriesService.update(category.id, { active: !category.active });
      setCategories(prev =>
        prev.map(c => c.id === category.id ? { ...c, active: !c.active } : c)
      );
      swalConfig.success(`Category ${category.active ? 'deactivated' : 'activated'} successfully!`);
    } catch (error) {
      console.error('Error updating category:', error);
      swalConfig.error('Failed to update category. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="stat-card bg-gradient-to-br from-primary-500 to-primary-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-primary-100 text-sm font-medium">Total Categories</p>
              <p className="text-2xl lg:text-3xl font-bold">{categories.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl">
              <Tag className="h-6 w-6 lg:h-8 lg:w-8" />
            </div>
          </div>
        </div>

        <div className="stat-card bg-gradient-to-br from-success-500 to-success-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-success-100 text-sm font-medium">Active Categories</p>
              <p className="text-2xl lg:text-3xl font-bold">
                {categories.filter(c => c.active).length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl">
              <Tag className="h-6 w-6 lg:h-8 lg:w-8" />
            </div>
          </div>
        </div>

        <div className="stat-card bg-gradient-to-br from-warning-500 to-warning-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-warning-100 text-sm font-medium">Inactive Categories</p>
              <p className="text-2xl lg:text-3xl font-bold">
                {categories.filter(c => !c.active).length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl">
              <Tag className="h-6 w-6 lg:h-8 lg:w-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>
      </div>

      {/* Categories Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Category</th>
                <th className="table-header-cell">Products</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-secondary-50 dark:bg-primary-950 divide-y divide-secondary-200 dark:divide-secondary-800">
              {filteredCategories.map((category) => (
                <tr key={category.id} className="table-row">
                  <td className="table-cell">
                    <div>
                      <div className="text-sm font-semibold text-secondary-900 dark:text-secondary-100">{category.name}</div>
                      {category.description && (
                        <div className="text-xs text-secondary-500">{category.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="text-sm text-secondary-700 dark:text-secondary-300">
                      {productCounts[category.id] ?? '—'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => toggleCategoryStatus(category)}
                      className={`badge ${
                        category.active ? 'badge-success' : 'badge-danger'
                      } cursor-pointer hover:opacity-80`}
                    >
                      {category.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEditCategory(category)}
                        aria-label="Edit category"
                        className="text-primary-600 hover:text-primary-900 p-2 rounded-xl hover:bg-primary-50 transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        aria-label="Delete category"
                        className="text-danger-600 hover:text-danger-900 p-2 rounded-xl hover:bg-danger-50 transition-colors"
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
      </div>

      {/* Empty State */}
      {categories.length > 0 && filteredCategories.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="bg-secondary-100 p-6 rounded-3xl mb-4">
            <Tag className="h-16 w-16 text-secondary-400" />
          </div>
          <p className="text-secondary-600 text-lg font-medium">No categories found</p>
          <p className="text-secondary-400 text-sm mt-1">Try adjusting your search</p>
        </div>
      )}

      {categories.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="bg-secondary-100 p-6 rounded-3xl mb-4">
            <Tag className="h-16 w-16 text-secondary-400" />
          </div>
          <p className="text-secondary-600 text-lg font-medium">No categories yet</p>
          <p className="text-secondary-400 text-sm mt-1">Create your first category to organize products.</p>
        </div>
      )}

      <CategoryModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        category={editingCategory}
        onSuccess={loadCategories}
      />
    </div>
  );
});
