/**
 * Design-token mirror (mobile-redesign-port).
 *
 * The canonical values live as CSS custom properties in `src/index.css` and are exposed
 * to Tailwind via `tailwind.config.js`. PREFER Tailwind utility classes (`bg-bg-1`,
 * `text-ink-2`, `border-accent`, `text-danger`, `bg-accent/10`). Use the references here
 * ONLY for JS-computed inline styles that can't be expressed as a class (e.g. a color
 * chosen at runtime from data).
 *
 * These are `var(--…)` string references, so they stay in sync with the single source of
 * truth automatically — never hard-code the hex again.
 */

export const token = {
  bg0: 'var(--bg-0)',
  bg1: 'var(--bg-1)',
  bg2: 'var(--bg-2)',
  bg3: 'var(--bg-3)',
  bg4: 'var(--bg-4)',
  border1: 'var(--border-1)',
  border2: 'var(--border-2)',
  ink1: 'var(--ink-1)',
  ink2: 'var(--ink-2)',
  ink3: 'var(--ink-3)',
  ink4: 'var(--ink-4)',
  ink5: 'var(--ink-5)',
  ink6: 'var(--ink-6)',
  accent: 'var(--accent)',
  accentSoft: 'var(--accent-soft)',
  accentLine: 'var(--accent-line)',
  info: 'var(--info)',
  success: 'var(--success)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  infoSoft: 'var(--info-soft)',
  successSoft: 'var(--success-soft)',
  warnSoft: 'var(--warn-soft)',
  dangerSoft: 'var(--danger-soft)',
} as const

/** Semantic badge tones — mirrors the prototype's BADGE_TONE. */
export type BadgeTone =
  | 'info'
  | 'success'
  | 'warn'
  | 'danger'
  | 'neutral'
  | 'accent'

export const BADGE_TONE: Record<
  BadgeTone,
  { color: string; bg: string; border: string }
> = {
  info: {
    color: token.info,
    bg: token.infoSoft,
    border: 'rgb(var(--info-rgb) / 0.28)',
  },
  success: {
    color: token.success,
    bg: token.successSoft,
    border: 'rgb(var(--success-rgb) / 0.28)',
  },
  warn: {
    color: token.warn,
    bg: token.warnSoft,
    border: 'rgb(var(--warn-rgb) / 0.32)',
  },
  danger: {
    color: token.danger,
    bg: token.dangerSoft,
    border: 'rgb(var(--danger-rgb) / 0.28)',
  },
  neutral: { color: token.ink3, bg: token.bg3, border: token.border1 },
  accent: {
    color: token.accent,
    bg: token.accentSoft,
    border: token.accentLine,
  },
}

/** Status → tone maps (mirror the prototype's SHOW/SETLIST/PRACTICE_TONE). */
// Design Spec row 07: scheduled = muted/neutral, confirmed = success,
// completed = info, cancelled = danger. (Reconciles Shows/Home/Calendar/Events,
// which all read this single source.)
export const SHOW_TONE = {
  scheduled: 'neutral',
  confirmed: 'success',
  completed: 'info',
  cancelled: 'danger',
} as const satisfies Record<string, BadgeTone>

export const SETLIST_TONE = {
  active: 'accent',
  draft: 'info',
  archived: 'neutral',
} as const satisfies Record<string, BadgeTone>

export const PRACTICE_TONE = {
  scheduled: 'accent',
  'in-progress': 'info',
  completed: 'success',
  cancelled: 'danger',
} as const satisfies Record<string, BadgeTone>

/** Instrument color spine (mirrors data.js INSTRUMENT; vox = accent). */
export const INSTRUMENT_COLOR: Record<string, string> = {
  vox: token.accent,
  bvox: '#ffb648',
  gtr: '#5aa9ff',
  bass: '#9d6cff',
  keys: '#3ec986',
  drums: '#ff5d5d',
}

// ── Single source for tuning + avatar (do not duplicate these palettes) ──
export {
  tuningColor,
  tuningLabel,
  canonicalTuningId,
  CANONICAL_TUNINGS,
  FALLBACK_TUNING_COLOR,
} from './tunings'
export type { TuningEntry } from './tunings'
export { generateAvatarColor, generateInitials } from './songAvatar'
