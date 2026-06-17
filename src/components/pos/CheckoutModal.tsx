import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CreditCard, Banknote, Smartphone, Check, Receipt, AlertCircle, Gift } from 'lucide-react';
import { Sale, CardDetails, AppliedDiscount, CartItem, Payment } from '../../types';
import { useApp, checkDiscountEligibility, useInvoiceGeneration } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { ReceiptPrint } from './ReceiptPrint';
import { salesService, customersService, productsService } from '../../lib/services';
import { swalConfig } from '../../lib/sweetAlert';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (sale: Sale) => void;
}

export function CheckoutModal({ isOpen, onClose, onComplete }: CheckoutModalProps) {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const generateInvoice = useInvoiceGeneration();
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pendingPayment, setPendingPayment] = useState<{ method: Payment['method']; amount: string }>({ method: 'cash', amount: '' });
  const [splitPaymentEnabled, setSplitPaymentEnabled] = useState(false);
  const [showMorePayments, setShowMorePayments] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [creditNotes, setCreditNotes] = useState('');
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);
  const [freeGifts, setFreeGifts] = useState<CartItem[]>([]);
  const [showDiscountAlert, setShowDiscountAlert] = useState(false);
  const [cardDetails, setCardDetails] = useState<Partial<CardDetails>>({
    bankName: '',
    cardType: 'unknown',
    cardNumber: '',
    lastFourDigits: '',
    holderName: '',
  });

  // Sri Lankan banks list
  const sriLankanBanks = [
    'Bank of Ceylon',
    'People\'s Bank',
    'Commercial Bank of Ceylon PLC',
    'Hatton National Bank PLC',
    'Sampath Bank PLC',
    'Nations Trust Bank PLC',
    'DFCC Bank PLC',
    'Pan Asia Banking Corporation PLC',
    'Seylan Bank PLC',
    'Union Bank of Colombo PLC',
    'National Development Bank PLC',
    'Regional Development Bank',
    'Sanasa Development Bank PLC',
    'HDFC Bank',
    'Standard Chartered Bank',
    'Citibank N.A.',
    'MCB Bank Limited',
    'Habib Bank Limited',
    'Deutsche Bank AG',
    'ICBC'
  ];

  // Function to detect card type from card number
  const detectCardType = (cardNumber: string): 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown' => {
    const cleanNumber = cardNumber.replace(/\s/g, '');

    if (/^4/.test(cleanNumber)) {
      return 'visa';
    } else if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) {
      return 'mastercard';
    } else if (/^3[47]/.test(cleanNumber)) {
      return 'amex';
    } else if (/^6/.test(cleanNumber)) {
      return 'discover';
    }

    return 'unknown';
  };

  // Function to format card number with spaces
  const formatCardNumber = (value: string) => {
    const cleanValue = value.replace(/\s/g, '');
    const cardType = detectCardType(cleanValue);

    if (cardType === 'amex') {
      return cleanValue.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_, p1, p2, p3) => {
        let formatted = p1;
        if (p2) formatted += ' ' + p2;
        if (p3) formatted += ' ' + p3;
        return formatted;
      });
    } else {
      return cleanValue.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    }
  };

  const getCardNumberLength = (cardType: string) => {
    return cardType === 'amex' ? 15 : 16;
  };

  const handleCardNumberChange = (value: string) => {
    const cleanValue = value.replace(/\s/g, '');
    const cardType = detectCardType(cleanValue);
    const maxLength = getCardNumberLength(cardType);

    if (cleanValue.length <= maxLength) {
      const formattedValue = formatCardNumber(cleanValue);
      const lastFour = cleanValue.slice(-4);

      setCardDetails(prev => ({
        ...prev,
        cardNumber: formattedValue,
        cardType,
        lastFourDigits: lastFour
      }));
    }
  };

  // Calculate totals
  const subtotal = state.cart.reduce((sum, item) => {
    const price = item.product.isWeightBased
      ? (item.product.pricePerUnit || 0) * (item.weight || 1)
      : item.product.price;
    return sum + (price * item.quantity);
  }, 0);
  const manualDiscount = state.cart.reduce((sum, item) => sum + (item.discount || 0), 0);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmountPaid('');
      setIsProcessing(false);
      setShowReceipt(false);
      setCompletedSale(null);
      setCreditNotes('');
      setShowDiscountAlert(false);
      setPaymentMethod('cash');
      setPayments([]);
      setPendingPayment({ method: 'cash', amount: '' });
      setSplitPaymentEnabled(false);
      setShowMorePayments(false);
      setCardDetails({
        bankName: '',
        cardType: 'unknown',
        cardNumber: '',
        lastFourDigits: '',
        holderName: '',
      });
    }
  }, [isOpen]);

  // Check for applicable automatic discounts
  useEffect(() => {
    if (!isOpen || state.cart.length === 0) return;

    const eligibleDiscounts: AppliedDiscount[] = [];
    const gifts: CartItem[] = [];

    state.discounts.forEach(discount => {
      if (checkDiscountEligibility(
        discount,
        state.cart,
        state.selectedCustomer,
        paymentMethod,
        subtotal,
        paymentMethod === 'card' ? cardDetails : undefined
      )) {
        if (discount.type === 'free_gift' && discount.freeGiftProducts) {
          discount.freeGiftProducts.forEach(productId => {
            const product = state.products.find(p => p.id === productId);
            if (product) {
              gifts.push({
                product,
                quantity: 1,
                discount: 0,
                discountType: 'fixed',
                subtotal: 0,
              });
            }
          });

          eligibleDiscounts.push({
            discountId: discount.id,
            discountName: discount.name,
            discountAmount: 0,
            type: 'free_gift',
          });
        } else {
          let discountAmount = 0;
          if (discount.type === 'percentage') {
            discountAmount = (subtotal * discount.value) / 100;
            if (discount.maxDiscount) {
              discountAmount = Math.min(discountAmount, discount.maxDiscount);
            }
          } else if (discount.type === 'fixed') {
            discountAmount = discount.value;
          }

          if (discountAmount > 0) {
            autoDiscountAmount += discountAmount;
            eligibleDiscounts.push({
              discountId: discount.id,
              discountName: discount.name,
              discountAmount,
              type: discount.type,
            });
          }
        }
      }
    });

    setAppliedDiscounts(eligibleDiscounts);
    setFreeGifts(gifts);

    if (eligibleDiscounts.length > 0) {
      setShowDiscountAlert(true);
    }
  }, [isOpen, state.cart, state.selectedCustomer, paymentMethod, subtotal, state.discounts, state.products, cardDetails]);

  const totalAutoDiscount = appliedDiscounts.reduce((sum, discount) => sum + discount.discountAmount, 0);
  const totalDiscount = manualDiscount + totalAutoDiscount;
  const taxAmount = (subtotal - totalDiscount) * (state.settings.taxRate / 100);
  const total = subtotal - totalDiscount + taxAmount;
  const change = parseFloat(amountPaid) - total;

  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - paidSoFar);

  const canPayWithCredit = state.selectedCustomer &&
    (state.selectedCustomer.creditLimit - state.selectedCustomer.creditUsed) >= total;

  const canProcessPayment = () => {
    if (isProcessing) return false;
    if (payments.length > 0) {
      const sum = payments.reduce((s, p) => s + p.amount, 0);
      return Math.abs(sum - total) < 0.01;
    }

    switch (paymentMethod) {
      case 'cash':
        return amountPaid && parseFloat(amountPaid) >= total;
      case 'card':
        return cardDetails.bankName &&
               cardDetails.holderName &&
               cardDetails.cardNumber &&
               cardDetails.cardType !== 'unknown' &&
               ((cardDetails.cardType === 'amex' && cardDetails.cardNumber.replace(/\s/g, '').length === 15) ||
                (cardDetails.cardType !== 'amex' && cardDetails.cardNumber.replace(/\s/g, '').length === 16));
      case 'credit':
        return canPayWithCredit;
      case 'kbzpay':
      case 'wavepay':
      case 'ayapay':
      case 'cbpay':
      case 'mpu':
        return amountPaid && parseFloat(amountPaid) >= total;
      case 'digital':
        return true;
      default:
        return false;
    }
  };

  const addPendingPayment = () => {
    const amt = parseFloat(pendingPayment.amount || '0');
    if (!amt || amt <= 0) {
      swalConfig.warning('Enter a valid payment amount');
      return;
    }
    if (amt > remaining) {
      swalConfig.warning('Payment exceeds remaining balance');
      return;
    }
    const newPayment: Payment = {
      id: Date.now().toString(),
      method: pendingPayment.method,
      amount: amt,
      cardDetails: pendingPayment.method === 'card' ? {
        id: Date.now().toString(),
        bankName: cardDetails.bankName || '',
        cardType: cardDetails.cardType || 'unknown',
        cardNumber: cardDetails.cardNumber || '',
        lastFourDigits: cardDetails.lastFourDigits || '',
        holderName: cardDetails.holderName || ''
      } : undefined
    };
    setPayments(prev => [...prev, newPayment]);
    setPendingPayment({ ...pendingPayment, amount: '' });
  };

  const removePayment = (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  if (!isOpen && !showReceipt) return null;

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      if (pendingPayment.amount && parseFloat(pendingPayment.amount) > 0) {
        const res = await swalConfig.confirm('Unadded Payment', 'You have entered a payment amount but not added it to the split list. Add now?', 'Add');
        if (res.isConfirmed) {
          addPendingPayment();
          await new Promise(r => setTimeout(r, 200));
        } else {
          setIsProcessing(false);
          return;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 400));

      const invoiceNumber = await generateInvoice();

      const salePayments: Payment[] = payments.length > 0 ? payments : [{
        id: Date.now().toString(),
        method: paymentMethod as Payment['method'],
        amount: paymentMethod === 'cash' ? parseFloat(amountPaid || '0') : total,
        cardDetails: paymentMethod === 'card' ? { ...cardDetails as CardDetails, id: Date.now().toString() } : undefined
      }];

      const sale: Sale = {
        id: Date.now().toString(),
        invoiceNumber,
        customerId: state.selectedCustomer?.id,
        customerName: state.selectedCustomer?.name,
        items: state.cart,
        subtotal,
        discountAmount: totalDiscount,
        taxAmount,
        total,
        paymentMethod: salePayments.length > 1 ? 'split' : salePayments[0].method,
        payments: salePayments,
        cardDetails: salePayments.length === 1 ? salePayments[0].cardDetails : undefined,
        status: salePayments.some(p => p.method === 'credit') ? 'credit' : 'completed',
        cashier: user?.user_metadata?.full_name || user?.email || 'Unknown',
        timestamp: new Date(),
        receiptNumber: invoiceNumber,
        notes: salePayments.some(p => p.method === 'credit') ? creditNotes : undefined,
        appliedDiscounts,
        freeGifts: freeGifts.length > 0 ? freeGifts : undefined,
      };

      const savedSale = await salesService.create(sale);
      dispatch({ type: 'ADD_SALE', payload: savedSale });

      for (const item of state.cart) {
        try {
          const product = state.products.find(p => p.id === item.product.id);
          if (product && product.trackInventory) {
            const quantityToDeduct = item.weight || item.quantity;
            const updatedProduct = {
              ...product,
              stock: product.stock - quantityToDeduct,
              updatedAt: new Date(),
            };
            await productsService.update(product.id, updatedProduct);
            dispatch({ type: 'UPDATE_PRODUCT', payload: updatedProduct });
          }
        } catch (error) {
          console.error(`Error updating inventory for product ${item.product.name}:`, error);
        }
      }

      if (salePayments.some(p => p.method === 'credit') && state.selectedCustomer) {
        try {
          const updatedCustomer = {
            ...state.selectedCustomer,
            creditUsed: state.selectedCustomer.creditUsed + total,
            totalPurchases: state.selectedCustomer.totalPurchases + total,
            lastPurchase: new Date(),
          };
          await customersService.update(updatedCustomer.id, updatedCustomer);
          dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
        } catch (error) {
          console.error('Error updating customer for credit payment:', error);
        }
      } else if (state.selectedCustomer) {
        try {
          const updatedCustomer = {
            ...state.selectedCustomer,
            totalPurchases: state.selectedCustomer.totalPurchases + total,
            lastPurchase: new Date(),
          };
          await customersService.update(updatedCustomer.id, updatedCustomer);
          dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
        } catch (error) {
          console.error('Error updating customer purchase history:', error);
        }
      }

      dispatch({ type: 'CLEAR_CART' });

      setCompletedSale(savedSale);
      onComplete(savedSale);
      setIsProcessing(false);

      setShowReceipt(true);
    } catch (error) {
      console.error('Payment processing error:', error);
      setIsProcessing(false);
      swalConfig.error('Payment processing failed. Please try again.');
    }
  };

  const handleCloseModal = () => {
    setShowReceipt(false);
    setCompletedSale(null);
    onClose();
  };

  const isTouchMode = state.settings.interfaceMode === 'touch';

  // Shared payment-method button class builder — avoids 8× style duplication
  const paymentBtnClasses = (methodId: string, isDisabled = false) => {
    const isActive = splitPaymentEnabled
      ? pendingPayment.method === methodId
      : paymentMethod === methodId;
    return [
      'flex flex-col items-center space-y-2 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer',
      isActive
        ? 'border-[#9a693a] bg-[#fcf5eb] text-[#7a4f2c] dark:border-[#cfa16a] dark:bg-[#3b2613]/50 dark:text-[#ddb889]'
        : 'border-[#ded7cc] dark:border-[#54463b] hover:border-[#c6bbab] dark:hover:border-[#655547] text-[#7d6b57] dark:text-[#c6bbab]',
      isTouchMode ? 'min-h-[80px]' : 'min-h-[70px]',
      isDisabled ? 'opacity-50 cursor-not-allowed' : '',
    ].join(' ');
  };

  return (
    <>
      {!showReceipt && isOpen && (
        <div className="modal-overlay">
          <div className={`modal ${isTouchMode ? 'max-w-lg md:max-w-xl' : 'max-w-md md:max-w-lg'}`}>
            {/* Header */}
            <div className="modal-header">
              <h2 className={`font-bold font-fraunces text-[#473b32] dark:text-[#f0ece5] ${isTouchMode ? 'text-xl' : 'text-lg'}`}>
                Complete Payment
              </h2>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="text-[#ad9e8a] hover:text-[#7d6b57] p-2 rounded-xl hover:bg-[#f0ece5] dark:hover:bg-[#3b2613] transition-colors disabled:opacity-50"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="modal-body space-y-6">
              {/* Discount Alert */}
              {showDiscountAlert && appliedDiscounts.length > 0 && (
                <div className="bg-[#f0fdf4] dark:bg-[#14532d]/20 border border-[#bbf7d0] dark:border-[#166534]/50 rounded-xl p-4 animate-slide-up">
                  <div className="flex items-start space-x-3">
                    <Gift className="h-5 w-5 text-[#16a34a] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#166534] dark:text-[#86efac] mb-2">Discounts Applied!</h4>
                      <div className="space-y-1">
                        {appliedDiscounts.map((discount, index) => (
                          <div key={index} className="text-sm text-[#15803d] dark:text-[#4ade80]">
                            <span className="font-medium">{discount.discountName}</span>
                            {discount.type !== 'free_gift' && (
                              <span className="ml-2">- {state.settings.currency} {discount.discountAmount.toFixed(2)}</span>
                            )}
                          </div>
                        ))}
                        {freeGifts.length > 0 && (
                          <div className="text-sm text-[#15803d] dark:text-[#4ade80]">
                            <span className="font-medium">Free Gifts: </span>
                            {freeGifts.map(gift => gift.product.name).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDiscountAlert(false)}
                      className="text-[#16a34a] hover:text-[#15803d]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div>
                <h3 className={`font-semibold font-fraunces text-[#473b32] dark:text-[#f0ece5] mb-4 ${isTouchMode ? 'text-lg' : 'text-base'}`}>
                  Order Summary
                </h3>

                <div className="space-y-2 mb-4 max-h-40 md:max-h-48 overflow-y-auto">
                  {state.cart.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm text-[#7d6b57] dark:text-[#c6bbab]">
                      <span className="truncate flex-1 mr-2">
                        {item.product.name} × {item.weight ? `${item.weight}${item.product.unit}` : item.quantity}
                      </span>
                      <span className="font-medium text-[#473b32] dark:text-[#f0ece5]">{state.settings.currency} {item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                  {freeGifts.map((gift, index) => (
                    <div key={`gift-${index}`} className="flex justify-between text-sm text-[#16a34a]">
                      <span className="truncate flex-1 mr-2">
                        🎁 {gift.product.name} × {gift.quantity} (FREE)
                      </span>
                      <span className="font-medium">{state.settings.currency} 0.00</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-4 border-t border-[#ded7cc] dark:border-[#54463b]">
                  <div className="flex justify-between text-[#7d6b57] dark:text-[#c6bbab]">
                    <span>Subtotal:</span>
                    <span className="font-medium text-[#473b32] dark:text-[#f0ece5]">{state.settings.currency} {subtotal.toFixed(2)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-[#16a34a]">
                      <span>Total Discount:</span>
                      <span className="font-medium">-{state.settings.currency} {totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#7d6b57] dark:text-[#c6bbab]">
                    <span>Tax ({state.settings.taxRate}%):</span>
                    <span className="font-medium text-[#473b32] dark:text-[#f0ece5]">{state.settings.currency} {taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-[#473b32] dark:text-[#f0ece5] pt-2 border-t border-[#ded7cc] dark:border-[#54463b]">
                    <span>Total:</span>
                    <span className="text-[#9a693a] dark:text-[#cfa16a]">{state.settings.currency} {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <h3 className={`font-semibold font-fraunces text-[#473b32] dark:text-[#f0ece5] mb-4 ${isTouchMode ? 'text-lg' : 'text-base'}`}>
                  Payment Method
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'cash', label: 'Cash', icon: Banknote },
                    { id: 'kbzpay', label: 'KBZpay', icon: Smartphone },
                    { id: 'wavepay', label: 'WavePay', icon: Smartphone },
                    { id: 'ayapay', label: 'AYA Pay', icon: Smartphone },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => {
                        if (splitPaymentEnabled) {
                          setPendingPayment(prev => ({ ...prev, method: id as Payment['method'] }));
                        } else {
                          setPaymentMethod(id);
                        }
                      }}
                      className={paymentBtnClasses(id)}
                    >
                      <Icon className={`${isTouchMode ? 'h-6 w-6' : 'h-5 w-5'}`} />
                      <span className={`font-medium ${isTouchMode ? 'text-sm' : 'text-xs'}`}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>

                {!splitPaymentEnabled && (
                  <button
                    type="button"
                    onClick={() => setShowMorePayments(!showMorePayments)}
                    className="mt-3 text-sm text-[#9a693a] dark:text-[#cfa16a] hover:text-[#7a4f2c] dark:hover:text-[#ddb889] font-medium flex items-center space-x-1 transition-colors"
                  >
                    <span className={`transform transition-transform duration-300 ${showMorePayments ? 'rotate-90' : ''}`}>›</span>
                    <span>{showMorePayments ? 'Less payment options' : 'More payment options'}</span>
                  </button>
                )}

                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showMorePayments ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'card', label: 'Card', icon: CreditCard },
                      { id: 'cbpay', label: 'CB Pay', icon: Smartphone },
                      { id: 'mpu', label: 'MPU', icon: CreditCard },
                      { id: 'digital', label: 'Digital', icon: Smartphone },
                    ].map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => {
                          if (splitPaymentEnabled) {
                            setPendingPayment(prev => ({ ...prev, method: id as Payment['method'] }));
                          } else {
                            setPaymentMethod(id);
                          }
                        }}
                        className={paymentBtnClasses(id)}
                      >
                        <Icon className={`${isTouchMode ? 'h-6 w-6' : 'h-5 w-5'}`} />
                        <span className={`font-medium ${isTouchMode ? 'text-sm' : 'text-xs'}`}>
                          {label}
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        if (splitPaymentEnabled) {
                          setPendingPayment(prev => ({ ...prev, method: 'credit' as Payment['method'] }));
                        } else {
                          setPaymentMethod('credit');
                        }
                      }}
                      disabled={!splitPaymentEnabled && !canPayWithCredit}
                      className={`${paymentBtnClasses('credit', !splitPaymentEnabled && !canPayWithCredit)} col-span-2 sm:col-span-3`}
                    >
                      <Receipt className={`${isTouchMode ? 'h-6 w-6' : 'h-5 w-5'}`} />
                      <span className={`font-medium ${isTouchMode ? 'text-sm' : 'text-xs'}`}>
                        Credit
                      </span>
                    </button>
                  </div>
                </div>

                {/* Amount Received - always visible */}
                {!splitPaymentEnabled && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-2">
                      Amount Received *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className={`input ${isTouchMode ? 'h-12 text-lg' : 'h-11'}`}
                      placeholder={`Minimum: ${state.settings.currency} ${total.toFixed(2)}`}
                      disabled={isProcessing}
                    />
                    <AnimatePresence>
                      {paymentMethod === 'cash' && amountPaid && parseFloat(amountPaid) >= total && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.2 }}
                          className="mt-2 bg-[#f0fdf4] dark:bg-[#14532d]/20 border border-[#bbf7d0] dark:border-[#166534]/50 rounded-xl p-3"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-[#166534] dark:text-[#86efac] text-sm">Change Due:</span>
                            <span className="text-base font-bold text-[#166534] dark:text-[#86efac]">
                              {state.settings.currency} {change.toFixed(2)}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Split Payment Toggle */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setSplitPaymentEnabled(!splitPaymentEnabled)}
                    className="text-sm text-[#9a693a] dark:text-[#cfa16a] hover:text-[#7a4f2c] dark:hover:text-[#ddb889] font-medium flex items-center space-x-1 transition-colors"
                  >
                    <span className={`transform transition-transform duration-300 ${splitPaymentEnabled ? 'rotate-90' : ''}`}>›</span>
                    <span>{splitPaymentEnabled ? 'Single Payment' : 'Split Payment'}</span>
                  </button>

                  {/* Collapsible split payment section */}
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${splitPaymentEnabled ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-3 border border-[#ded7cc] dark:border-[#54463b] rounded-xl p-3 bg-[#faf8f5] dark:bg-[#2a1a10]">
                      <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">
                        Remaining to pay: <span className="font-semibold text-[#473b32] dark:text-[#f0ece5]">{state.settings.currency} {remaining.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.01"
                          className="input flex-1"
                          placeholder={`Amount (max: ${remaining.toFixed(2)})`}
                          value={pendingPayment.amount}
                          onChange={(e) => setPendingPayment(prev => ({ ...prev, amount: e.target.value }))}
                        />
                        <button type="button" className="btn btn-primary" onClick={addPendingPayment}>Add</button>
                      </div>

                      <div className="space-y-2">
                        {payments.map(p => (
                          <div key={p.id} className="flex justify-between items-center p-2 border border-[#ded7cc] dark:border-[#54463b] rounded-xl bg-white dark:bg-[#1a0f08]">
                            <div>
                              <div className="font-medium text-[#473b32] dark:text-[#f0ece5]">{p.method.toUpperCase()}</div>
                              <div className="text-xs text-[#7d6b57] dark:text-[#c6bbab]">{p.cardDetails ? `${p.cardDetails.cardType} ••••${p.cardDetails.lastFourDigits}` : ''}</div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="font-semibold text-[#473b32] dark:text-[#f0ece5]">{state.settings.currency} {p.amount.toFixed(2)}</div>
                              <button onClick={() => removePayment(p.id)} className="btn-ghost text-sm font-medium !text-red-600 hover:!text-red-800">Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Credit Payment Warning */}
                {paymentMethod === 'credit' && !canPayWithCredit && (
                  <div className="mt-4 p-3 bg-[#fef2f2] dark:bg-[#450a0a]/30 border border-[#fecaca] dark:border-[#991b1b]/50 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-[#dc2626] flex-shrink-0" />
                    <span className="text-[#b91c1c] dark:text-[#fca5a5] text-sm">
                      {state.selectedCustomer
                        ? 'Insufficient credit limit'
                        : 'Please select a customer for credit payment'
                      }
                    </span>
                  </div>
                )}

                {/* Credit Available Info */}
                {paymentMethod === 'credit' && state.selectedCustomer && (
                  <div className="mt-4 p-3 bg-[#fcf5eb] dark:bg-[#3b2613]/30 border border-[#ddb889] dark:border-[#7a4f2c]/50 rounded-xl">
                    <div className="text-sm text-[#473b32] dark:text-[#f0ece5]">
                      <div className="flex justify-between">
                        <span>Credit Limit:</span>
                        <span className="font-medium">{state.settings.currency} {state.selectedCustomer.creditLimit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Used:</span>
                        <span className="font-medium">{state.settings.currency} {state.selectedCustomer.creditUsed.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t border-[#ddb889] dark:border-[#7a4f2c]/50 pt-1 mt-1">
                        <span>Available:</span>
                        <span className="text-[#16a34a]">{state.settings.currency} {(state.selectedCustomer.creditLimit - state.selectedCustomer.creditUsed).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Payment Details */}
              <AnimatePresence>
                {paymentMethod === 'card' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <div className="overflow-hidden">
                      <h3 className={`font-semibold font-fraunces text-[#473b32] dark:text-[#f0ece5] mb-4 ${isTouchMode ? 'text-lg' : 'text-base'}`}>
                    Card Details
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-2">
                        Bank Name *
                      </label>
                      <select
                        value={cardDetails.bankName}
                        onChange={(e) => setCardDetails(prev => ({ ...prev, bankName: e.target.value }))}
                        className="select"
                        disabled={isProcessing}
                      >
                        <option value="">Select Bank</option>
                        {sriLankanBanks.map((bank) => (
                          <option key={bank} value={bank}>{bank}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-2">
                        Card Number *
                      </label>
                      <input
                        type="text"
                        value={cardDetails.cardNumber}
                        onChange={(e) => handleCardNumberChange(e.target.value)}
                        className="input"
                        placeholder="Enter card number"
                        disabled={isProcessing}
                        maxLength={cardDetails.cardType === 'amex' ? 17 : 19}
                      />
                      {cardDetails.cardType !== 'unknown' && cardDetails.cardNumber && (
                        <div className="mt-2 flex items-center space-x-2">
                          <span className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Detected:</span>
                          <span className="text-sm font-medium capitalize text-[#9a693a] dark:text-[#cfa16a]">
                            {cardDetails.cardType}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-2">
                        Card Holder Name *
                      </label>
                      <input
                        type="text"
                        value={cardDetails.holderName}
                        onChange={(e) => setCardDetails(prev => ({ ...prev, holderName: e.target.value }))}
                        className="input"
                        placeholder="Name on card"
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Credit Notes */}
              <AnimatePresence>
                {paymentMethod === 'credit' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <div className="overflow-hidden">
                      <h3 className={`font-semibold font-fraunces text-[#473b32] dark:text-[#f0ece5] mb-4 ${isTouchMode ? 'text-lg' : 'text-base'}`}>
                    Credit Notes
                  </h3>
                  <textarea
                    value={creditNotes}
                    onChange={(e) => setCreditNotes(e.target.value)}
                    placeholder="Add notes for credit transaction..."
                    className="textarea"
                    rows={3}
                    disabled={isProcessing}
                  />
                </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div className="modal-footer">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="btn btn-secondary btn-md px-6 py-3"
                style={{ minHeight: '44px' }}
              >
                Cancel
              </button>

              <button
                onClick={handlePayment}
                disabled={!canProcessPayment()}
                className="btn btn-primary btn-md flex items-center space-x-2 min-w-[160px] justify-center px-6 py-3"
                style={{ minHeight: '44px' }}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Complete Payment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Print Modal */}
      {showReceipt && completedSale && (
        <ReceiptPrint
          sale={completedSale}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
