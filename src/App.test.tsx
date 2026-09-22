import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the placeholder view', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Habit Tracker' }),
    ).toBeInTheDocument()
  })
})
