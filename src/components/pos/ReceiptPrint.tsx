import { createPortal } from 'react-dom';
import { Sale } from '../../types';
import { useApp, useCapability } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

interface ReceiptPrintProps {
  sale: Sale;
  onClose: () => void;
}

// Shared receipt markup — used in both the on-screen preview and the portal print target
function ReceiptContent({ sale }: { sale: Sale }) {
  const { state } = useApp();
  const { profile } = useAuth();

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {state.settings.storeLogo && (
          <img
            src={state.settings.storeLogo}
            alt="Store Logo"
            style={{ height: 64, width: 64, margin: '0 auto 16px', objectFit: 'contain' }}
          />
        )}
        <h1 style={{ fontSize: 20, fontWeight: 'bold', color: '#111827' }}>{state.settings.storeName}</h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>{state.settings.storeAddress}</p>
        {state.settings.storePhone && (
          <p style={{ fontSize: 14, color: '#6b7280' }}>Tel: {state.settings.storePhone}</p>
        )}
        {state.settings.storeEmail && (
          <p style={{ fontSize: 14, color: '#6b7280' }}>Email: {state.settings.storeEmail}</p>
        )}
      </div>

      <div style={{ borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', padding: '16px 0', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
          <span>Receipt #:</span>
          <span style={{ fontWeight: 600 }}>#{sale.receiptNumber}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
          <span>Invoice #:</span>
          <span style={{ fontWeight: 600 }}>{sale.invoiceNumber}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
          <span>Date:</span>
          <span>{format(new Date(sale.timestamp), 'MMM dd, yyyy HH:mm')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
          <span>Cashier:</span>
          <span>{profile ? profile.name : sale.cashier}</span>
        </div>
        {sale.customerName && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>Customer:</span>
            <span>{sale.customerName}</span>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        {sale.items.map((item, index) => (
          <div key={index} style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{item.product.name}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {state.settings.currency} {item.subtotal.toFixed(2)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
              {state.settings.currency}{' '}
              {item.product.isWeightBased
                ? (item.product.pricePerUnit || 0).toFixed(2)
                : item.product.price.toFixed(2)}{' '}
              {item.product.isWeightBased ? `per ${item.product.unit}` : ''} ×{' '}
              {item.weight ? `${item.weight}${item.product.unit}` : item.quantity}
              {item.discount > 0 && (
                <span style={{ color: '#16a34a', marginLeft: 8 }}>
                  (Discount: -{state.settings.currency} {item.discount.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        ))}

        {sale.freeGifts && sale.freeGifts.length > 0 && (
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 8 }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#16a34a', marginBottom: 8 }}>Free Gifts:</p>
            {sale.freeGifts.map((gift, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#16a34a' }}>
                <span>{gift.product.name} x {gift.quantity}</span>
                <span>FREE</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
          <span>Subtotal:</span>
          <span>{state.settings.currency} {sale.subtotal.toFixed(2)}</span>
        </div>
        {sale.discountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#16a34a', marginBottom: 4 }}>
            <span>Total Discount:</span>
            <span>-{state.settings.currency} {sale.discountAmount.toFixed(2)}</span>
          </div>
        )}
        {sale.appliedDiscounts && sale.appliedDiscounts.length > 0 && (
          <div style={{ fontSize: 12, color: '#16a34a', marginLeft: 8, marginBottom: 4 }}>
            {sale.appliedDiscounts.map((discount, index) => (
              <div key={index}>&bull; {discount.discountName}</div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
          <span>Tax ({state.settings.taxRate}%):</span>
          <span>{state.settings.currency} {sale.taxAmount.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 'bold', borderTop: '1px solid #d1d5db', paddingTop: 8 }}>
          <span>Total:</span>
          <span>{state.settings.currency} {sale.total.toFixed(2)}</span>
        </div>

        {sale.payments && sale.payments.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            <h4 style={{ fontSize: 14, fontWeight: 500 }}>Payments</h4>
            <div style={{ marginTop: 4 }}>
              {sale.payments.map((p, i) => (
                <div key={p.id ?? i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 2 }}>
                  <div>
                    <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{p.method}</span>
                    {p.cardDetails && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>
                        ({p.cardDetails.cardType} &bull;&bull;&bull;&bull;{p.cardDetails.lastFourDigits})
                      </span>
                    )}
                  </div>
                  <div>{state.settings.currency} {p.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 8 }}>
            <span>Payment Method:</span>
            <span style={{ textTransform: 'capitalize' }}>{sale.paymentMethod}</span>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid #d1d5db' }}>
        <p style={{ fontSize: 12, color: '#6b7280' }}>Thank you for your business!</p>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
        </p>
      </div>
    </>
  );
}

export function ReceiptPrint({ sale, onClose }: ReceiptPrintProps) {
  const canPrint = useCapability('printer_integration');

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* On-screen modal — hidden when printing */}
      <div className="modal-overlay no-print">
        <div className="modal max-w-md">
          <div className="modal-header">
            <h2 className="text-xl font-bold text-gray-900 font-fraunces">Print Receipt</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
            >
              &times;
            </button>
          </div>

          <div className="modal-body">
            <ReceiptContent sale={sale} />
          </div>

          <div className="modal-footer">
            <button onClick={onClose} className="btn btn-secondary btn-md">
              Close
            </button>
            {canPrint && (
              <button onClick={handlePrint} className="btn btn-primary btn-md">
                Print Receipt
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Print-only receipt — portaled directly into body, no Tailwind ancestors */}
      {createPortal(
        <div id="print-receipt">
          <ReceiptContent sale={sale} />
          <style>{`
            #print-receipt { display: none; }

            @media print {
              /* Hide everything on the page */
              body > *:not(#print-receipt) { display: none !important; }

              /* Show only the portaled receipt */
              #print-receipt {
                display: block !important;
                position: static !important;
                width: 100% !important;
                max-width: 80mm !important;
                margin: 0 auto !important;
                padding: 0 !important;
                background: white !important;
                color: black !important;
                font-family: sans-serif !important;
                font-size: 14px !important;
              }
            }
          `}</style>
        </div>,
        document.body
      )}
    </>
  );
}
