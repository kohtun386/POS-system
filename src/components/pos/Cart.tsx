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
    <div className={`bg-[#faf8f5] dark:bg-[#1f1309] border-l border-[#ded7cc] dark:border-[#54463b] flex flex-col flex-1 min-h-0 ${
      isTouchMode ? 'w-full md:w-64 lg:w-96' : 'w-full md:w-64 lg:w-80'
    }`}>
      {/* Cart Header */}
      <div className="p-4 lg:p-6 border-b-2 border-[#9a693a]/20 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="h-5 w-5 text-[#9a693a]" />
              {state.cart.length > 0 && (
                <motion.span
                  key={state.cart.length}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 bg-[#f57323] text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center"
                >
                  {state.cart.reduce((sum, item) => sum + item.quantity, 0)}
                </motion.span>
              )}
            </div>
            <h2 className="font-bold text-lg text-[#473b32] dark:text-[#f0ece5]">
              Cart
            </h2>
          </div>
          {state.cart.length > 0 && (
            <button
              onClick={() => {
                state.cart.forEach((_, i) => dispatch({ type: 'REMOVE_FROM_CART', payload: 0 }));
              }}
              className="text-xs text-[#ad9e8a] hover:text-[#dc2626] transition-colors px-2 py-1 rounded-lg hover:bg-[#fee2e2]"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Customer Selection */}
        <div className="relative">
          {state.selectedCustomer ? (
            <div className="card p-4 border-[#bbf7d0] bg-[#f0fdf4]/50 dark:border-[#166534]/50 dark:bg-[#14532d]/20">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-[#166534] dark:text-[#86efac] truncate ${isTouchMode ? 'text-base' : 'text-sm'}`}>
                    {state.selectedCustomer.name}
                  </p>
                  <p className={`text-[#16a34a] dark:text-[#4ade80] truncate ${isTouchMode ? 'text-sm' : 'text-xs'}`}>
                    {state.selectedCustomer.email}
                  </p>
                </div>
                <button
                  onClick={() => dispatch({ type: 'SET_SELECTED_CUSTOMER', payload: null })}
                  className="text-[#16a34a] hover:text-[#15803d] p-1 rounded-lg hover:bg-[#dcfce7] transition-colors flex-shrink-0"
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
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#faf8f5] dark:bg-[#2a1a10] border border-[#ded7cc] dark:border-[#54463b] rounded-2xl shadow-large z-50 max-h-64 overflow-hidden animate-slide-up">
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
                    className="w-full text-left p-4 hover:bg-[#f0ece5] dark:hover:bg-[#3b2613] border-t border-[#ded7cc]/50 dark:border-[#54463b]/50 transition-colors"
                  >
                    <p className="font-medium text-sm text-[#473b32] dark:text-[#f0ece5] truncate">{customer.name}</p>
                    <p className="text-xs text-[#7d6b57] dark:text-[#c6bbab] truncate">{customer.email}</p>
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="p-4 text-center text-[#7d6b57] dark:text-[#c6bbab] text-sm">
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
            <div className="bg-[#f0ece5] dark:bg-[#3b2613] p-6 rounded-3xl inline-block mb-4 animate-pulse-gentle">
              <ShoppingCart className="h-16 w-16 text-[#ad9e8a]" />
            </div>
            <p className="text-[#7d6b57] dark:text-[#c6bbab] font-medium">Your cart is empty</p>
            <p className="text-[#ad9e8a] text-sm mt-1">Tap a product to add it here</p>
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
            className="border-t border-[#ded7cc] dark:border-[#54463b] p-4 lg:p-6 space-y-6 bg-gradient-to-r from-[#fcf5eb] to-[#faf8f5] dark:bg-[#2a1a10] flex-shrink-0"
          >
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-[#7d6b57] dark:text-[#c6bbab]">Subtotal</span>
              <span className="font-medium text-[#473b32] dark:text-[#f0ece5] tabular-nums">{state.settings.currency} {subtotal.toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#16a34a]">Discount</span>
                <span className="font-medium text-[#16a34a] tabular-nums">-{state.settings.currency} {totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[#7d6b57] dark:text-[#c6bbab]">Tax ({state.settings.taxRate}%)</span>
              <span className="font-medium text-[#473b32] dark:text-[#f0ece5] tabular-nums">{state.settings.currency} {taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-3 mt-1 border-t-2 border-[#9a693a]/15">
              <span className="text-base font-semibold text-[#473b32] dark:text-[#f0ece5]">Total</span>
              <motion.span
                key={total.toFixed(2)}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                className="text-2xl font-bold text-[#9a693a] dark:text-[#cfa16a] tabular-nums"
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
          <h4 className={`font-medium text-[#473b32] dark:text-[#f0ece5] truncate ${isTouchMode ? 'text-base' : 'text-sm'}`}>
            {item.product.name}
          </h4>
          <p className={`text-[#7d6b57] dark:text-[#c6bbab] ${isTouchMode ? 'text-sm' : 'text-xs'}`}>
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
            <p className="text-[#16a34a] text-xs font-medium">
              Discount: {item.discountType === 'percentage' ? `${item.discount}%` : `${currency} ${item.discount.toFixed(2)}`}
            </p>
          )}
        </div>
        <button
          onClick={() => onRemove(index)}
          className="text-[#dc2626] hover:text-[#b91c1c] p-2 rounded-lg hover:bg-[#fee2e2] transition-colors flex-shrink-0"
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
            <Minus className="h-4 w-4 text-[#7d6b57]" />
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
            <Plus className="h-4 w-4 text-[#7d6b57]" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiscountInput(!showDiscountInput)}
            className={`p-1.5 rounded-lg transition-colors ${
              showDiscountInput
                ? 'bg-[#fcf5eb] text-[#9a693a] dark:bg-[#3b2613] dark:text-[#cfa16a]'
                : 'text-[#ad9e8a] hover:text-[#9a693a] hover:bg-[#fcf5eb] dark:hover:bg-[#3b2613]'
            }`}
            aria-label="Apply discount"
          >
            <Percent className="h-4 w-4" />
          </button>
          <span className={`font-bold text-[#473b32] dark:text-[#f0ece5] tabular-nums ${isTouchMode ? 'text-base' : 'text-sm'}`}>
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
            className="flex items-center space-x-2 pt-3 border-t border-[#ded7cc] dark:border-[#54463b] overflow-hidden"
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
