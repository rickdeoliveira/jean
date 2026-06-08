import { describe, expect, it } from 'vitest'
import {
  formatPiModelLabel,
  getProviderDisplayName,
  getSessionProviderDisplayName,
  sortModelOptionsByRawModel,
} from './toolbar-utils'

describe('getProviderDisplayName', () => {
  it('defaults to Anthropic for missing providers', () => {
    expect(getProviderDisplayName(null)).toBe('Anthropic')
    expect(getProviderDisplayName('__anthropic__')).toBe('Anthropic')
  })

  it('returns custom provider names unchanged', () => {
    expect(getProviderDisplayName('openrouter')).toBe('openrouter')
  })
})

describe('getSessionProviderDisplayName', () => {
  it('uses backend labels for codex and opencode sessions', () => {
    expect(getSessionProviderDisplayName('codex', null)).toBe('OpenAI')
    expect(getSessionProviderDisplayName('opencode', null)).toBe('OpenCode')
    expect(getSessionProviderDisplayName('opencode', '__anthropic__')).toBe(
      'OpenCode'
    )
  })

  it('falls back to provider selection for claude sessions', () => {
    expect(getSessionProviderDisplayName('claude', null)).toBe('Anthropic')
    expect(getSessionProviderDisplayName('claude', 'openrouter')).toBe(
      'openrouter'
    )
  })
})

describe('formatPiModelLabel', () => {
  it('formats active PI provider/model ids', () => {
    expect(formatPiModelLabel('pi/openai-codex/gpt-5.5')).toBe(
      'GPT 5.5 (OpenAI Codex)'
    )
  })
})

describe('sortModelOptionsByRawModel', () => {
  it('sorts provider model ids by raw model version descending', () => {
    const sorted = sortModelOptionsByRawModel([
      { value: 'pi/openai-codex/gpt-5.3-codex-spark', label: 'Spark' },
      { value: 'pi/openai-codex/gpt-5.4-mini', label: 'Mini' },
      { value: 'pi/openai-codex/gpt-5.5', label: 'Newest' },
      { value: 'pi/openai-codex/gpt-5.4', label: 'Older' },
    ])

    expect(sorted.map(option => option.value)).toEqual([
      'pi/openai-codex/gpt-5.5',
      'pi/openai-codex/gpt-5.4',
      'pi/openai-codex/gpt-5.4-mini',
      'pi/openai-codex/gpt-5.3-codex-spark',
    ])
  })

  it('works across backend and provider-specific raw ids', () => {
    const sorted = sortModelOptionsByRawModel([
      { value: 'cursor/gpt-5.4-high-fast', label: 'Cursor 5.4' },
      { value: 'openrouter/anthropic/claude-4-7-sonnet', label: 'OR 4.7' },
      { value: 'openai/gpt-5.5:free', label: 'OpenCode 5.5' },
      { value: 'claude-opus-4-8[1m]', label: 'Claude 4.8' },
    ])

    expect(sorted.map(option => option.value)).toEqual([
      'openai/gpt-5.5:free',
      'cursor/gpt-5.4-high-fast',
      'claude-opus-4-8[1m]',
      'openrouter/anthropic/claude-4-7-sonnet',
    ])
  })
})
