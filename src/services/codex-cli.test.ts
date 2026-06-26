import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { codexCliQueryKeys, installCodexUsageUpdateListener } from './codex-cli'
import type { CodexUsageSnapshot } from '@/types/codex-cli'

const listenMock = vi.fn()

vi.mock('@/lib/transport', () => ({
  invoke: vi.fn(),
  listen: (...args: unknown[]) => listenMock(...args),
  useWsConnectionStatus: vi.fn(() => true),
}))

vi.mock('@/lib/environment', () => ({
  hasBackend: () => true,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Codex usage update listener', () => {
  beforeEach(() => {
    listenMock.mockReset()
  })

  it('updates the Codex usage query cache from usage-updated events', async () => {
    let capturedHandler:
      | ((event: { payload: CodexUsageSnapshot }) => void)
      | undefined
    const unlisten = vi.fn()
    listenMock.mockImplementation((eventName, handler) => {
      expect(eventName).toBe('codex-cli:usage-updated')
      capturedHandler = handler
      return Promise.resolve(unlisten)
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const snapshot: CodexUsageSnapshot = {
      planType: 'plus',
      session: {
        usedPercent: 42,
        resetsAt: 1_771_456_509,
        limitWindowSeconds: 18_000,
      },
      weekly: {
        usedPercent: 17,
        resetsAt: 1_772_023_891,
        limitWindowSeconds: 604_800,
      },
      reviews: null,
      creditsRemaining: 12.5,
      rateLimitReachedType: 'rate_limit_reached',
      modelLimits: [],
      fetchedAt: 1_771_450_000,
    }

    const cleanup = await installCodexUsageUpdateListener(queryClient)
    capturedHandler?.({ payload: snapshot })

    expect(queryClient.getQueryData(codexCliQueryKeys.usage())).toEqual(
      snapshot
    )
    cleanup()
    expect(unlisten).toHaveBeenCalledTimes(1)
  })
})
