import { createElement, type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStatePersistence } from './useSessionStatePersistence'
import { useChatStore } from '@/store/chat-store'
import type { WorktreeSessions } from '@/types/chat'

const { mockUseSessions, mockUpdateSessionState } = vi.hoisted(() => ({
  mockUseSessions: vi.fn(),
  mockUpdateSessionState: vi.fn(),
}))

vi.mock('@/services/chat', () => ({
  useSessions: mockUseSessions,
  useUpdateSessionState: () => ({ mutate: mockUpdateSessionState }),
  chatQueryKeys: {
    session: (sessionId: string) => ['session', sessionId],
    sessions: (worktreeId: string) => ['sessions', worktreeId],
  },
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useSessionStatePersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useChatStore.setState({
      activeWorktreeId: 'worktree-1',
      activeWorktreePath: '/repo',
      activeSessionIds: { 'worktree-1': 'session-1' },
      sessionWorktreeMap: { 'session-1': 'worktree-1' },
      worktreePaths: { 'worktree-1': '/repo' },
      waitingForInputSessionIds: { 'session-1': true },
      reviewingSessions: {},
      pendingPlanMessageIds: { 'session-1': 'plan-message-1' },
    })
  })

  it('does not change a selected plan-waiting Codex session to review', async () => {
    const sessionsData: WorktreeSessions = {
      worktree_id: 'worktree-1',
      active_session_id: 'session-1',
      version: 1,
      sessions: [
        {
          id: 'session-1',
          name: 'Waiting plan',
          order: 0,
          created_at: 1,
          updated_at: 2,
          messages: [],
          backend: 'codex',
          waiting_for_input: true,
          waiting_for_input_type: 'plan',
          pending_plan_message_id: 'plan-message-1',
          is_reviewing: false,
          last_run_status: 'completed',
          last_run_execution_mode: 'plan',
        },
      ],
    }
    mockUseSessions.mockReturnValue({ data: sessionsData })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const wrapper = createWrapper(queryClient)

    renderHook(() => useSessionStatePersistence(), { wrapper })

    await waitFor(() => {
      const state = useChatStore.getState()
      expect(state.waitingForInputSessionIds['session-1']).toBe(true)
      expect(state.reviewingSessions['session-1']).toBeUndefined()
    })
    expect(mockUpdateSessionState).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        isReviewing: true,
        waitingForInput: false,
      })
    )
  })
})
