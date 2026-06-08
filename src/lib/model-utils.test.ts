import { describe, expect, it } from 'vitest'
import { getModelImpliedBackend, resolveBackend } from './model-utils'

describe('resolveBackend', () => {
  it('resolves PI provider/model ids before Codex provider names', () => {
    expect(resolveBackend('pi/openai-codex/gpt-5.5')).toBe('pi')
  })
})

describe('getModelImpliedBackend', () => {
  it('treats PI provider/model ids as PI even when provider contains codex', () => {
    expect(getModelImpliedBackend('pi/openai-codex/gpt-5.5')).toBe('pi')
  })

  it('treats raw GPT model ids as Codex', () => {
    expect(getModelImpliedBackend('gpt-5.5')).toBe('codex')
  })
})
