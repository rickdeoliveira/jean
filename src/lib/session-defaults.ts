import type { CliBackend } from '@/types/preferences'
import { DEFAULT_MODEL } from '@/store/chat-store'

interface BackendModelPreferences {
  selected_model?: string
  selected_codex_model?: string
  selected_opencode_model?: string
  selected_cursor_model?: string
  selected_pi_model?: string
  selected_commandcode_model?: string
  selected_grok_model?: string
}

export function resolveDefaultModelForBackend(
  backend: CliBackend,
  preferences: BackendModelPreferences | null | undefined
): string {
  if (backend === 'codex') {
    return preferences?.selected_codex_model ?? 'gpt-5.5'
  }
  if (backend === 'opencode') {
    return preferences?.selected_opencode_model ?? 'opencode/gpt-5.3-codex'
  }
  if (backend === 'cursor') {
    return preferences?.selected_cursor_model ?? 'cursor/auto'
  }
  if (backend === 'pi') {
    return preferences?.selected_pi_model ?? 'pi/sonnet'
  }
  if (backend === 'commandcode') {
    return preferences?.selected_commandcode_model ?? 'commandcode/default'
  }
  if (backend === 'grok') {
    return preferences?.selected_grok_model ?? 'grok/grok-composer-2.5-fast'
  }
  return preferences?.selected_model ?? DEFAULT_MODEL
}
