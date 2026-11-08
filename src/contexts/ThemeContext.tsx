/* eslint-disable react-refresh/only-export-components */
/**
 * Theme (system / light / dark) and context accent.
 *
 * Writes two attributes on <html> that src/index.css keys off:
 * - data-theme: the resolved theme ('light' | 'dark')
 * - data-ctx:   'personal' | 'band' (Personal swaps the accent to indigo)
 *
 * The choice is saved per user (user_preferences.theme) and mirrored in
 * localStorage so the first paint is right before the server answers (the
 * inline script in index.html reads the same key).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from './AuthContext'
import {
  getPreferences,
  setPreferences,
  type ThemePreference,
} from '../services/api/preferences'
import { createLogger } from '../utils/logger'

const log = createLogger('ThemeContext')
const STORAGE_KEY = 'rockon.theme'

interface ThemeContextValue {
  theme: ThemePreference
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function readStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // storage unavailable (private mode): fall through to the default
  }
  return 'system'
}

function systemPrefersLight(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: light)').matches
  )
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, contextType } = useAuth()
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme)
  const [systemLight, setSystemLight] = useState(systemPrefersLight)

  // Follow the OS while on 'system'.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)')
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setSystemLight(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Load the saved choice once signed in.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    getPreferences(user.id)
      .then(prefs => {
        if (cancelled) return
        setThemeState(prefs.theme)
        try {
          localStorage.setItem(STORAGE_KEY, prefs.theme)
        } catch {
          // ignore
        }
      })
      .catch(err => log.error('Failed to load preferences', err))
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemLight ? 'light' : 'dark') : theme

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        'content',
        resolvedTheme === 'light' ? '#f7f3ee' : '#0c0b0a'
      )
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.dataset.ctx = contextType
  }, [contextType])

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setThemeState(next)
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore
      }
      if (user?.id) {
        setPreferences(user.id, { theme: next }).catch(err =>
          log.error('Failed to save theme', err)
        )
      }
    },
    [user?.id]
  )

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
