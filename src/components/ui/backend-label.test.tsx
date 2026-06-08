import { render, screen } from '@/test/test-utils'
import { describe, expect, it } from 'vitest'
import {
  BackendLabel,
  getBackendPlainLabel,
} from '@/components/ui/backend-label'

describe('backend labels', () => {
  it('marks Command Code as beta, not Cursor, in plain labels', () => {
    expect(getBackendPlainLabel('cursor')).toBe('Cursor')
    expect(getBackendPlainLabel('commandcode')).toBe('Command Code (Beta)')
  })

  it('renders the beta badge on Command Code, not Cursor', () => {
    const { rerender } = render(<BackendLabel backend="cursor" />)

    expect(screen.getByText('Cursor')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).toBeNull()

    rerender(<BackendLabel backend="commandcode" />)

    expect(screen.getByText('Command Code')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })
})
