import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders Rock On! title', () => {
    render(<App />)
    expect(screen.getByText('Rock On!')).toBeInTheDocument()
  })

  it('shows setup complete message', () => {
    render(<App />)
    expect(screen.getByText('Rock On! Platform - Setup Complete!')).toBeInTheDocument()
  })
})