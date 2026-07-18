import { useState, useEffect, Suspense } from 'react';
import { ShoppingCart, ChevronUp, X } from 'lucide-react';
import { ProductGrid } from './ProductGrid';
import { Cart } from './Cart';
import { CheckoutModal } from './CheckoutModal';
import { SalesTabManager } from './SalesTabManager';
import { Product, CartItem, Sale } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { salesService } from '../../lib/services';
import { swalConfig } from '../../lib/sweetAlert';
import { ReportsManager } from '../../lazyComponents';
import { DEFAULT_CURRENCY } from '../../lib/constants';

export function POSTerminal() {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const [showCheckout, setShowCheckout] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  const handleCheckoutComplete = () => {
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

  // On mobile (< 768px), admin/manager see the dashboard, not POS
  if (isMobile && state.currentUser?.role !== 'cashier') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-full text-secondary-400">Loading dashboard...</div>}>
        <ReportsManager />
      </Suspense>
    );
  }

  return (
    <div className="flex h-full bg-secondary-50 dark:bg-primary-950">
      <SalesTabManager />
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* ProductGrid gets bottom padding on mobile for floating cart bar */}
        <div className="flex-1 min-h-0 pb-20 md:pb-0">
          <ProductGrid onAddToCart={addToCart} />
        </div>

        {/* Cart — side panel on desktop, hidden on mobile */}
        <div className="hidden md:flex md:flex-shrink-0 md:flex-col min-h-0">
          <Cart onCheckout={handleCheckout} onSaveDraft={saveDraft} />
        </div>
      </div>

      {/* Mobile Cart — floating bar + full-screen overlay (cashiers only) */}
      {isMobile && state.currentUser?.role === 'cashier' && (
        <>
          <MobileCartBar cart={state.cart} onTap={() => setShowMobileCart(true)} />

          {showMobileCart && (
            <div className="fixed inset-0 z-50 bg-secondary-50 dark:bg-primary-950 flex flex-col md:hidden">
              <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5 text-primary-600" />
                  <h2 className="font-bold text-lg text-secondary-900 dark:text-secondary-100">Cart</h2>
                </div>
                <button
                  onClick={() => setShowMobileCart(false)}
                  className="btn btn-ghost p-2 min-w-[44px] min-h-[44px] rounded-xl"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <Cart onCheckout={() => { setShowMobileCart(false); setShowCheckout(true); }} onSaveDraft={saveDraft} />
              </div>
            </div>
          )}
        </>
      )}

      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onComplete={handleCheckoutComplete}
      />
    </div>
  );
}

/* ─── Mobile Cart Bar (floating bottom indicator) ──────────────────── */

function MobileCartBar({ cart, onTap }: { cart: CartItem[]; onTap: () => void }) {
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => {
    const price = item.product.isWeightBased
      ? (item.product.pricePerUnit || 0) * (item.weight || 1)
      : item.product.price;
    return sum + price * item.quantity;
  }, 0);

  if (itemCount === 0) return null;

  return (
    <button
      onClick={onTap}
      className="fixed bottom-4 left-4 right-4 z-40 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-2xl px-5 py-4 shadow-lg flex items-center justify-between md:hidden transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <ShoppingCart className="h-5 w-5" />
          <span className="absolute -top-2 -right-2 bg-accent-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
            {itemCount}
          </span>
        </div>
        <span className="font-medium">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold tabular-nums">{DEFAULT_CURRENCY} {total.toFixed(2)}</span>
        <ChevronUp className="h-4 w-4" />
      </div>
    </button>
  );
}