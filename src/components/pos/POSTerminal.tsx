import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { ProductGrid } from './ProductGrid';
import { Cart } from './Cart';
import { CheckoutModal } from './CheckoutModal';
import { SalesTabManager } from './SalesTabManager';
import { Product, Sale } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { salesService } from '../../lib/services';
import { swalConfig } from '../../lib/sweetAlert';

export function POSTerminal() {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const [showCheckout, setShowCheckout] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);

  const addToCart = (product: Product, weight?: number) => {
    // Only check stock if inventory tracking is enabled
    if (product.trackInventory && product.stock <= 0) return;

    const existingItemIndex = state.cart.findIndex(item =>
      item.product.id === product.id &&
      (product.isWeightBased ? false : true) // For weight-based products, always add new item
    );

    if (existingItemIndex >= 0 && !product.isWeightBased) {
      const existingItem = state.cart[existingItemIndex];
      const newQuantity = existingItem.quantity + 1;

      // Only check stock limits if inventory tracking is enabled
      if (!product.trackInventory || newQuantity <= product.stock) {
        const updatedItem = {
          ...existingItem,
          quantity: newQuantity,
          subtotal: product.price * newQuantity - (existingItem.discount || 0)
        };
        dispatch({ type: 'UPDATE_CART_ITEM', payload: { index: existingItemIndex, item: updatedItem } });
      }
    } else {
      // For weight-based products or new items
      const quantity = product.isWeightBased ? 1 : 1;
      const itemWeight = weight || undefined;
      const price = product.isWeightBased ? (product.pricePerUnit || 0) * (weight || 1) : product.price;

      const newItem = {
        product,
        quantity,
        weight: itemWeight,
        discount: 0,
        discountType: 'percentage' as const,
        subtotal: price
      };
      dispatch({ type: 'ADD_TO_CART', payload: newItem });
    }

    // Close mobile cart after adding item so user sees product grid
    setShowMobileCart(false);

    // Update current sales tab
    if (state.activeSalesTab) {
      dispatch({
        type: 'UPDATE_SALES_TAB',
        payload: {
          id: state.activeSalesTab,
          updates: { cart: state.cart }
        }
      });
    }
  };

  const handleCheckout = () => {
    setShowCheckout(true);
  };

  const handleCheckoutComplete = (sale: Sale) => {
    setLastSale(sale);
    setShowCheckout(false);

    // Clear current tab after successful checkout
    if (state.activeSalesTab) {
      dispatch({
        type: 'UPDATE_SALES_TAB',
        payload: {
          id: state.activeSalesTab,
          updates: { cart: [], selectedCustomer: null }
        }
      });
    }
  };

  const saveDraft = async () => {
    if (state.cart.length === 0) return;

    try {
      const subtotal = state.cart.reduce((sum, item) => {
        const price = item.product.isWeightBased
          ? (item.product.pricePerUnit || 0) * (item.weight || 1)
          : item.product.price;
        return sum + (price * item.quantity);
      }, 0);
      const totalDiscount = state.cart.reduce((sum, item) => sum + (item.discount || 0), 0);
      const taxAmount = (subtotal - totalDiscount) * (state.settings.taxRate / 100);
      const total = subtotal - totalDiscount + taxAmount;

      const draftSale: Omit<Sale, 'id'> = {
        invoiceNumber: `DRAFT-${Date.now().toString().slice(-6)}`,
        customerId: state.selectedCustomer?.id,
        customerName: state.selectedCustomer?.name,
        items: state.cart,
        subtotal,
        discountAmount: totalDiscount,
        taxAmount,
        total,
        paymentMethod: 'cash',
        status: 'completed',
        cashier: user?.user_metadata?.full_name || user?.email || 'Unknown',
        timestamp: new Date(),
        receiptNumber: `DRAFT-${Date.now().toString().slice(-6)}`,
        notes: 'DRAFT_SALE - payment pending',
      };

      // Save to Supabase and update local state
      const savedDraft = await salesService.create(draftSale);
      dispatch({ type: 'ADD_SALE', payload: savedDraft });
      dispatch({ type: 'CLEAR_CART' });

      // Clear current tab
      if (state.activeSalesTab) {
        dispatch({
          type: 'UPDATE_SALES_TAB',
          payload: {
            id: state.activeSalesTab,
            updates: { cart: [], selectedCustomer: null }
          }
        });
      }

      swalConfig.success('Draft sale saved successfully!');
    } catch (error) {
      console.error('Error saving draft:', error);
      swalConfig.error('Failed to save draft. Please try again.');
    }
  };

  const cartItemCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex h-full bg-[#faf8f5] dark:bg-[#1f1309]">
      <SalesTabManager />
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <ProductGrid onAddToCart={addToCart} />

        {/* Desktop Cart (side panel) */}
        <div className="hidden md:block h-full">
          <Cart onCheckout={handleCheckout} onSaveDraft={saveDraft} />
        </div>

        {/* Mobile: Floating Cart Toggle Button */}
        <AnimatePresence>
          {cartItemCount > 0 && (
            <motion.button
              key="cart-fab"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={() => setShowMobileCart(true)}
              className="md:hidden fixed bottom-6 right-6 z-40 bg-gradient-to-r from-[#9a693a] to-[#7a4f2c] text-white h-14 w-14 rounded-full shadow-large flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-copper active:scale-95"
            >
              <ShoppingCart className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 bg-[#e55c13] text-white text-xs font-bold h-5 w-5 rounded-full flex items-center justify-center">
                {cartItemCount}
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Mobile: Cart Bottom Sheet */}
        <AnimatePresence>
          {showMobileCart && (
            <>
              <motion.div
                key="cart-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="md:hidden fixed inset-0 bg-black/40 z-40"
                onClick={() => setShowMobileCart(false)}
              />
              <motion.div
                key="cart-bottom-sheet"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl"
              >
                <div className="flex flex-col h-[60vh] bg-[#faf8f5] dark:bg-[#1f1309] rounded-t-2xl overflow-hidden">
                  <Cart
                    onCheckout={() => { setShowMobileCart(false); handleCheckout(); }}
                    onSaveDraft={saveDraft}
                    onClose={() => setShowMobileCart(false)}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          onComplete={handleCheckoutComplete}
        />
      </div>
    </div>
  );
}