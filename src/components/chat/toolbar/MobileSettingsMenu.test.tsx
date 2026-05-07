import { describe, expect, it, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/test/test-utils'
import { MobileSettingsMenu } from './MobileSettingsMenu'

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

describe('MobileSettingsMenu', () => {
  it('opens backend/model picker via gear menu', async () => {
    const user = userEvent.setup()
    const onOpenBackendModelPicker = vi.fn()

    render(
      <MobileSettingsMenu
        isDisabled={false}
        selectedBackend="claude"
        selectedProvider={null}
        backendModelLabel="Claude · Sonnet"
        backendModelLabelText="Claude · Sonnet"
        selectedEffortLevel="medium"
        selectedThinkingLevel="think"
        useAdaptiveThinking={false}
        isCodex={false}
        customCliProfiles={[]}
        onOpenBackendModelPicker={onOpenBackendModelPicker}
        handleProviderChange={vi.fn()}
        handleEffortLevelChange={vi.fn()}
        handleThinkingLevelChange={vi.fn()}
        loadedIssueContexts={[]}
        loadedPRContexts={[]}
        loadedSecurityContexts={[]}
        loadedAdvisoryContexts={[]}
        loadedLinearContexts={[]}
        attachedSavedContexts={[]}
        handleViewIssue={vi.fn()}
        handleViewPR={vi.fn()}
        handleViewSecurityAlert={vi.fn()}
        handleViewAdvisory={vi.fn()}
        handleViewLinear={vi.fn()}
        handleViewSavedContext={vi.fn()}
        availableMcpServers={[]}
        enabledMcpServers={[]}
        activeMcpCount={0}
        onToggleMcpServer={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /settings/i }))

    expect(screen.getByText('Backend / Model')).toBeInTheDocument()
    expect(screen.getByText('MCP')).toBeInTheDocument()

    await user.click(screen.getByText('Backend / Model'))
    expect(onOpenBackendModelPicker).toHaveBeenCalledTimes(1)
  })
})
