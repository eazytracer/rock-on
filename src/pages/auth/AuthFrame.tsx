/**
 * The auth screen frame and its small kit: one column (420 px on desktop, no
 * sidebar), the Rock On lockup, a title, an inline error slot, and the fields
 * and buttons every auth screen shares. Design: Account and Settings 1–4, 10;
 * desktop-more.css "auth".
 */
import React, { useState } from 'react'
import { AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { BackCrumb } from '../../components/layout/MobileHeader'

/** Auth is always on the brand orange, whatever context was last used. */
const BRAND_ACCENT = {
  dark: { accent: '255 122 26', onAccent: '26 12 2', ink: '255 122 26' },
  light: { accent: '255 122 26', onAccent: '26 12 2', ink: '184 77 0' },
}

export const AuthFrame: React.FC<{
  'data-testid': string
  /** Back crumb above the column ("‹ Sign in"). */
  back?: { label: string; to: string }
  /** Show the Rock On lockup and tagline (sign in). */
  logo?: boolean
  title?: React.ReactNode
  lede?: React.ReactNode
  /** Rendered above the error slot (social buttons and the OR rule). */
  lead?: React.ReactNode
  /** Inline error slot, above the fields. */
  error?: React.ReactNode
  /** Pinned to the bottom of the column on phones. */
  footer?: React.ReactNode
  /** 620 px column on desktop (Get started). */
  wide?: boolean
  centered?: boolean
  children?: React.ReactNode
}> = ({
  'data-testid': testId,
  back,
  logo,
  title,
  lede,
  lead,
  error,
  footer,
  wide,
  centered,
  children,
}) => {
  const { resolvedTheme } = useTheme()
  const brand = BRAND_ACCENT[resolvedTheme]
  return (
    <div
      data-testid={testId}
      style={
        {
          '--accent-rgb': brand.accent,
          '--on-accent-rgb': brand.onAccent,
          '--accent-ink-rgb': brand.ink,
        } as React.CSSProperties
      }
      className="min-h-[100dvh] bg-bg-1 text-ink-1 flex flex-col md:grid md:place-items-center md:px-5 md:py-10 overflow-y-auto custom-scrollbar"
    >
      <div
        className={`flex flex-col flex-1 w-full px-5 pb-7 gap-2.5 md:flex-none md:px-0 md:pb-0 md:gap-3 ${
          wide ? 'md:w-[min(620px,100%)]' : 'md:w-[min(420px,100%)]'
        } ${centered ? 'text-center md:items-center' : ''}`}
      >
        {back && (
          <div className="pt-3 md:pt-0 md:mb-2 self-start">
            <BackCrumb
              label={back.label}
              to={back.to}
              data-testid="auth-back-link"
            />
          </div>
        )}
        {logo && (
          <>
            <AuthLogo />
            <p className="text-[15px] text-ink-2 mb-[18px] md:mb-2">
              Songs, setlists and shows for your band.
            </p>
          </>
        )}
        {title && (
          <h1
            className={`font-display font-extrabold uppercase leading-[.92] text-ink-1 text-[50px] md:text-[44px] ${
              back ? 'mt-3 md:mt-0' : 'mt-6 md:mt-0'
            }`}
          >
            {title}
          </h1>
        )}
        {lede && (
          <p className="text-[15px] text-ink-2 mb-2" data-testid="auth-lede">
            {lede}
          </p>
        )}
        {lead}
        {error}
        {children}
        {footer && <div className="mt-auto pt-4 md:mt-2 md:pt-0">{footer}</div>}
      </div>
    </div>
  )
}

/** Horns + the Strung wordmark (design/source/Brand.html, B + Horns). */
export const AuthLogo: React.FC = () => {
  const { resolvedTheme } = useTheme()
  const light = resolvedTheme === 'light'
  const orange = light ? '#d85f00' : '#ff7a1a'
  return (
    <div
      className="flex items-center gap-3.5 mt-11 mb-2 md:mt-0"
      data-testid="auth-logo"
      aria-label="Rock On"
      role="img"
    >
      <img
        src={light ? '/brand/horns-ink.png' : '/brand/horns-bone.png'}
        alt=""
        className="w-16 h-16 object-contain"
      />
      <div
        aria-hidden
        className="font-display font-extrabold uppercase text-[46px] leading-none flex items-stretch gap-[.14em] whitespace-nowrap text-ink-1"
      >
        <span
          className="w-[.12em] rounded-[.03em]"
          style={{ background: orange }}
        />
        <span className="relative pt-[.02em] pr-[.06em] pl-[.04em]">
          <span
            className="absolute opacity-[.28]"
            style={{
              inset: '.1em -.04em .08em -.2em',
              background:
                'repeating-linear-gradient(to bottom, currentColor 0 .018em, transparent .018em .26em)',
            }}
          />
          <span className="relative">
            Rock <span style={{ color: orange }}>On</span>
          </span>
        </span>
      </div>
    </div>
  )
}

/** Inline error above the fields. */
export const AuthError: React.FC<{
  children: React.ReactNode
  'data-testid'?: string
}> = ({ children, 'data-testid': testId = 'auth-error' }) => (
  <div
    role="alert"
    data-testid={testId}
    className="flex gap-2.5 items-start px-3.5 py-3 rounded-[14px] text-[13.5px] text-ink-1 text-left bg-[color-mix(in_srgb,rgb(var(--danger-rgb))_14%,rgb(var(--bg-2-rgb)))]"
  >
    <AlertTriangle size={17} className="text-danger shrink-0 mt-px" />
    <div>{children}</div>
  </div>
)

/**
 * Fields: on phones one grouped surface with the label inside each row (kit
 * `r-grp` + `r-fld`); on desktop a label over a boxed input (`.pfl`).
 */
export const AuthFields: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="rounded-[20px] overflow-hidden bg-bg-2 shadow-group divide-y divide-divider md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none md:divide-y-0 flex flex-col md:gap-3">
    {children}
  </div>
)

export const AuthField: React.FC<{
  label: string
  id: string
  name: string
  'data-testid': string
  type?: 'text' | 'email' | 'password'
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  placeholder?: string
  invalid?: boolean
  autoFocus?: boolean
}> = ({
  label,
  id,
  name,
  'data-testid': testId,
  type = 'text',
  value,
  onChange,
  autoComplete,
  placeholder,
  invalid,
  autoFocus,
}) => {
  const [shown, setShown] = useState(false)
  const isPassword = type === 'password'
  const ring = invalid
    ? 'shadow-[inset_0_0_0_2px_rgb(var(--danger-rgb))]'
    : 'focus-within:shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]'
  return (
    <div
      className={`flex items-center gap-3 min-h-[60px] px-4 py-2 md:p-0 md:min-h-0 md:shadow-none md:focus-within:shadow-none ${ring}`}
    >
      <div className="flex-1 min-w-0 text-left">
        <label
          htmlFor={id}
          className="block font-mono text-[10px] md:text-[10.5px] tracking-[.08em] md:tracking-[.1em] uppercase text-ink-3 mb-[3px] md:mb-1.5"
        >
          {label}
        </label>
        <div className="relative">
          <input
            id={id}
            name={name}
            data-testid={testId}
            type={isPassword && shown ? 'text' : type}
            value={value}
            onChange={e => onChange(e.target.value)}
            autoComplete={autoComplete}
            placeholder={placeholder}
            autoFocus={autoFocus}
            aria-invalid={invalid || undefined}
            className={`w-full bg-transparent text-[17px] font-semibold text-ink-1 placeholder-ink-5 placeholder:font-medium focus:outline-none md:h-12 md:px-3.5 md:rounded-xl md:bg-bg-2 md:text-[15px] md:font-medium ${
              isPassword ? 'pr-10 md:pr-12' : ''
            } ${
              invalid
                ? 'md:shadow-[inset_0_0_0_2px_rgb(var(--danger-rgb))]'
                : 'md:shadow-[inset_0_0_0_1px_rgb(var(--border-1-rgb))] md:focus:shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]'
            }`}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShown(s => !s)}
              aria-label={shown ? 'Hide password' : 'Show password'}
              data-testid={`${testId.replace(/-input$/, '')}-toggle`}
              className="absolute -right-2 md:right-1 top-1/2 -translate-y-1/2 w-11 h-11 md:w-10 md:h-10 grid place-items-center text-ink-2 md:text-ink-3 hover:text-ink-1"
            >
              {shown ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Google's standard button: white with its own logo in both themes. */
export const GoogleButton: React.FC<{
  onClick: () => void
  disabled?: boolean
}> = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    data-testid="auth-google-button"
    className="w-full h-[52px] rounded-full inline-flex items-center justify-center gap-2.5 font-sans font-bold text-[15px] bg-white text-[#1f1f1f] shadow-[inset_0_0_0_1px_#747775] transition-transform duration-100 ease-rock active:scale-[.96] disabled:opacity-40"
  >
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23"
      />
      <path
        fill="#FBBC05"
        d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4"
      />
    </svg>
    Continue with Google
  </button>
)

export const OrRule: React.FC = () => (
  <div className="flex items-center gap-2.5 font-mono text-[10.5px] text-ink-3 my-1.5 md:my-0 before:content-[''] before:flex-1 before:h-px before:bg-border-1 after:content-[''] after:flex-1 after:h-px after:bg-border-1">
    OR
  </div>
)
