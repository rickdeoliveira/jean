import { useMemo } from 'react'
import { useClaudeCliStatus } from '@/services/claude-cli'
import { useCodexCliStatus } from '@/services/codex-cli'
import { useOpencodeCliStatus } from '@/services/opencode-cli'
import { useCursorCliStatus } from '@/services/cursor-cli'
import { usePiCliStatus } from '@/services/pi-cli'
import type { CliBackend } from '@/types/preferences'

/**
 * Returns only the backends whose CLIs are currently installed.
 * Use this to filter backend selection UI so users can't pick uninstalled ones.
 */
export function useInstalledBackends(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  const claude = useClaudeCliStatus({ enabled })
  const codex = useCodexCliStatus({ enabled })
  const opencode = useOpencodeCliStatus({ enabled })
  const cursor = useCursorCliStatus({ enabled })
  const pi = usePiCliStatus({ enabled })

  const installedBackends = useMemo(() => {
    const backends: CliBackend[] = []
    if (claude.data?.installed) backends.push('claude')
    if (codex.data?.installed) backends.push('codex')
    if (opencode.data?.installed) backends.push('opencode')
    if (cursor.data?.installed) backends.push('cursor')
    if (pi.data?.installed) backends.push('pi')
    return backends
  }, [
    claude.data?.installed,
    codex.data?.installed,
    opencode.data?.installed,
    cursor.data?.installed,
    pi.data?.installed,
  ])

  return {
    installedBackends,
    isLoading:
      claude.isLoading ||
      codex.isLoading ||
      opencode.isLoading ||
      cursor.isLoading ||
      pi.isLoading,
  }
}
