import { describe, expect, it } from 'vitest'
import { PI_EFFORT_LEVEL_OPTIONS } from './toolbar-options'

describe('PI_EFFORT_LEVEL_OPTIONS', () => {
  it('exposes every PI CLI thinking level in CLI order', () => {
    expect(PI_EFFORT_LEVEL_OPTIONS.map(option => option.value)).toEqual([
      'off',
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
    ])
  })
})
