import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Category } from '../../types';
import { useActiveShopId } from '../../hooks/useApp';
import { useModalEscape } from '../../hooks/useModalEscape';
import { swalConfig } from '../../lib/sweetAlert';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  onSuccess: () => void;
}

export function CategoryModal({ isOpen, onClose, category, onSuccess }: CategoryModalProps) {
  const shopId = useActiveShopId();
  useModalEscape(onClose, isOpen);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description ?? '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
      });
    }
    setErrors({});
  }, [category]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const trimmedName = formData.name.trim();
    const trimmedDescription = formData.description.trim();

    // Validate required fields
    if (!category && !trimmedName) {
      setErrors({ name: 'Category name is required' });
      return;
    }

    try {
      swalConfig.loading(`${category ? 'Updating' : 'Creating'} category...`);
      const { categoriesService } = await import('../../lib/services');

      if (category) {
        // Edit mode — name is omitted (rename out of scope)
        await categoriesService.update(category.id, {
          description: trimmedDescription || undefined,
        });
        swalConfig.success('Category updated successfully!');
      } else {
        // Create mode
        await categoriesService.create(shopId, {
          name: trimmedName,
          description: trimmedDescription || undefined,
        });
        swalConfig.success('Category created successfully!');
      }

      onSuccess();
      onClose();
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        setErrors({ name: 'A category with this name already exists' });
        swalConfig.close();
      } else {
        console.error('Error saving category:', error);
        swalConfig.error(error instanceof Error ? error.message : 'Failed to save category.');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-xl">
        <div className="modal-header">
          <h2 className="text-xl font-bold text-secondary-900 font-fraunces">
            {category ? 'Edit Category' : 'Add New Category'}
          </h2>
          <button
            onClick={onClose}
            className="text-secondary-400 hover:text-secondary-600 p-2 rounded-xl hover:bg-secondary-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="modal-body space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-4 font-fraunces">Category Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Category Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={!!category}
                  className={`input ${errors.name ? 'border-danger-500' : ''} ${category ? 'opacity-60 cursor-not-allowed' : ''}`}
                  placeholder="Enter category name"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'error-name' : undefined}
                />
                {errors.name && <p id="error-name" className="text-danger-600 text-xs mt-1" role="alert">{errors.name}</p>}
                {category && (
                  <p className="text-xs text-secondary-500 mt-1">Renaming isn't supported yet</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="textarea"
                  placeholder="Enter category description"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn btn-primary btn-md"
          >
            {category ? 'Update Category' : 'Add Category'}
          </button>
        </div>
      </div>
    </div>
  );
}
