import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpgradePrompt } from '../UpgradePrompt'

describe('UpgradePrompt', () => {
  it('renders growth tier message for growth tier', () => {
    render(<UpgradePrompt feature="Receipt printing" tier="growth" onClose={vi.fn()} />)

    expect(screen.getByText(/Upgrade to Growth/)).toBeInTheDocument()
    expect(screen.getByText(/Receipt printing requires the Growth plan/)).toBeInTheDocument()
  })

  it('renders pro tier message for pro tier', () => {
    render(<UpgradePrompt feature="Owner insights" tier="pro" onClose={vi.fn()} />)

    expect(screen.getByText(/Upgrade to Pro/)).toBeInTheDocument()
    expect(screen.getByText(/Owner insights requires the Pro plan/)).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<UpgradePrompt feature="Feature" tier="growth" onClose={onClose} />)

    const closeBtn = screen.getByRole('button')
    await userEvent.click(closeBtn)

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('mentions Ko Htun for upgrade contact', () => {
    render(<UpgradePrompt feature="Test" tier="growth" onClose={vi.fn()} />)
    expect(screen.getByText(/Contact Ko Htun to upgrade/)).toBeInTheDocument()
  })
})
