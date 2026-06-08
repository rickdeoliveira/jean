import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { BackendLabel, getBackendPlainLabel } from './backend-label'

describe('BackendLabel', () => {
  it('shows a beta tag for PI', () => {
    render(<BackendLabel backend="pi" />)

    expect(screen.getByText('Pi')).toBeVisible()
    expect(screen.getByText('Beta')).toBeVisible()
  })
})

describe('getBackendPlainLabel', () => {
  it('marks PI as beta in plain dropdown labels', () => {
    expect(getBackendPlainLabel('pi')).toBe('Pi (Beta)')
  })
})
