/**
 * Model utilities for feature detection and CLI compatibility.
 *
 * Claude 4.6 Opus models introduce adaptive thinking (effort parameter)
 * replacing traditional thinking levels (budget_tokens). This is supported
 * from Claude CLI >= 2.1.32. Sonnet and other models continue to use
 * traditional thinking levels.
 */

import { compareVersions } from './version-utils'

/** Minimum CLI version that supports Claude 4.6 adaptive thinking */
const ADAPTIVE_THINKING_MIN_CLI_VERSION = '2.1.32'

/**
 * Resolve which CLI backend to use based on the model string.
 */
export function resolveBackend(
  model: string
): 'claude' | 'codex' | 'opencode' | 'cursor' | 'pi' {
  if (model.startsWith('cursor/')) return 'cursor'
  if (model.startsWith('opencode/')) return 'opencode'
  if (model.startsWith('pi/')) return 'pi'
  if (model.startsWith('codex') || model.includes('codex')) return 'codex'
  return 'claude'
}

/**
 * Check if the current model + CLI version combination supports
 * adaptive thinking (effort parameter) instead of traditional thinking levels.
 *
 * Returns true when:
 * - Model is a Claude Opus variant ('claude-opus-*')
 * - CLI version is >= 2.1.32
 *
 * Sonnet models use traditional thinking levels, not adaptive thinking.
 */
export function supportsAdaptiveThinking(
  model: string,
  cliVersion: string | null | undefined
): boolean {
  const isOpusModel = model.startsWith('claude-opus-')
  if (!isOpusModel) return false
  if (!cliVersion) return false
  return compareVersions(cliVersion, ADAPTIVE_THINKING_MIN_CLI_VERSION) >= 0
}
