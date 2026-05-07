import { describe, expect, it } from 'vitest'
import { formatDuration } from './time-utils'

describe('formatDuration', () => {
  it('formats sub-minute durations as seconds only', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(23_999)).toBe('23s')
  })

  it('formats minute boundaries as mm:ss', () => {
    expect(formatDuration(60_000)).toBe('01:00')
    expect(formatDuration(145_000)).toBe('02:25')
  })
})
