import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// --- Mock services ---
const { mockSwalConfig, mockCheckoutComplete, MockDailyLimitError } = vi.hoisted(() => {
  class MockDailyLimitError extends Error {
    constructor(msg = 'Daily order limit reached. Upgrade to Growth.') {
      super(msg)
      this.name = 'DailyLimitError'
    }
  }
  return {
    mockSwalConfig: {
      error: vi.fn(),
      success: vi.fn(),
      loading: vi.fn(),
      warning: vi.fn(),
      deleteConfirm: vi.fn(),
      confirm: vi.fn().mockResolvedValue({ isConfirmed: false }),
    },
    mockCheckoutComplete: vi.fn(),
    MockDailyLimitError,
  }
})

vi.mock('../../../lib/services', () => ({
  checkoutService: { complete: (...args: any[]) => mockCheckoutComplete(...args) },
  DailyLimitError: MockDailyLimitError,
}))

vi.mock('../../../lib/sweetAlert', () => ({
  swalConfig: mockSwalConfig,
}))

vi.mock('../../../lib/inventoryUtils', () => ({
  checkStockAvailability: vi.fn().mockResolvedValue({ sufficient: true, insufficientItems: [] }),
}))

// --- Mock contexts ---
const mockState = {
  activeShopId: 'shop-1',
  cart: [{
    product: { id: 'p1', name: 'Latte', price: 5.5, category: 'drinks', taxable: true, trackInventory: true, isWeightBased: false, stock: 100, cost: 2 },
    quantity: 2,
    discount: 0,
    discountType: 'fixed' as const,
    subtotal: 11,
  }],
  settings: { interfaceMode: 'desktop', currency: 'USD', taxRate: 0, storeName: 'Test' },
  customer: null,
  selectedCustomer: null,
  discounts: [],
  capabilities: ['pos'],
  products: [],
}

vi.mock('../../../context/SupabaseAppContext', () => ({
  useApp: () => ({
    state: mockState,
    dispatch: vi.fn(),
  }),
  useCapability: (name: string) => mockState.capabilities.includes(name),
  useInvoiceGeneration: () => async () => 'INV-TEST',
  checkDiscountEligibility: () => false,
}))

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'cashier-1', email: 'test@test.com', user_metadata: { full_name: 'Cashier' } },
  }),
}))

vi.mock('../ReceiptPrint', () => ({
  ReceiptPrint: () => <div data-testid="receipt-print" />,
}))

vi.mock('../../ui/UpgradePrompt', () => ({
  UpgradePrompt: ({ feature, tier, onClose }: any) => (
    <div data-testid="upgrade-prompt">
      Upgrade to {tier} for {feature}
      <button onClick={onClose}>Close upgrade</button>
    </div>
  ),
}))

// Import after mocks
import { CheckoutModal } from '../CheckoutModal'

describe('CheckoutModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows upgrade prompt when DailyLimitError is thrown', async () => {
    mockCheckoutComplete.mockRejectedValue(new MockDailyLimitError())

    render(<CheckoutModal {...defaultProps} />)

    // Fill amount to enable the button (cash mode requires amountPaid >= total=11)
    const amountInput = screen.getAllByRole('spinbutton')[0]
    await userEvent.type(amountInput, '20')

    const payBtn = screen.getByRole('button', { name: /Complete Payment/ })
    await userEvent.click(payBtn)

    await waitFor(() => {
      expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument()
    })

    expect(screen.getByText(/Upgrade to growth for Daily sales/)).toBeInTheDocument()
  })

  it('shows error toast on generic checkout failure', async () => {
    mockCheckoutComplete.mockRejectedValue(new Error('DB error'))

    render(<CheckoutModal {...defaultProps} />)

    const amountInput = screen.getAllByRole('spinbutton')[0]
    await userEvent.type(amountInput, '20')

    const payBtn = screen.getByRole('button', { name: /Complete Payment/ })
    await userEvent.click(payBtn)

    await waitFor(() => {
      expect(mockSwalConfig.error).toHaveBeenCalled()
    })
  })

  it('renders payment method buttons', () => {
    render(<CheckoutModal {...defaultProps} />)
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('KBZpay')).toBeInTheDocument()
    expect(screen.getByText('WavePay')).toBeInTheDocument()
  })

  it('renders Complete Payment button', () => {
    render(<CheckoutModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Complete Payment/ })).toBeInTheDocument()
  })
})
