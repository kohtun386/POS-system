import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock auth context
const mockSignOut = vi.fn()
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
  }),
}))

import { PendingApprovalPage } from '../PendingApprovalPage'

describe('PendingApprovalPage', () => {
  it('renders pending approval heading', () => {
    render(<PendingApprovalPage />)
    expect(screen.getByRole('heading', { name: /Pending Approval/ })).toBeInTheDocument()
  })

  it('shows pending approval message', () => {
    render(<PendingApprovalPage />)
    expect(
      screen.getByText(/Your shop registration is pending approval/),
    ).toBeInTheDocument()
  })

  it('shows contact info for Ko Htun', () => {
    render(<PendingApprovalPage />)
    expect(screen.getByText(/Contact Ko Htun via Viber or WhatsApp/)).toBeInTheDocument()
  })

  it('renders sign out button', () => {
    render(<PendingApprovalPage />)
    expect(screen.getByRole('button', { name: /Sign Out/ })).toBeInTheDocument()
  })

  it('calls signOut when sign out button clicked', async () => {
    render(<PendingApprovalPage />)
    const btn = screen.getByRole('button', { name: /Sign Out/ })
    await userEvent.click(btn)
    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
