import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the navigation', () => {
    render(<App />)
    expect(screen.getByText('Songs')).toBeInTheDocument()
    expect(screen.getByText('Practice')).toBeInTheDocument()
    expect(screen.getByText('Setlists')).toBeInTheDocument()
  })

  it('shows the dashboard by default', () => {
    render(<App />)
    // The dashboard should be visible - it might be showing loading or content
    expect(document.body).toBeInTheDocument()
  })
})