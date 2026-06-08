import { describe, expect, it } from 'vitest'
import { resolveBackend } from './model-utils'

describe('resolveBackend', () => {
  it('resolves PI provider/model ids before Codex provider names', () => {
    expect(resolveBackend('pi/openai-codex/gpt-5.5')).toBe('pi')
  })
})
