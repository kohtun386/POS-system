import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Package, Scale, X, Plus, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../../types';
import { useApp } from '../../hooks/useApp';
import { DEFAULT_CURRENCY } from '../../lib/constants';

interface MobileProductListProps {
  onAddToCart: (product: Product, weight?: number) => void;
}

export function MobileProductList({ onAddToCart }: MobileProductListProps) {
  const { state } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showWeightModal, setShowWeightModal] = useState<Product | null>(null);
  const [weight, setWeight] = useState('');
  const categoriesRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const recentlyAddedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (recentlyAddedTimeout.current) clearTimeout(recentlyAddedTimeout.current);
    };
  }, []);

  const filteredProducts = state.products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.barcode && product.barcode.includes(searchTerm));
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory && product.active;
  });

  const categories = useMemo(() => ['All', ...Array.from(new Set(state.products.map(p => p.category)))], [state.products]);

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
      const scrollAmount = 160;
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

  const handleProductAdd = useCallback((product: Product) => {
    if (product.isWeightBased) {
      setShowWeightModal(product);
      setWeight('');
    } else {
      onAddToCart(product);
      setRecentlyAdded(product.id);
      if (recentlyAddedTimeout.current) clearTimeout(recentlyAddedTimeout.current);
      recentlyAddedTimeout.current = setTimeout(() => setRecentlyAdded(null), 600);
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
        <div className="p-4 border-b border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-primary-950 overflow-x-hidden">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-secondary-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-12 h-14 text-lg touch-friendly"
            />
          </div>

          <div className="relative flex items-center mt-3">
            {showLeftScroll && (
              <button
                onClick={() => scrollCategories('left')}
                className="absolute left-0 z-10 flex items-center justify-center min-w-[44px] min-h-[44px] bg-secondary-50 border border-secondary-200 rounded-full shadow-sm hover:bg-secondary-100 transition-all"
                aria-label="Scroll categories left"
              >
                <ChevronLeft className="h-4 w-4 text-secondary-600" />
              </button>
            )}

            <div
              ref={categoriesRef}
              className="flex overflow-x-auto space-x-2 max-w-full scrollbar-hide scroll-smooth px-6"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`btn whitespace-nowrap transition-all flex-shrink-0 btn-lg touch-friendly ${
                    selectedCategory === category
                      ? 'btn-primary'
                      : 'btn-secondary'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {showRightScroll && (
              <button
                onClick={() => scrollCategories('right')}
                className="absolute right-0 z-10 flex items-center justify-center min-w-[44px] min-h-[44px] bg-secondary-50 border border-secondary-200 rounded-full shadow-sm hover:bg-secondary-100 transition-all"
                aria-label="Scroll categories right"
              >
                <ChevronRight className="h-4 w-4 text-secondary-600" />
              </button>
            )}
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 && state.products.length === 0 && searchTerm === '' && selectedCategory === 'All' ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-4">
                  <div className="flex items-center space-x-3">
                    <div className="skeleton h-12 w-12 rounded-2xl flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-2/3 rounded-xl" />
                      <div className="skeleton h-3 w-1/3 rounded-xl" />
                    </div>
                    <div className="skeleton h-10 w-24 rounded-2xl" />
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
            <ul className="space-y-3">
              {filteredProducts.map((product) => (
                <MobileProductRow
                  key={product.id}
                  product={product}
                  onAdd={handleProductAdd}
                  currency={DEFAULT_CURRENCY}
                  isRecentlyAdded={recentlyAdded === product.id}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Weight Input Modal */}
      {showWeightModal && (
        <div className="modal-overlay">
          <div className="modal max-w-sm">
            <div className="modal-header">
              <h3 className="text-lg font-bold text-secondary-900 dark:text-secondary-100 font-fraunces">Enter Weight</h3>
              <button
                onClick={() => setShowWeightModal(null)}
                className="text-secondary-400 hover:text-secondary-600 touch-friendly"
                aria-label="Close weight modal"
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
                  {DEFAULT_CURRENCY} {showWeightModal.pricePerUnit?.toFixed(2)} per {showWeightModal.unit}
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
                      {DEFAULT_CURRENCY} {((showWeightModal.pricePerUnit || 0) * parseFloat(weight)).toFixed(2)}
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

interface MobileProductRowProps {
  product: Product;
  onAdd: (product: Product) => void;
  currency: string;
  isRecentlyAdded?: boolean;
}

const MobileProductRow = ({ product, onAdd, currency, isRecentlyAdded }: MobileProductRowProps) => {
  const shouldTrackInventory = product.trackInventory !== false;
  const isLowStock = shouldTrackInventory ? (product.stock ?? 0) <= (product.minStock ?? 0) : false;
  const isOutOfStock = shouldTrackInventory ? product.stock === 0 : false;

  return (
    <li className={`card p-4 flex items-center space-x-3 transition-all duration-200 ${
      isOutOfStock ? 'opacity-75' : ''
    }`}>
      {/* Product image / icon */}
      <div className="h-12 w-12 flex-shrink-0 bg-secondary-100 dark:bg-primary-900 rounded-2xl flex items-center justify-center overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="h-6 w-6 text-secondary-400" />
        )}
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-secondary-900 dark:text-secondary-100 text-sm leading-tight line-clamp-2">
          {product.name}
        </h3>
        <div className="mt-1 flex items-center space-x-2">
          <span className="font-bold text-primary-600 dark:text-primary-400 text-base">
            {currency} {product.isWeightBased ? product.pricePerUnit?.toFixed(2) : product.price.toFixed(2)}
            {product.isWeightBased && <span className="text-xs text-secondary-600 dark:text-secondary-300">/{product.unit}</span>}
          </span>
          {shouldTrackInventory ? (
            <span className={`badge ${
              isOutOfStock
                ? 'badge-danger'
                : isLowStock
                  ? 'badge-warning'
                  : 'badge-success'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                isOutOfStock ? 'bg-danger-700' : isLowStock ? 'bg-warning-600' : 'bg-success-600'
              }`} />
              {isOutOfStock ? 'Out' : `${product.stock}${product.isWeightBased ? product.unit : ''}`}
            </span>
          ) : (
            <span className="text-xs text-secondary-600 dark:text-secondary-300">Unlimited</span>
          )}
        </div>
      </div>

      {/* Add button */}
      <button
        onClick={() => !isOutOfStock && onAdd(product)}
        disabled={isOutOfStock}
        className={`btn btn-sm touch-friendly flex-shrink-0 transition-all duration-200 ${
          isRecentlyAdded
            ? 'btn-success'
            : isOutOfStock
              ? 'bg-secondary-200 text-secondary-600 cursor-not-allowed dark:bg-secondary-800 dark:text-secondary-300'
              : 'btn-primary'
        }`}
        aria-label={isRecentlyAdded ? 'Added' : `Add ${product.name} to cart`}
      >
        {isRecentlyAdded ? (
          <Check className="h-4 w-4" />
        ) : product.isWeightBased ? (
          <Scale className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        <span>{isRecentlyAdded ? 'Added!' : product.isWeightBased ? 'Weight' : 'Add'}</span>
      </button>
    </li>
  );
};
