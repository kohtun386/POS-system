import React, { useState, useEffect } from 'react';
import { X, Scale } from 'lucide-react';
import { Product, ProductBatch, Category } from '../../types';
import { useApp, useActiveShopId } from '../../hooks/useApp';
import { useModalEscape } from '../../hooks/useModalEscape';
import { productsService, ProductLimitError, categoriesService } from '../../lib/services';
import Swal from 'sweetalert2';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export function ProductModal({ isOpen, onClose, product }: ProductModalProps) {
  const { dispatch } = useApp();
  useModalEscape(onClose, isOpen);
  
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: '',
    cost: '',
    stock: '',
    minStock: '',
    category: '',
    description: '',
    taxable: true,
    active: true,
    isWeightBased: false,
    pricePerUnit: '',
    unit: 'kg',
    image: '',
    trackInventory: true,
  });
  
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const shopId = useActiveShopId();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || '',
        price: product.price.toString(),
        cost: (product.cost ?? 0).toString(),
        stock: (product.stock ?? 0).toString(),
        minStock: (product.minStock ?? 0).toString(),
        category: product.category,
        description: product.description ?? '',
        taxable: product.taxable ?? true,
        active: product.active ?? true,
        isWeightBased: product.isWeightBased || false,
        pricePerUnit: product.pricePerUnit?.toString() || '',
        unit: product.unit || 'kg',
        image: product.image || '',
        trackInventory: product.trackInventory ?? true,
      });
      // Lazy-load batches on edit — no longer bundled in getAll()
      productsService.getBatchesByProductId(product.id).then(setBatches);
    } else {
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        price: '',
        cost: '',
        stock: '',
        minStock: '',
        category: '',
        description: '',
        taxable: true,
        active: true,
        isWeightBased: false,
        pricePerUnit: '',
        unit: 'kg',
        image: '',
        trackInventory: true,
      });
      setBatches([]);
    }
  }, [product]);

  useEffect(() => {
    if (isOpen) {
      categoriesService.getActive(shopId).then(setCategories).catch(err => {
        console.error('Error loading categories:', err);
      });
    }
  }, [isOpen, shopId]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!validate()) return;

    const productData: Product = {
      id: product?.id || Date.now().toString(),
      shopId: product?.shopId || '',
      name: formData.name,
      sku: formData.sku,
      barcode: formData.barcode || undefined,
      price: formData.isWeightBased ? 0 : parseFloat(formData.price),
      cost: parseFloat(formData.cost),
      stock: formData.trackInventory ? parseInt(formData.stock) : 999999,
      minStock: formData.trackInventory ? parseInt(formData.minStock) : 0,
      category: formData.category,
      description: formData.description,
      taxable: formData.taxable,
      active: formData.active,
      isWeightBased: formData.isWeightBased,
      pricePerUnit: formData.isWeightBased ? parseFloat(formData.pricePerUnit) : undefined,
      unit: formData.isWeightBased ? formData.unit : undefined,
      image: formData.image || undefined,
      trackInventory: formData.trackInventory,
      batches,
      createdAt: product?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    try {

      if (product) {
        await productsService.update(productData.id, productData);
        dispatch({ type: 'UPDATE_PRODUCT', payload: productData });
        await Swal.fire({
          title: 'Success!',
          text: 'Product updated successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      } else {
        const newProduct = await productsService.create(productData);
        dispatch({ type: 'ADD_PRODUCT', payload: newProduct });
        await Swal.fire({
          title: 'Success!',
          text: 'Product added successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      }
      onClose();
    } catch (error) {
      if (error instanceof ProductLimitError) {
        await Swal.fire({
          title: 'Product Limit Reached',
          text: 'You\'ve reached the 50 product limit on the Free plan. Upgrade to Growth for unlimited products.',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        return;
      }
      console.error('Error saving product:', error);
      await Swal.fire({
        title: 'Error!',
        text: 'Failed to save product. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    if (errors[name]) {
      setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = 'Product name is required';
    if (!formData.category.trim()) e.category = 'Category is required';
    if (!formData.sku.trim()) e.sku = 'SKU is required';
    if (formData.isWeightBased) {
      if (!formData.pricePerUnit || parseFloat(formData.pricePerUnit) <= 0) e.pricePerUnit = 'Valid price per unit required';
    } else {
      if (!formData.price || parseFloat(formData.price) <= 0) e.price = 'Valid price required';
    }
    if (!formData.cost || parseFloat(formData.cost) < 0) e.cost = 'Valid cost required';
    if (formData.trackInventory) {
      if (!formData.stock || parseInt(formData.stock) < 0) e.stock = 'Valid stock quantity required';
      if (!formData.minStock || parseInt(formData.minStock) < 0) e.minStock = 'Valid minimum stock required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          image: event.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addBatch = () => {
    const newBatch: ProductBatch = {
      id: Date.now().toString(),
      batchNumber: `BATCH-${Date.now().toString().slice(-6)}`,
      manufacturingDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      quantity: 0,
      costPrice: parseFloat(formData.cost) || 0,
      supplierInfo: '',
    };
    setBatches(prev => [...prev, newBatch]);
  };

  const updateBatch = (index: number, field: keyof ProductBatch, value: string | number | Date | boolean) => {
    setBatches(prev => prev.map((batch, i) => 
      i === index ? { ...batch, [field]: value } : batch
    ));
  };

  const removeBatch = (index: number) => {
    setBatches(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-xl">
        <div className="modal-header">
          <h2 className="text-xl font-bold text-secondary-900 font-fraunces">
            {product ? 'Edit Product' : 'Add New Product'}
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
            <h3 className="text-lg font-semibold text-secondary-900 mb-4 font-fraunces">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className={`input ${errors.name ? 'border-danger-500' : ''}`}
                  placeholder="Enter product name"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'error-name' : undefined}
                />
                {errors.name && <p id="error-name" className="text-danger-600 text-xs mt-1" role="alert">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Category *
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className={`select ${errors.category ? 'border-danger-500' : ''}`}
                  aria-invalid={!!errors.category}
                  aria-describedby={errors.category ? 'error-category' : undefined}
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                  {formData.category && !categories.some(c => c.name === formData.category) && (
                    <option value={formData.category}>{formData.category} (inactive/legacy)</option>
                  )}
                </select>
                {errors.category && <p id="error-category" className="text-danger-600 text-xs mt-1" role="alert">{errors.category}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  SKU *
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  required
                  className={`input ${errors.sku ? 'border-danger-500' : ''}`}
                  placeholder="Enter SKU"
                  aria-invalid={!!errors.sku}
                  aria-describedby={errors.sku ? 'error-sku' : undefined}
                />
                {errors.sku && <p id="error-sku" className="text-danger-600 text-xs mt-1" role="alert">{errors.sku}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Barcode
                </label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  className="input"
                  placeholder="Enter barcode"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="textarea"
                  placeholder="Enter product description"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-4 font-fraunces">Pricing & Stock</h3>
            
            <div className="mb-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="isWeightBased"
                  checked={formData.isWeightBased}
                  onChange={handleChange}
                  className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500 h-5 w-5"
                />
                <div className="flex items-center space-x-2">
                  <Scale className="h-4 w-4 text-secondary-500" />
                  <span className="text-sm font-medium text-secondary-700">Weight-based pricing</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formData.isWeightBased ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Price per Unit *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="pricePerUnit"
                      value={formData.pricePerUnit}
                      onChange={handleChange}
                      required
                      className={`input ${errors.pricePerUnit ? 'border-danger-500' : ''}`}
                      placeholder="0.00"
                      aria-invalid={!!errors.pricePerUnit}
                      aria-describedby={errors.pricePerUnit ? 'error-pricePerUnit' : undefined}
                    />
                    {errors.pricePerUnit && <p id="error-pricePerUnit" className="text-danger-600 text-xs mt-1" role="alert">{errors.pricePerUnit}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Unit *
                    </label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      className="select"
                    >
                      <option value="kg">Kilogram (kg)</option>
                      <option value="g">Gram (g)</option>
                      <option value="lb">Pound (lb)</option>
                      <option value="oz">Ounce (oz)</option>
                      <option value="l">Liter (l)</option>
                      <option value="ml">Milliliter (ml)</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Sale Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    className={`input ${errors.price ? 'border-danger-500' : ''}`}
                    placeholder="0.00"
                    aria-invalid={!!errors.price}
                    aria-describedby={errors.price ? 'error-price' : undefined}
                  />
                  {errors.price && <p id="error-price" className="text-danger-600 text-xs mt-1" role="alert">{errors.price}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Cost Price *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  required
                  className={`input ${errors.cost ? 'border-danger-500' : ''}`}
                  placeholder="0.00"
                  aria-invalid={!!errors.cost}
                  aria-describedby={errors.cost ? 'error-cost' : undefined}
                />
                {errors.cost && <p id="error-cost" className="text-danger-600 text-xs mt-1" role="alert">{errors.cost}</p>}
              </div>
            </div>

            <div className="mt-6 mb-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="trackInventory"
                  checked={formData.trackInventory}
                  onChange={handleChange}
                  className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500 h-5 w-5"
                />
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-secondary-700">Track inventory for this product</span>
                </div>
              </label>
              <p className="text-xs text-secondary-500 mt-1 ml-8">
                When disabled, stock levels won't be managed and inventory won't be deducted during sales
              </p>
            </div>

            {formData.trackInventory && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Current Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    required
                    className={`input ${errors.stock ? 'border-danger-500' : ''}`}
                    placeholder="0"
                    aria-invalid={!!errors.stock}
                    aria-describedby={errors.stock ? 'error-stock' : undefined}
                  />
                  {errors.stock && <p id="error-stock" className="text-danger-600 text-xs mt-1" role="alert">{errors.stock}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Minimum Stock Level *
                  </label>
                  <input
                    type="number"
                    min="0"
                    name="minStock"
                    value={formData.minStock}
                    onChange={handleChange}
                    required
                    className={`input ${errors.minStock ? 'border-danger-500' : ''}`}
                    placeholder="0"
                    aria-invalid={!!errors.minStock}
                    aria-describedby={errors.minStock ? 'error-minStock' : undefined}
                  />
                  {errors.minStock && <p id="error-minStock" className="text-danger-600 text-xs mt-1" role="alert">{errors.minStock}</p>}
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-4 font-fraunces">Product Image</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Upload Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="input"
                />
              </div>
              
              {formData.image && (
                <div className="flex items-center space-x-4">
                  <img
                    src={formData.image}
                    alt="Product preview"
                    className="h-20 w-20 object-cover rounded-xl border border-secondary-200"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                    className="btn btn-secondary btn-sm"
                  >
                    Remove Image
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-secondary-900 font-fraunces">Batch Management</h3>
                <p className="text-sm text-secondary-600">Track manufacturing and expiry dates for better inventory control</p>
              </div>
              <button
                type="button"
                onClick={addBatch}
                className="btn btn-primary btn-sm"
              >
                Add Batch
              </button>
            </div>
            
            {batches.length > 0 && (
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {batches.map((batch, index) => (
                  <div key={batch.id} className="card p-4 border border-secondary-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">
                          Batch Number
                        </label>
                        <input
                          type="text"
                          value={batch.batchNumber}
                          onChange={(e) => updateBatch(index, 'batchNumber', e.target.value)}
                          className="input input-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">
                          Manufacturing Date
                        </label>
                        <input
                          type="date"
                          value={batch.manufacturingDate.toISOString().split('T')[0]}
                          onChange={(e) => updateBatch(index, 'manufacturingDate', new Date(e.target.value))}
                          className="input input-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          value={batch.expiryDate.toISOString().split('T')[0]}
                          onChange={(e) => updateBatch(index, 'expiryDate', new Date(e.target.value))}
                          className="input input-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={batch.quantity}
                          onChange={(e) => updateBatch(index, 'quantity', parseInt(e.target.value))}
                          className="input input-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">
                          Cost Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={batch.costPrice}
                          onChange={(e) => updateBatch(index, 'costPrice', parseFloat(e.target.value))}
                          className="input input-sm"
                        />
                      </div>
                      
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeBatch(index)}
                          className="btn btn-danger btn-sm w-full"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-secondary-200 pt-6">
            <div className="flex space-x-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="taxable"
                  checked={formData.taxable}
                  onChange={handleChange}
                  className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500 h-5 w-5"
                />
                <span className="ml-2 text-sm text-secondary-700">Taxable</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500 h-5 w-5"
                />
                <span className="ml-2 text-sm text-secondary-700">Active</span>
              </label>
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
            {product ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}