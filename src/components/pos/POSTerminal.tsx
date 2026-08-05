import { useState, useEffect } from 'react';
import { ShoppingCart, ChevronUp, X } from 'lucide-react';
import { ProductGrid } from './ProductGrid';
import { MobileProductList } from './MobileProductList';
import { Cart } from './Cart';
import { CheckoutModal } from './CheckoutModal';
import { SalesTabManager } from './SalesTabManager';
import { Product, CartItem, Sale } from '../../types';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';
import { salesService } from '../../lib/services';
import { swalConfig } from '../../lib/sweetAlert';
import { DEFAULT_CURRENCY } from '../../lib/constants';

export function POSTerminal() {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const [showCheckout, setShowCheckout] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [isPortrait, setIsPortrait] = useState(() => window.innerHeight > window.innerWidth);
  const isTouchMode = state.settings.interfaceMode === 'touch';

  // ponytail: large phones in landscape (width >= 768px) will trigger two-column. Acceptable for counter-mounted tablet target.
  const usesTwoColumn = !isMobile && !isPortrait;

  useEffect(() => {
    const mqWidth = window.matchMedia('(max-width: 767px)');
    const mqPortrait = window.matchMedia('(orientation: portrait)');

    const handleWidth = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const handleOrientation = (e: MediaQueryListEvent) => setIsPortrait(e.matches);

    mqWidth.addEventListener('change', handleWidth);
    mqPortrait.addEventListener('change', handleOrientation);
    return () => {
      mqWidth.removeEventListener('change', handleWidth);
      mqPortrait.removeEventListener('change', handleOrientation);
    };
  }, []);

  const addToCart = (product: Product, weight?: number) => {
    // Only check stock if inventory tracking is enabled
    if (product.trackInventory && (product.stock ?? 0) <= 0) return;

    const existingItemIndex = state.cart.findIndex(item =>
      item.product.id === product.id &&
      (product.isWeightBased ? false : true) // For weight-based products, always add new item
    );

    if (existingItemIndex >= 0 && !product.isWeightBased) {
      const existingItem = state.cart[existingItemIndex];
      const newQuantity = existingItem.quantity + 1;

      // Only check stock limits if inventory tracking is enabled
      if (!product.trackInventory || newQuantity <= (product.stock ?? 0)) {
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
  };

  // Keep the active sales tab's cart in sync with local cart state (C3 fix).
  // addToCart previously wrote state.cart into the tab in the same handler — a
  // stale closure that saved the pre-dispatch cart, so items vanished on tab switch.
  useEffect(() => {
    if (!state.activeSalesTab) return;
    dispatch({
      type: 'UPDATE_SALES_TAB',
      payload: {
        id: state.activeSalesTab,
        updates: { cart: state.cart, selectedCustomer: state.selectedCustomer },
      },
    });
  }, [state.cart, state.selectedCustomer, state.activeSalesTab, dispatch]);

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
        status: 'draft',
        cashier: user?.user_metadata?.full_name || user?.email || 'Unknown',
        timestamp: new Date(),
        receiptNumber: `DRAFT-${Date.now().toString().slice(-6)}`,
        notes: 'DRAFT_SALE - payment pending',
      };

      // Save to Supabase and update local state
      const savedDraft = await salesService.create(draftSale);
      // Register sale ID for Realtime dedup — prevents echo duplicate on creating terminal
      const markSale = (window as unknown as Record<string, unknown>).__markSaleLocallyCreated as ((id: string) => void) | undefined;
      if (markSale) markSale(savedDraft.id);
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

  return (
    <div className="flex h-full bg-secondary-50 dark:bg-primary-950">
      <SalesTabManager />
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* ProductGrid / MobileProductList */}
        <div className={`flex-1 min-h-0 ${!usesTwoColumn ? 'pb-20' : 'pb-0'}`}>
          {isMobile ? (
            <MobileProductList onAddToCart={addToCart} />
          ) : (
            <ProductGrid onAddToCart={addToCart} />
          )}
        </div>

        {/* Cart — side panel on landscape tablet / desktop */}
        {usesTwoColumn && (
          <div className={`flex-shrink-0 flex flex-col min-h-0 border-l border-secondary-200 dark:border-secondary-800 ${isTouchMode ? 'w-96' : 'w-80'}`}>
            <Cart onCheckout={handleCheckout} onSaveDraft={saveDraft} />
          </div>
        )}
      </div>

      {/* Mobile/Portrait Cart — floating bar + full-screen overlay (all roles) */}
      {!usesTwoColumn && (
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

  return (
    <button
      onClick={onTap}
      className="fixed bottom-4 left-4 right-4 z-40 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-2xl px-5 py-4 shadow-lg flex items-center justify-between md:hidden animate-slide-up transition-colors touch-friendly pb-safe"
      aria-label="Open cart"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <ShoppingCart className="h-5 w-5" />
          {itemCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-accent-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
              {itemCount}
            </span>
          )}
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