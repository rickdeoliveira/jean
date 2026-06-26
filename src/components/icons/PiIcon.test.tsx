import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PiIcon } from './PiIcon'

describe('PiIcon', () => {
  it('keeps the official badge background fixed so hover text color cannot hide the mark', () => {
    render(<PiIcon data-testid="pi-icon" />)

    const icon = screen.getByTestId('pi-icon')
    const background = icon.querySelector('rect')
    const paths = icon.querySelectorAll('path')

    expect(background).toHaveAttribute('fill', '#09090b')
    expect(paths).toHaveLength(2)
    paths.forEach(path => {
      expect(path).toHaveAttribute('fill', '#fff')
    })
  })
})
