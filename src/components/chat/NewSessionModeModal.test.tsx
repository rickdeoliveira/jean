import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, waitFor } from '@/test/test-utils'
import { NewSessionModeModal } from './NewSessionModeModal'
import { useChatStore } from '@/store/chat-store'
import { useTerminalStore } from '@/store/terminal-store'
import { useUIStore } from '@/store/ui-store'

const mutate = vi.fn()
const invoke = vi.fn()
let sessionsData: { sessions: unknown[] }
let nativeSessionsData: unknown[]

vi.mock('@/services/chat', () => ({
  useCreateSession: () => ({
    mutate,
    isPending: false,
  }),
  useSessions: () => ({
    data: sessionsData,
    isLoading: false,
  }),
  useNativeCliSessions: () => ({
    data: nativeSessionsData,
    isLoading: false,
  }),
}))

vi.mock('@/lib/transport', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}))

vi.mock('@/services/claude-cli', () => ({
  useClaudeCliStatus: () => ({
    data: { installed: true, path: '/usr/local/bin/claude' },
    isLoading: false,
  }),
}))

vi.mock('@/services/codex-cli', () => ({
  useCodexCliStatus: () => ({
    data: { installed: true, path: '/usr/local/bin/codex' },
    isLoading: false,
  }),
}))

vi.mock('@/services/opencode-cli', () => ({
  useOpencodeCliStatus: () => ({
    data: { installed: false, path: null },
    isLoading: false,
  }),
}))

vi.mock('@/services/cursor-cli', () => ({
  useCursorCliStatus: () => ({
    data: { installed: false, path: null },
    isLoading: false,
  }),
}))

describe('NewSessionModeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutate.mockReset()
    invoke.mockReset()
    sessionsData = { sessions: [] }
    nativeSessionsData = []
    invoke.mockResolvedValue({
      commandArgs: ['--context-arg', 'context-value'],
    })
    useUIStore.setState({
      newSessionModeTarget: null,
      sessionPrimarySurface: {},
      sessionTerminalIds: {},
    })
    useChatStore.setState({ activeSessionIds: {}, selectedBackends: {} })
    useTerminalStore.setState({
      terminals: {},
      activeTerminalIds: {},
      runningTerminals: new Set(),
      failedTerminals: new Set(),
      terminalVisible: false,
      terminalPanelOpen: {},
      modalTerminalOpen: {},
    })
  })

  it('defaults Enter to a normal Jean chat session', () => {
    mutate.mockImplementation(
      (
        _args: unknown,
        opts?: { onSuccess?: (session: { id: string }) => void }
      ) => {
        opts?.onSuccess?.({ id: 'session-1' })
      }
    )
    useUIStore.getState().openNewSessionModeModal({
      worktreeId: 'worktree-1',
      worktreePath: '/tmp/worktree-1',
      origin: 'chat',
    })

    render(<NewSessionModeModal />)

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(mutate).toHaveBeenCalledWith(
      { worktreeId: 'worktree-1', worktreePath: '/tmp/worktree-1' },
      expect.any(Object)
    )
    expect(useChatStore.getState().activeSessionIds['worktree-1']).toBe(
      'session-1'
    )
    expect(useUIStore.getState().sessionPrimarySurface['session-1']).toBe(
      'chat'
    )
  })

  it('auto-opens the default Jean chat session without showing the picker', async () => {
    mutate.mockImplementation(
      (
        _args: unknown,
        opts?: { onSuccess?: (session: { id: string }) => void }
      ) => {
        opts?.onSuccess?.({ id: 'session-default' })
      }
    )
    useUIStore.getState().openNewSessionModeModal({
      worktreeId: 'worktree-1',
      worktreePath: '/tmp/worktree-1',
      origin: 'chat',
      intent: 'default',
    })

    render(<NewSessionModeModal />)

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        { worktreeId: 'worktree-1', worktreePath: '/tmp/worktree-1' },
        expect.any(Object)
      )
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useChatStore.getState().activeSessionIds['worktree-1']).toBe(
      'session-default'
    )
  })

  it('opens an installed backend picker and starts a new terminal session', async () => {
    mutate.mockImplementation(
      (
        _args: unknown,
        opts?: {
          onSuccess?: (session: {
            id: string
            name: string
            backend?: string
          }) => void
        }
      ) => {
        opts?.onSuccess?.({
          id: 'session-terminal-1',
          name: 'Codex',
          backend: 'codex',
        })
      }
    )
    useUIStore.getState().openNewSessionModeModal({
      worktreeId: 'worktree-1',
      worktreePath: '/tmp/worktree-1',
      origin: 'chat',
    })

    render(<NewSessionModeModal />)

    expect(screen.getByText('Codex')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.queryByText('OpenCode')).toBeNull()
    expect(screen.getByText('Terminal')).toBeInTheDocument()
    expect(
      screen.getByTestId('new-session-backend-separator')
    ).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '2' })

    expect(screen.getByText('Codex sessions')).toBeInTheDocument()
    expect(
      screen.getByText('No existing Codex sessions for this worktree.')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('native-cli-session-search-separator')
    ).toBeInTheDocument()
    const newCodexSessionButton = screen.getByRole('button', {
      name: 'New Codex session',
    })
    expect(newCodexSessionButton).toHaveClass('bg-background')
    expect(newCodexSessionButton).not.toHaveClass('bg-primary/12')
    expect(newCodexSessionButton).toContainElement(screen.getByText('↵'))

    fireEvent.click(screen.getByText('New Codex session'))

    expect(mutate).toHaveBeenCalledWith(
      {
        worktreeId: 'worktree-1',
        worktreePath: '/tmp/worktree-1',
        name: 'Codex',
        backend: 'codex',
        primarySurface: 'terminal',
        terminalCommand: '/usr/local/bin/codex',
        terminalCommandArgs: [],
        terminalLabel: 'Codex',
      },
      expect.any(Object)
    )
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('prepare_backend_terminal_context', {
        sessionId: 'session-terminal-1',
        worktreeId: 'worktree-1',
        backend: 'codex',
      })
    })
    expect(useTerminalStore.getState().terminals['worktree-1']).toHaveLength(1)
    expect(
      useTerminalStore.getState().terminals['worktree-1']?.[0]
    ).toMatchObject({
      kind: 'session',
      command: '/usr/local/bin/codex',
      commandArgs: ['--context-arg', 'context-value'],
    })
    expect(
      useTerminalStore.getState().activeTerminalIds['worktree-1']
    ).toBeUndefined()
    expect(
      useTerminalStore.getState().terminalPanelOpen['worktree-1'] ?? false
    ).toBe(false)
    expect(useTerminalStore.getState().terminalVisible).toBe(false)
    expect(
      useUIStore.getState().sessionPrimarySurface['session-terminal-1']
    ).toBe('terminal')
    expect(
      useUIStore.getState().sessionTerminalIds['session-terminal-1']
    ).toEqual(expect.any(String))
    expect(useChatStore.getState().activeSessionIds['worktree-1']).toBe(
      'session-terminal-1'
    )
    expect(useChatStore.getState().selectedBackends['session-terminal-1']).toBe(
      'codex'
    )
  })

  it('opens a plain terminal session with shortcut 1', async () => {
    mutate.mockImplementation(
      (
        _args: unknown,
        opts?: { onSuccess?: (session: { id: string; name: string }) => void }
      ) => {
        opts?.onSuccess?.({ id: 'session-plain-terminal-1', name: 'Terminal' })
      }
    )
    useUIStore.getState().openNewSessionModeModal({
      worktreeId: 'worktree-1',
      worktreePath: '/tmp/worktree-1',
      origin: 'chat',
    })

    render(<NewSessionModeModal />)

    fireEvent.keyDown(window, { key: '1' })

    expect(screen.getByText('Terminal sessions')).toBeInTheDocument()
    expect(
      screen.getByTestId('native-cli-session-search-separator')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'New Terminal session' })
    ).toContainElement(screen.getByText('↵'))
    fireEvent.click(screen.getByText('New Terminal session'))

    expect(mutate).toHaveBeenCalledWith(
      {
        worktreeId: 'worktree-1',
        worktreePath: '/tmp/worktree-1',
        name: 'Terminal',
        backend: undefined,
        primarySurface: 'terminal',
        terminalCommand: null,
        terminalCommandArgs: [],
        terminalLabel: 'Terminal',
      },
      expect.any(Object)
    )
    await waitFor(() => {
      expect(useTerminalStore.getState().terminals['worktree-1']).toHaveLength(
        1
      )
    })
    expect(
      useTerminalStore.getState().terminals['worktree-1']?.[0]
    ).toMatchObject({
      kind: 'session',
      command: null,
      commandArgs: [],
      label: 'Terminal',
    })
    expect(
      useTerminalStore.getState().activeTerminalIds['worktree-1']
    ).toBeUndefined()
    expect(
      useTerminalStore.getState().terminalPanelOpen['worktree-1'] ?? false
    ).toBe(false)
    expect(useTerminalStore.getState().terminalVisible).toBe(false)
    expect(
      useUIStore.getState().sessionPrimarySurface['session-plain-terminal-1']
    ).toBe('terminal')
    expect(
      useUIStore.getState().sessionTerminalIds['session-plain-terminal-1']
    ).toEqual(expect.any(String))
    expect(useChatStore.getState().activeSessionIds['worktree-1']).toBe(
      'session-plain-terminal-1'
    )
    expect(
      useChatStore.getState().selectedBackends['session-plain-terminal-1']
    ).toBeUndefined()
    expect(invoke).not.toHaveBeenCalledWith(
      'prepare_backend_terminal_context',
      expect.any(Object)
    )
  })

  it('continues an existing native CLI terminal session without creating a new one', async () => {
    sessionsData = {
      sessions: [
        {
          id: 'existing-codex-session',
          name: 'Codex old task',
          backend: 'codex',
          primary_surface: 'terminal',
          terminal_command: '/usr/local/bin/codex',
          terminal_command_args: [],
          terminal_label: 'Codex old task',
          message_count: 0,
          updated_at: 1710000000,
          messages: [],
        },
      ],
    }
    useUIStore.getState().openNewSessionModeModal({
      worktreeId: 'worktree-1',
      worktreePath: '/tmp/worktree-1',
      origin: 'chat',
    })

    render(<NewSessionModeModal />)

    fireEvent.keyDown(window, { key: '2' })
    fireEvent.click(screen.getByText('Codex old task'))

    expect(mutate).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('prepare_backend_terminal_context', {
        sessionId: 'existing-codex-session',
        worktreeId: 'worktree-1',
        backend: 'codex',
      })
    })
    expect(useTerminalStore.getState().terminals['worktree-1']).toHaveLength(1)
    expect(useChatStore.getState().activeSessionIds['worktree-1']).toBe(
      'existing-codex-session'
    )
    expect(
      useChatStore.getState().selectedBackends['existing-codex-session']
    ).toBe('codex')
  })

  it('imports native Codex history into a Jean terminal session', async () => {
    nativeSessionsData = [
      {
        backend: 'codex',
        id: 'native-codex-thread',
        title: 'Native Codex task',
        cwd: '/tmp/worktree-1',
        updatedAt: 1778656196,
        resumeArgs: ['resume', 'native-codex-thread'],
        sourcePath: '/Users/test/.codex/sessions/native.jsonl',
      },
    ]
    mutate.mockImplementation(
      (
        _args: unknown,
        opts?: { onSuccess?: (session: { id: string; name: string }) => void }
      ) => {
        opts?.onSuccess?.({
          id: 'imported-native-session',
          name: 'Native Codex task',
        })
      }
    )
    useUIStore.getState().openNewSessionModeModal({
      worktreeId: 'worktree-1',
      worktreePath: '/tmp/worktree-1',
      origin: 'chat',
    })

    render(<NewSessionModeModal />)

    fireEvent.keyDown(window, { key: '2' })
    fireEvent.click(screen.getByText('Native Codex task'))

    expect(mutate).toHaveBeenCalledWith(
      {
        worktreeId: 'worktree-1',
        worktreePath: '/tmp/worktree-1',
        name: 'Native Codex task',
        backend: 'codex',
        primarySurface: 'terminal',
        terminalCommand: '/usr/local/bin/codex',
        terminalCommandArgs: ['resume', 'native-codex-thread'],
        terminalLabel: 'Native Codex task',
      },
      expect.any(Object)
    )
    await waitFor(() => {
      expect(useTerminalStore.getState().terminals['worktree-1']).toHaveLength(
        1
      )
    })
    expect(
      useTerminalStore.getState().terminals['worktree-1']?.[0]
    ).toMatchObject({
      command: '/usr/local/bin/codex',
      commandArgs: ['resume', 'native-codex-thread'],
      label: 'Native Codex task',
    })
  })

  it('filters Jean and native CLI sessions by search text', () => {
    sessionsData = {
      sessions: [
        {
          id: 'existing-codex-session',
          name: 'Fix dashboard bug',
          backend: 'codex',
          primary_surface: 'terminal',
          message_count: 0,
          updated_at: 1710000000,
          messages: [],
        },
      ],
    }
    nativeSessionsData = [
      {
        backend: 'codex',
        id: 'native-codex-thread',
        title: 'Sponsor cleanup task',
        cwd: '/tmp/worktree-1',
        updatedAt: 1778656196,
        resumeArgs: ['resume', 'native-codex-thread'],
        sourcePath: '/Users/test/.codex/sessions/native.jsonl',
      },
    ]
    useUIStore.getState().openNewSessionModeModal({
      worktreeId: 'worktree-1',
      worktreePath: '/tmp/worktree-1',
      origin: 'chat',
    })

    render(<NewSessionModeModal />)

    fireEvent.keyDown(window, { key: '2' })
    expect(screen.getByText('Fix dashboard bug')).toBeInTheDocument()
    expect(screen.getByText('Sponsor cleanup task')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search native CLI sessions'), {
      target: { value: 'sponsor' },
    })

    expect(screen.queryByText('Fix dashboard bug')).toBeNull()
    expect(screen.getByText('Sponsor cleanup task')).toBeInTheDocument()
  })

  it('shows only five recent sessions until search uses full history', () => {
    nativeSessionsData = Array.from({ length: 6 }, (_, index) => ({
      backend: 'codex',
      id: `native-codex-thread-${index}`,
      title:
        index === 5 ? 'Ancient hidden sponsor task' : `Recent task ${index}`,
      cwd: '/tmp/worktree-1',
      updatedAt: 1778656196 - index,
      resumeArgs: ['resume', `native-codex-thread-${index}`],
      sourcePath: `/Users/test/.codex/sessions/native-${index}.jsonl`,
    }))
    useUIStore.getState().openNewSessionModeModal({
      worktreeId: 'worktree-1',
      worktreePath: '/tmp/worktree-1',
      origin: 'chat',
    })

    render(<NewSessionModeModal />)

    fireEvent.keyDown(window, { key: '2' })
    expect(screen.queryByText('Ancient hidden sponsor task')).toBeNull()
    expect(screen.getByText('Recent task 0')).toBeInTheDocument()
    expect(screen.getByText('Recent task 4')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search native CLI sessions'), {
      target: { value: 'ancient' },
    })

    expect(screen.getByText('Ancient hidden sponsor task')).toBeInTheDocument()
    expect(screen.queryByText('Recent task 0')).toBeNull()
  })

  it('focuses the new CLI session button and creates on Enter', async () => {
    const user = userEvent.setup()
    useUIStore.getState().openNewSessionModeModal({
      worktreeId: 'worktree-1',
      worktreePath: '/tmp/worktree-1',
      origin: 'chat',
    })

    render(<NewSessionModeModal />)

    fireEvent.keyDown(window, { key: '2' })
    const newSessionButton = screen.getByRole('button', {
      name: 'New Codex session',
    })
    await waitFor(() => expect(newSessionButton).toHaveFocus())

    await user.keyboard('{Enter}')

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Codex',
        backend: 'codex',
        primarySurface: 'terminal',
      }),
      expect.any(Object)
    )
  })

  it('does not create a new CLI session when pressing Enter in search', async () => {
    const user = userEvent.setup()
    useUIStore.getState().openNewSessionModeModal({
      worktreeId: 'worktree-1',
      worktreePath: '/tmp/worktree-1',
      origin: 'chat',
    })

    render(<NewSessionModeModal />)

    fireEvent.keyDown(window, { key: '2' })
    const searchInput = screen.getByLabelText('Search native CLI sessions')
    await user.click(searchInput)
    await user.keyboard('{Enter}')

    expect(mutate).not.toHaveBeenCalled()
  })

  it('marks chat sessions as chat surfaces', () => {
    mutate.mockImplementation(
      (
        _args: unknown,
        opts?: { onSuccess?: (session: { id: string }) => void }
      ) => {
        opts?.onSuccess?.({ id: 'session-chat-1' })
      }
    )
    useUIStore.getState().openNewSessionModeModal({
      worktreeId: 'worktree-1',
      worktreePath: '/tmp/worktree-1',
      origin: 'chat',
    })

    render(<NewSessionModeModal />)

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(useUIStore.getState().sessionPrimarySurface['session-chat-1']).toBe(
      'chat'
    )
  })
})
