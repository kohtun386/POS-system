import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, Plus, Minus, User, Percent, FileText, ShoppingCart } from 'lucide-react';
import { CartItem, Customer } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';

interface CartProps {
  onCheckout: () => void;
  onSaveDraft: () => void;
}

export function Cart({ onCheckout, onSaveDraft }: CartProps) {
  const { state, dispatch } = useApp();
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const isTouchMode = state.settings.interfaceMode === 'touch';

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      dispatch({ type: 'REMOVE_FROM_CART', payload: index });
    } else {
      const item = state.cart[index];
      const price = item.product.isWeightBased
        ? (item.product.pricePerUnit || 0) * (item.weight || 1)
        : item.product.price;
      const updatedItem = {
        ...item,
        quantity: newQuantity,
        subtotal: (price * newQuantity) - (item.discount || 0)
      };
      dispatch({ type: 'UPDATE_CART_ITEM', payload: { index, item: updatedItem } });
    }
  };

  const removeFromCart = (index: number) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: index });
  };

  const applyDiscount = (index: number, discount: number, discountType: 'percentage' | 'fixed') => {
    const item = state.cart[index];
    const price = item.product.isWeightBased
      ? (item.product.pricePerUnit || 0) * (item.weight || 1)
      : item.product.price;
    let discountAmount = 0;

    if (discountType === 'percentage') {
      discountAmount = (price * item.quantity * discount) / 100;
    } else {
      discountAmount = discount;
    }

    const updatedItem = {
      ...item,
      discount: discountAmount,
      discountType,
      subtotal: (price * item.quantity) - discountAmount
    };

    dispatch({ type: 'UPDATE_CART_ITEM', payload: { index, item: updatedItem } });
  };

  const selectCustomer = (customer: Customer) => {
    dispatch({ type: 'SET_SELECTED_CUSTOMER', payload: customer });
    setShowCustomerSearch(false);
    setCustomerSearch('');
  };

  const filteredCustomers = state.customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.phone.includes(customerSearch)
  );

  const subtotal = state.cart.reduce((sum, item) => {
    const price = item.product.isWeightBased
      ? (item.product.pricePerUnit || 0) * (item.weight || 1)
      : item.product.price;
    return sum + (price * item.quantity);
  }, 0);
  const totalDiscount = state.cart.reduce((sum, item) => sum + (item.discount || 0), 0);
  const taxAmount = (subtotal - totalDiscount) * (state.settings.taxRate / 100);
  const total = subtotal - totalDiscount + taxAmount;

  return (
    <div className={`bg-secondary-50 dark:bg-primary-950 border-l border-secondary-200 dark:border-secondary-800 flex flex-col flex-1 min-h-0 ${
      isTouchMode ? 'w-full md:w-64 lg:w-96' : 'w-full md:w-64 lg:w-80'
    }`}>
      {/* Cart Header */}
      <div className="p-4 lg:p-6 border-b-2 border-primary-600/20 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="h-5 w-5 text-primary-600" />
              {state.cart.length > 0 && (
                <motion.span
                  key={state.cart.length}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 bg-accent-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center"
                >
                  {state.cart.reduce((sum, item) => sum + item.quantity, 0)}
                </motion.span>
              )}
            </div>
            <h2 className="font-bold text-lg text-secondary-900 dark:text-secondary-100">
              Cart
            </h2>
          </div>
          {state.cart.length > 0 && (
            <button
              onClick={() => {
                state.cart.forEach((_, i) => dispatch({ type: 'REMOVE_FROM_CART', payload: 0 }));
              }}
              className="text-xs text-secondary-400 hover:text-danger-600 transition-colors px-2 py-1 rounded-lg hover:bg-[#fee2e2]"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Customer Selection */}
        <div className="relative">
          {state.selectedCustomer ? (
            <div className="card p-4 border-[#bbf7d0] bg-[#f0fdf4]/50 dark:border-success-800/50 dark:bg-success-900/20">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-success-800 dark:text-[#86efac] truncate ${isTouchMode ? 'text-base' : 'text-sm'}`}>
                    {state.selectedCustomer.name}
                  </p>
                  <p className={`text-success-600 dark:text-[#4ade80] truncate ${isTouchMode ? 'text-sm' : 'text-xs'}`}>
                    {state.selectedCustomer.email}
                  </p>
                </div>
                <button
                  onClick={() => dispatch({ type: 'SET_SELECTED_CUSTOMER', payload: null })}
                  className="text-success-600 hover:text-success-700 p-1 rounded-lg hover:bg-[#dcfce7] transition-colors flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomerSearch(true)}
              className={`btn btn-secondary w-full ${
                isTouchMode ? 'btn-lg touch-friendly' : 'btn-md'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Select Customer</span>
            </button>
          )}

          {/* Customer Search Dropdown */}
          {showCustomerSearch && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-secondary-50 dark:bg-surface-dark border border-secondary-200 dark:border-secondary-800 rounded-2xl shadow-large z-50 max-h-64 overflow-hidden animate-slide-up">
              <div className="p-4">
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="input input-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    className="w-full text-left p-4 hover:bg-secondary-100 dark:hover:bg-primary-900 border-t border-secondary-200/50 dark:border-secondary-800/50 transition-colors"
                  >
                    <p className="font-medium text-sm text-secondary-900 dark:text-secondary-100 truncate">{customer.name}</p>
                    <p className="text-xs text-secondary-600 dark:text-secondary-300 truncate">{customer.email}</p>
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="p-4 text-center text-secondary-600 dark:text-secondary-300 text-sm">
                    No customers found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6 space-y-4 cart-scrollbar">
        {state.cart.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-secondary-100 dark:bg-primary-900 p-6 rounded-3xl inline-block mb-4 animate-pulse-gentle">
              <ShoppingCart className="h-16 w-16 text-secondary-400" />
            </div>
            <p className="text-secondary-600 dark:text-secondary-300 font-medium">Your cart is empty</p>
            <p className="text-secondary-400 text-sm mt-1">Tap a product to add it here</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {state.cart.map((item, index) => (
              <motion.div
                key={`${item.product.id}-${index}`}
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: 8, marginBottom: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <CartItemCard
                  item={item}
                  index={index}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeFromCart}
                  onApplyDiscount={applyDiscount}
                  isTouchMode={isTouchMode}
                  currency={state.settings.currency}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Cart Summary */}
      <AnimatePresence>
        {state.cart.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="border-t border-secondary-200 dark:border-secondary-800 p-4 lg:p-6 space-y-6 bg-gradient-to-r from-primary-50 to-secondary-50 dark:bg-surface-dark flex-shrink-0"
          >
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-secondary-600 dark:text-secondary-300">Subtotal</span>
              <span className="font-medium text-secondary-900 dark:text-secondary-100 tabular-nums">{state.settings.currency} {subtotal.toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-success-600">Discount</span>
                <span className="font-medium text-success-600 tabular-nums">-{state.settings.currency} {totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-secondary-600 dark:text-secondary-300">Tax ({state.settings.taxRate}%)</span>
              <span className="font-medium text-secondary-900 dark:text-secondary-100 tabular-nums">{state.settings.currency} {taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-3 mt-1 border-t-2 border-primary-600/15">
              <span className="text-base font-semibold text-secondary-900 dark:text-secondary-100">Total</span>
              <motion.span
                key={total.toFixed(2)}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                className="text-2xl font-bold text-primary-600 dark:text-primary-400 tabular-nums"
              >
                {state.settings.currency} {total.toFixed(2)}
              </motion.span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onCheckout}
              disabled={state.cart.length === 0}
              className={`btn btn-accent w-full shadow-lg ${
                isTouchMode ? 'btn-lg touch-friendly' : 'btn-lg'
              }`}
            >
              Checkout
            </button>

            <button
              onClick={onSaveDraft}
              disabled={state.cart.length === 0}
              className={`btn btn-ghost w-full ${
                isTouchMode ? 'btn-md touch-friendly' : 'btn-md'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Save Draft</span>
            </button>
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CartItemCardProps {
  item: CartItem;
  index: number;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemove: (index: number) => void;
  onApplyDiscount: (index: number, discount: number, type: 'percentage' | 'fixed') => void;
  isTouchMode: boolean;
  currency: string;
}

function CartItemCard({ item, index, onUpdateQuantity, onRemove, onApplyDiscount, isTouchMode, currency }: CartItemCardProps) {
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');

  const handleDiscountSubmit = () => {
    const value = parseFloat(discountValue);
    if (!isNaN(value) && value > 0) {
      onApplyDiscount(index, value, discountType);
      setShowDiscountInput(false);
      setDiscountValue('');
    }
  };

  return (
    <motion.div layout className="card p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-secondary-900 dark:text-secondary-100 truncate ${isTouchMode ? 'text-base' : 'text-sm'}`}>
            {item.product.name}
          </h4>
          <p className={`text-secondary-600 dark:text-secondary-300 ${isTouchMode ? 'text-sm' : 'text-xs'}`}>
            {item.product.isWeightBased ? (
              <>
                {currency} {item.product.pricePerUnit?.toFixed(2)} per {item.product.unit}
                {item.weight && <span className="ml-2">({item.weight} {item.product.unit})</span>}
              </>
            ) : (
              <>{currency} {item.product.price.toFixed(2)} each</>
            )}
          </p>
          {item.discount > 0 && (
            <p className="text-success-600 text-xs font-medium">
              Discount: {item.discountType === 'percentage' ? `${item.discount}%` : `${currency} ${item.discount.toFixed(2)}`}
            </p>
          )}
        </div>
        <button
          onClick={() => onRemove(index)}
          className="text-danger-600 hover:text-danger-700 p-2 rounded-lg hover:bg-[#fee2e2] transition-colors flex-shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdateQuantity(index, item.quantity - 1)}
            className="qty-btn"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4 text-secondary-600" />
          </button>
          <motion.span
            key={item.quantity}
            initial={{ scale: 1.3, color: '#f57323' }}
            animate={{ scale: 1, color: '#473b32' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`font-bold min-w-[2.5rem] text-center tabular-nums ${
              isTouchMode ? 'text-xl' : 'text-lg'
            }`}
          >
            {item.quantity}
          </motion.span>
          <button
            onClick={() => onUpdateQuantity(index, item.quantity + 1)}
            className="qty-btn"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4 text-secondary-600" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiscountInput(!showDiscountInput)}
            className={`p-1.5 rounded-lg transition-colors ${
              showDiscountInput
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-400'
                : 'text-secondary-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900'
            }`}
            aria-label="Apply discount"
          >
            <Percent className="h-4 w-4" />
          </button>
          <span className={`font-bold text-secondary-900 dark:text-secondary-100 tabular-nums ${isTouchMode ? 'text-base' : 'text-sm'}`}>
            {currency} {item.subtotal.toFixed(2)}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {showDiscountInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center space-x-2 pt-3 border-t border-secondary-200 dark:border-secondary-800 overflow-hidden"
          >
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
            className="select text-xs w-20"
          >
            <option value="percentage">%</option>
            <option value="fixed">{currency}</option>
          </select>
          <input
            type="number"
            placeholder="Discount"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className="input input-sm flex-1"
          />
          <button
            onClick={handleDiscountSubmit}
            className="btn btn-primary btn-sm"
          >
            Apply
          </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
