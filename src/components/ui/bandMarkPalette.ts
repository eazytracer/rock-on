/**
 * Band mark palette (Band Identity.html; decision 9): the colour, lettering and
 * symbol keys stored in `bands.mark`. The server only checks their length, so
 * this file is the one place they're defined. Unknown keys fall back to the
 * first entry.
 */
import {
  AudioWaveform,
  Crown,
  Disc3,
  Drum,
  Flame,
  Guitar,
  Headphones,
  Mic,
  Music,
  Speaker,
  Star,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BandMark as BandMarkValue } from '../../services/api/bands'
import { markInitials } from '../../domain/marks'

export type { BandMarkValue }

export interface MarkColor {
  key: string
  label: string
  bg: string
  fg: string
}

/**
 * Band Identity's 10, then 6 more that hold up on both the dark and the light
 * surface and stay clear of the band orange and the personal indigo.
 */
export const MARK_COLORS: MarkColor[] = [
  { key: 'orange', label: 'Orange', bg: '#ff7a1a', fg: '#1a0c02' },
  { key: 'rose', label: 'Rose', bg: '#f43f5e', fg: '#2a0510' },
  { key: 'yellow', label: 'Yellow', bg: '#facc15', fg: '#1f1800' },
  { key: 'green', label: 'Green', bg: '#4ade80', fg: '#03200f' },
  { key: 'teal', label: 'Teal', bg: '#2dd4bf', fg: '#032b26' },
  { key: 'sky', label: 'Sky', bg: '#38bdf8', fg: '#03202e' },
  { key: 'indigo', label: 'Indigo', bg: '#7c86f5', fg: '#0b0d2b' },
  { key: 'violet', label: 'Violet', bg: '#c084fc', fg: '#1f0833' },
  { key: 'charcoal', label: 'Charcoal', bg: '#26221e', fg: '#f4efe9' },
  { key: 'bone', label: 'Bone', bg: '#f4efe9', fg: '#1a1512' },
  { key: 'pink', label: 'Pink', bg: '#f472b6', fg: '#2b0618' },
  { key: 'lime', label: 'Lime', bg: '#a3e635', fg: '#172300' },
  { key: 'sand', label: 'Sand', bg: '#d4b483', fg: '#2a1e0c' },
  { key: 'forest', label: 'Forest', bg: '#1f7a4a', fg: '#e8fbef' },
  { key: 'navy', label: 'Navy', bg: '#1e3a8a', fg: '#e6ecff' },
  { key: 'wine', label: 'Wine', bg: '#9f1239', fg: '#ffe4ea' },
]

export interface MarkLettering {
  key: string
  label: string
  /** CSS font-family. */
  family: string
  /** Google Fonts family spec, or null when the app already loads it. */
  google: string | null
  weight: number
  /** Size relative to Poster, so every face reads the same size. */
  scale: number
  upper: boolean
}

export const MARK_LETTERINGS: MarkLettering[] = [
  {
    key: 'poster',
    label: 'Poster',
    family: "'Big Shoulders Display', sans-serif",
    google: null,
    weight: 900,
    scale: 1,
    upper: true,
  },
  {
    key: 'metal',
    label: 'Metal',
    family: "'Pirata One', serif",
    google: 'Pirata+One',
    weight: 400,
    scale: 1.05,
    upper: false,
  },
  {
    key: 'punk',
    label: 'Punk',
    family: "'Permanent Marker', cursive",
    google: 'Permanent+Marker',
    weight: 400,
    scale: 0.9,
    upper: false,
  },
  {
    key: 'marquee',
    label: 'Marquee',
    family: "'Bungee', sans-serif",
    google: 'Bungee',
    weight: 400,
    scale: 0.82,
    upper: true,
  },
  {
    key: 'classic',
    label: 'Classic',
    family: "'Abril Fatface', serif",
    google: 'Abril+Fatface',
    weight: 400,
    scale: 0.95,
    upper: false,
  },
  {
    key: 'script',
    label: 'Script',
    family: "'Yellowtail', cursive",
    google: 'Yellowtail',
    weight: 400,
    scale: 1,
    upper: false,
  },
  {
    key: 'stencil',
    label: 'Stencil',
    family: "'Black Ops One', sans-serif",
    google: 'Black+Ops+One',
    weight: 400,
    scale: 0.85,
    upper: true,
  },
  {
    key: 'indie',
    label: 'Indie',
    family: "'Special Elite', monospace",
    google: 'Special+Elite',
    weight: 400,
    scale: 0.9,
    upper: false,
  },
]

export const MARK_SYMBOLS: { key: string; label: string; icon: LucideIcon }[] =
  [
    { key: 'guitar', label: 'Guitar', icon: Guitar },
    { key: 'mic', label: 'Mic', icon: Mic },
    { key: 'drum', label: 'Drums', icon: Drum },
    { key: 'amp', label: 'Amp', icon: Speaker },
    { key: 'bolt', label: 'Bolt', icon: Zap },
    { key: 'flame', label: 'Flame', icon: Flame },
    { key: 'vinyl', label: 'Vinyl', icon: Disc3 },
    { key: 'headphones', label: 'Headphones', icon: Headphones },
    { key: 'music', label: 'Note', icon: Music },
    { key: 'star', label: 'Star', icon: Star },
    { key: 'crown', label: 'Crown', icon: Crown },
    { key: 'wave', label: 'Wave', icon: AudioWaveform },
  ]

export const markColor = (key?: string | null) =>
  MARK_COLORS.find(c => c.key === key) ?? MARK_COLORS[0]
export const markLettering = (key?: string | null) =>
  MARK_LETTERINGS.find(l => l.key === key) ?? MARK_LETTERINGS[0]
export const markSymbol = (key?: string | null) =>
  MARK_SYMBOLS.find(s => s.key === key) ?? MARK_SYMBOLS[0]

/** The default mark for a band name: its initials on orange, Poster. */
export const defaultMark = (name: string): BandMarkValue => ({
  kind: 'initials',
  initials: markInitials(name).toUpperCase(),
  symbol: null,
  color: 'orange',
  lettering: 'poster',
})

const loaded = new Set<string>()

/**
 * Lettering faces aren't in the app's font bundle. The picker loads all of
 * them when it opens; a mark elsewhere loads only its own face.
 */
export function loadLetteringFonts(keys: (string | null | undefined)[]) {
  const families = keys
    .map(k => markLettering(k).google)
    .filter((g): g is string => !!g && !loaded.has(g))
  if (families.length === 0 || typeof document === 'undefined') return
  families.forEach(f => loaded.add(f))
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${families
    .map(f => `family=${f}`)
    .join('&')}&display=swap`
  link.dataset.markFonts = families.join(',')
  document.head.appendChild(link)
}
