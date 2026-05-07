import { describe, expect, it, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/test/test-utils'
import { MobileToolbarMenu } from './MobileToolbarMenu'

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

describe('MobileToolbarMenu', () => {
  it('renders verb sections only and excludes settings/contexts', async () => {
    const user = userEvent.setup()

    render(
      <MobileToolbarMenu
        isDisabled={false}
        hasOpenPr={false}
        onSaveContext={vi.fn()}
        onLoadContext={vi.fn()}
        onCommit={vi.fn()}
        onCommitAndPush={vi.fn()}
        onOpenPr={vi.fn()}
        onReview={vi.fn()}
        onMerge={vi.fn()}
        onMergePr={vi.fn()}
        onResolveConflicts={vi.fn()}
        handlePullClick={vi.fn()}
        handlePushClick={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByText('Save Context')).toBeInTheDocument()
    expect(screen.getByText('Commit & Push')).toBeInTheDocument()
    expect(screen.getByText('Pull')).toBeInTheDocument()
    expect(screen.getByText('Push')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Merge to Base')).toBeInTheDocument()

    expect(screen.queryByText('Backend / Model')).not.toBeInTheDocument()
    expect(screen.queryByText('MCP')).not.toBeInTheDocument()
    expect(screen.queryByText('Provider')).not.toBeInTheDocument()
    expect(screen.queryByText('Uncommitted')).not.toBeInTheDocument()
    expect(screen.queryByText('Branch diff')).not.toBeInTheDocument()
  })
})
