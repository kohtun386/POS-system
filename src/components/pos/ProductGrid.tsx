import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Package, Scale, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Product } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';

interface ProductGridProps {
  onAddToCart: (product: Product, weight?: number) => void;
}

export function ProductGrid({ onAddToCart }: ProductGridProps) {
  const { state } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showWeightModal, setShowWeightModal] = useState<Product | null>(null);
  const [weight, setWeight] = useState('');
  const categoriesRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

  const filteredProducts = state.products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.barcode && product.barcode.includes(searchTerm));
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory && product.active;
  });

  const categories = useMemo(() => ['All', ...Array.from(new Set(state.products.map(p => p.category)))], [state.products]);
  const isTouchMode = state.settings.interfaceMode === 'touch';

  const checkScrollButtons = () => {
    if (categoriesRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = categoriesRef.current;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const categoriesElement = categoriesRef.current;
    if (categoriesElement) {
      categoriesElement.addEventListener('scroll', checkScrollButtons);
      return () => categoriesElement.removeEventListener('scroll', checkScrollButtons);
    }
  }, [categories]);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesRef.current) {
      const scrollAmount = 200;
      const currentScroll = categoriesRef.current.scrollLeft;
      const targetScroll = direction === 'left'
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount;

      categoriesRef.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  const handleProductClick = useCallback((product: Product) => {
    if (product.isWeightBased) {
      setShowWeightModal(product);
      setWeight('');
    } else {
      onAddToCart(product);
      setRecentlyAdded(product.id);
      setTimeout(() => setRecentlyAdded(null), 600);
    }
  }, [onAddToCart]);

  const handleWeightSubmit = () => {
    if (showWeightModal && weight && parseFloat(weight) > 0) {
      onAddToCart(showWeightModal, parseFloat(weight));
      setShowWeightModal(null);
      setWeight('');
    }
  };

  return (
    <>
      <div className="flex-1 min-w-0 flex flex-col bg-secondary-50 dark:bg-primary-950">
        {/* Search and Filter Bar */}
        <div className="p-4 lg:p-6 border-b border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-primary-950 overflow-x-hidden">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-secondary-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search products by name, SKU, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`input pl-12 ${isTouchMode ? 'h-14 text-lg' : 'h-12'}`}
              />
            </div>

            <div className="relative flex items-center">
              {/* Left scroll button */}
              {showLeftScroll && (
                <button
                  onClick={() => scrollCategories('left')}
                  className="absolute left-0 z-10 flex items-center justify-center w-8 h-8 bg-secondary-50 border border-secondary-200 rounded-full shadow-sm hover:bg-secondary-100 transition-all"
                >
                  <ChevronLeft className="h-4 w-4 text-secondary-600" />
                </button>
              )}

              {/* Categories container */}
              <div
                ref={categoriesRef}
                className="flex overflow-x-auto space-x-2 lg:space-x-3 max-w-xl scrollbar-hide scroll-smooth px-6"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`btn whitespace-nowrap transition-all flex-shrink-0 ${
                      selectedCategory === category
                        ? 'btn-primary'
                        : 'btn-secondary'
                    } ${isTouchMode ? 'btn-lg touch-friendly' : 'btn-md'}`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Right scroll button */}
              {showRightScroll && (
                <button
                  onClick={() => scrollCategories('right')}
                  className="absolute right-0 z-10 flex items-center justify-center w-8 h-8 bg-secondary-50 border border-secondary-200 rounded-full shadow-sm hover:bg-secondary-100 transition-all"
                >
                  <ChevronRight className="h-4 w-4 text-secondary-600" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          {filteredProducts.length === 0 && state.products.length === 0 && searchTerm === '' && selectedCategory === 'All' ? (
            <div className={`grid gap-4 lg:gap-6 ${
              isTouchMode
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
            }`}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`card ${isTouchMode ? 'p-4' : 'p-3'}`}>
                  <div className="flex flex-col h-full">
                    <div className="skeleton aspect-[4/3] max-h-[140px] rounded-2xl mb-4" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-3/4 rounded-lg" />
                      <div className="skeleton h-3 w-1/2 rounded-lg" />
                      <div className="flex items-center justify-between">
                        <div className="skeleton h-4 w-1/4 rounded-lg" />
                        <div className="skeleton h-3 w-1/6 rounded-lg" />
                      </div>
                    </div>
                    <div className="skeleton h-10 w-full rounded-2xl mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="bg-secondary-100 dark:bg-primary-900 p-6 rounded-3xl mb-4">
                <Package className="h-16 w-16 text-secondary-400" />
              </div>
              <p className="text-secondary-600 dark:text-secondary-300 text-lg font-medium">No products found</p>
              <p className="text-secondary-400 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className={`grid gap-4 lg:gap-6 ${
              isTouchMode
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
            }`}>
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleProductClick}
                  isTouchMode={isTouchMode}
                  currency={state.settings.currency}
                  isRecentlyAdded={recentlyAdded === product.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weight Input Modal */}
      {showWeightModal && (
        <div className="modal-overlay">
          <div className="modal max-w-sm">
            <div className="modal-header">
              <h3 className="text-lg font-bold text-secondary-900 dark:text-secondary-100 font-fraunces font-fraunces">Enter Weight</h3>
              <button
                onClick={() => setShowWeightModal(null)}
                className="text-secondary-400 hover:text-secondary-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div className="text-center">
                <div className="bg-primary-50 dark:bg-primary-900 p-4 rounded-2xl mb-4">
                  <Scale className="h-8 w-8 text-primary-600 mx-auto" />
                </div>
                <h4 className="font-semibold text-secondary-900 dark:text-secondary-100">{showWeightModal.name}</h4>
                <p className="text-sm text-secondary-600 dark:text-secondary-300">
                  {state.settings.currency} {showWeightModal.pricePerUnit?.toFixed(2)} per {showWeightModal.unit}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-900 dark:text-secondary-100 mb-2">
                  Weight ({showWeightModal.unit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="input"
                  placeholder={`Enter weight in ${showWeightModal.unit}`}
                  autoFocus
                />
              </div>

              {weight && parseFloat(weight) > 0 && (
                <div className="bg-primary-50 dark:bg-primary-900 p-3 rounded-xl">
                  <div className="flex justify-between text-sm text-secondary-900 dark:text-secondary-100">
                    <span>Total Price:</span>
                    <span className="font-semibold">
                      {state.settings.currency} {((showWeightModal.pricePerUnit || 0) * parseFloat(weight)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowWeightModal(null)}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </button>
              <button
                onClick={handleWeightSubmit}
                disabled={!weight || parseFloat(weight) <= 0}
                className="btn btn-primary btn-md disabled:opacity-50"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  isTouchMode: boolean;
  currency: string;
  isRecentlyAdded?: boolean;
}

function ProductCard({ product, onAddToCart, isTouchMode, currency, isRecentlyAdded }: ProductCardProps) {
  const shouldTrackInventory = product.trackInventory !== false;
  const isLowStock = shouldTrackInventory ? product.stock <= product.minStock : false;
  const isOutOfStock = shouldTrackInventory ? product.stock === 0 : false;

  return (
    <div
      className={`card card-hover cursor-pointer transition-all duration-200 hover:border-primary-300/60 ${
        isLowStock && !isOutOfStock ? 'border-[#fcd3a0] bg-[#fef7ee]/50' : ''
      } ${isOutOfStock ? 'border-[#fecaca] bg-[#fef2f2]/50 opacity-75' : ''} ${
        isTouchMode ? 'p-4' : 'p-3'
      }`}
      onClick={() => !isOutOfStock && onAddToCart(product)}
    >
      <div className="flex flex-col h-full">
        {/* Product Image */}
        <div className={`bg-secondary-100 dark:bg-primary-900 rounded-2xl mb-4 flex items-center justify-center relative overflow-hidden aspect-[4/3] max-h-[140px]`}>
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover rounded-2xl"
            />
          ) : (
            <Package className={`text-secondary-400 ${isTouchMode ? 'h-10 w-10' : 'h-8 w-8'}`} />
          )}

          {/* Weight-based indicator */}
          {product.isWeightBased && (
            <div className="absolute top-2 left-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center space-x-1">
              <Scale className="h-3 w-3" />
              <span>{product.unit}</span>
            </div>
          )}

          {/* Stock Status Badge */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-secondary-950/60 flex items-center justify-center rounded-2xl">
              <span className="text-secondary-100 font-semibold text-sm">Out of Stock</span>
            </div>
          )}

          {isLowStock && !isOutOfStock && (
            <div className="absolute bottom-2 right-2 bg-accent-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
              Low Stock
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 space-y-2">
          <h3 className={`font-medium text-secondary-900 dark:text-secondary-100 line-clamp-2 ${
            isTouchMode ? 'text-base' : 'text-sm'
          }`}>
            {product.name}
          </h3>

          <p className="text-xs text-secondary-600 dark:text-secondary-300">
            SKU: {product.sku}
          </p>

          <div className="flex items-center justify-between">
            <span className={`font-bold text-primary-600 dark:text-primary-400 ${isTouchMode ? 'text-lg' : 'text-base'}`}>
              {currency} {product.isWeightBased ? product.pricePerUnit?.toFixed(2) : product.price.toFixed(2)}
              {product.isWeightBased && <span className="text-xs text-secondary-600 dark:text-secondary-300">/{product.unit}</span>}
            </span>
            {shouldTrackInventory ? (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                isOutOfStock
                  ? 'bg-[#fecaca] text-danger-700 px-2 py-0.5 rounded-full'
                  : isLowStock
                    ? 'bg-[#fed7aa] text-accent-600 px-2 py-0.5 rounded-full'
                    : 'text-success-600'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  isOutOfStock ? 'bg-danger-700' : isLowStock ? 'bg-accent-600' : 'bg-success-600'
                }`} />
                {isOutOfStock ? 'Out' : `${product.stock}${product.isWeightBased ? product.unit : ''}`}
              </span>
            ) : (
              <span className="text-xs text-secondary-600 dark:text-secondary-300">Unlimited</span>
            )}
          </div>
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isOutOfStock) onAddToCart(product);
          }}
          disabled={isOutOfStock}
          className={`btn w-full mt-3 transition-all duration-200 flex items-center justify-center gap-2 ${
            isRecentlyAdded
              ? 'btn-success'
              : isOutOfStock
                ? 'bg-secondary-200 text-secondary-600 cursor-not-allowed dark:bg-secondary-800 dark:text-secondary-300'
                : 'btn-primary'
          } ${isTouchMode ? 'btn-lg touch-friendly' : 'btn-md py-2.5'}`}
        >
          {isRecentlyAdded ? (
            <Check className={`${isTouchMode ? 'h-5 w-5' : 'h-4 w-4'}`} />
          ) : product.isWeightBased ? (
            <Scale className={`${isTouchMode ? 'h-5 w-5' : 'h-4 w-4'}`} />
          ) : (
            <Plus className={`${isTouchMode ? 'h-5 w-5' : 'h-4 w-4'}`} />
          )}
          <span>{isRecentlyAdded ? 'Added!' : isOutOfStock ? 'Out of Stock' : product.isWeightBased ? 'Enter Weight' : 'Add to Cart'}</span>
        </button>
      </div>
    </div>
  );
}
