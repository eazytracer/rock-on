/**
 * TuningTreatmentPreview — compare 4 visual treatments × 3 palette variants
 * for the proposed per-tuning color system.
 *
 * Goal: let reviewers pick (a) which treatment feels right, (b) which palette
 * is the most legible on dark backgrounds at small UI sizes.
 */

import React, { useState } from 'react'
import { Guitar, Clock, FileText } from 'lucide-react'
import { MOCK_SETLIST } from './mockData'
import { PALETTES, PaletteKey, tuningColor, tuningLabel } from './tuningColors'

type Treatment = 'icon' | 'stripe' | 'pill' | 'combo'

const TREATMENTS: Array<{ key: Treatment; label: string; hint: string }> = [
  {
    key: 'icon',
    label: 'Icon only',
    hint: 'Most subtle — tint the guitar icon',
  },
  {
    key: 'stripe',
    label: 'Left stripe',
    hint: 'Scannable at a glance down a list',
  },
  {
    key: 'pill',
    label: 'Pill label',
    hint: 'Strongest — the tuning chip is colored',
  },
  {
    key: 'combo',
    label: 'Pill + stripe',
    hint: 'Strongest signal — pill chip plus left-edge stripe',
  },
]

const secondsToMMSS = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export const TuningTreatmentPreview: React.FC = () => {
  const [palette, setPalette] = useState<PaletteKey>('A')
  const [treatment, setTreatment] = useState<Treatment>('combo')

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs uppercase text-[#707070] mb-2 tracking-wider">
            Treatment
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {TREATMENTS.map(t => (
              <button
                key={t.key}
                onClick={() => setTreatment(t.key)}
                data-testid={`tuning-treatment-${t.key}`}
                className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                  treatment === t.key
                    ? 'bg-[#f17827ff]/10 border-[#f17827ff] text-white'
                    : 'bg-[#0f0f0f] border-[#2a2a2a] text-[#a0a0a0] hover:border-[#3a3a3a]'
                }`}
              >
                <div className="font-medium">{t.label}</div>
                <div className="text-xs text-[#707070] mt-0.5">{t.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs uppercase text-[#707070] mb-2 tracking-wider">
            Palette
          </h3>
          <div className="space-y-2">
            {(['A', 'B', 'C'] as PaletteKey[]).map(p => (
              <button
                key={p}
                onClick={() => setPalette(p)}
                data-testid={`tuning-palette-${p}`}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                  palette === p
                    ? 'bg-[#f17827ff]/10 border-[#f17827ff]'
                    : 'bg-[#0f0f0f] border-[#2a2a2a] hover:border-[#3a3a3a]'
                }`}
              >
                <span className="text-white font-medium text-sm w-6">{p}</span>
                <div className="flex gap-1 flex-1 min-w-0">
                  {PALETTES[p].map(entry => (
                    <div
                      key={entry.id}
                      className="flex-1 h-6 rounded"
                      style={{ backgroundColor: entry.color }}
                      title={entry.label}
                    />
                  ))}
                </div>
              </button>
            ))}
            <p className="text-xs text-[#707070] mt-2">
              A: bright & saturated • B: muted pastels • C: color-wheel
              progression
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4">
        <h3 className="text-xs uppercase text-[#707070] mb-2 tracking-wider">
          Legend (palette {palette})
        </h3>
        <div className="flex flex-wrap gap-2">
          {PALETTES[palette].map(entry => (
            <div
              key={entry.id}
              className="flex items-center gap-2 px-2 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-xs"
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-[#d4d4d4]">{entry.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sample setlist with selected treatment */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">Sample setlist (8 songs)</h3>
          <span className="text-xs text-[#707070]">
            Treatment: <span className="text-white">{treatment}</span> •
            Palette: <span className="text-white">{palette}</span>
          </span>
        </div>

        <div className="space-y-2">
          {MOCK_SETLIST.map((song, i) => (
            <SongRow
              key={song.id}
              position={i + 1}
              title={song.title}
              artist={song.artist}
              duration={secondsToMMSS(song.durationSeconds)}
              tuning={song.tuning ?? 'Standard'}
              avatarColor={song.avatarColor}
              initials={song.initials}
              treatment={treatment}
              palette={palette}
            />
          ))}
        </div>
      </div>

      {/* Practice viewer "next song" preview */}
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6">
        <h3 className="text-white font-semibold mb-2">
          Practice viewer — &quot;next song&quot; preview
        </h3>
        <p className="text-[#a0a0a0] text-sm mb-4">
          A tuning *change* between current and next is the signal we want
          reviewers to spot at a distance. Current: Standard. Next: Drop D.
        </p>
        <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="text-[10px] uppercase text-[#505050] tracking-wider mb-1">
              Current
            </div>
            <div className="text-white font-semibold">Wonderwall</div>
            <TuningChip tuning="Standard" palette={palette} treatment="pill" />
          </div>
          <div className="flex-1 border-l border-[#2a2a2a] pl-4">
            <div className="text-[10px] uppercase text-[#505050] tracking-wider mb-1">
              Next — tuning change!
            </div>
            <div className="text-white font-semibold">Champagne Supernova</div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="w-3 h-3 rounded-full animate-pulse ring-2 ring-offset-2 ring-offset-[#0a0a0a]"
                style={{
                  backgroundColor: tuningColor('Drop D', palette),
                  ['--tw-ring-color' as string]: tuningColor('Drop D', palette),
                }}
              />
              <TuningChip tuning="Drop D" palette={palette} treatment="pill" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Song row with treatment applied ----

interface SongRowProps {
  position: number
  title: string
  artist: string
  duration: string
  tuning: string
  avatarColor: string
  initials: string
  treatment: Treatment
  palette: PaletteKey
}

const SongRow: React.FC<SongRowProps> = ({
  position,
  title,
  artist,
  duration,
  tuning,
  avatarColor,
  initials,
  treatment,
  palette,
}) => {
  const color = tuningColor(tuning, palette)

  // Stripe treatments apply a left border
  const stripeClass =
    treatment === 'stripe' || treatment === 'combo'
      ? 'border-l-4'
      : 'border-l border-[#2a2a2a]'
  const stripeStyle =
    treatment === 'stripe' || treatment === 'combo'
      ? { borderLeftColor: color }
      : {}

  return (
    <div
      className={`flex items-center gap-3 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] ${stripeClass} p-3 sm:p-4`}
      style={stripeStyle}
      data-testid={`preview-song-${position}`}
    >
      <div className="w-6 text-center text-[#707070] text-sm font-medium">
        {position}
      </div>

      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0"
        style={{ backgroundColor: avatarColor }}
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-white font-semibold text-sm truncate">{title}</div>
        <div className="text-[#a0a0a0] text-xs truncate">{artist}</div>
      </div>

      <div className="hidden sm:flex items-center gap-2 text-[#a0a0a0] text-sm">
        <Clock size={14} className="text-[#606060]" />
        <span>{duration}</span>
      </div>

      <TuningChip tuning={tuning} palette={palette} treatment={treatment} />

      <button className="p-1.5 text-[#707070] hover:text-[#f17827ff]">
        <FileText size={16} />
      </button>
    </div>
  )
}

// ---- Tuning chip renders per-treatment ----

interface TuningChipProps {
  tuning: string
  palette: PaletteKey
  treatment: Treatment
}

const TuningChip: React.FC<TuningChipProps> = ({
  tuning,
  palette,
  treatment,
}) => {
  const color = tuningColor(tuning, palette)
  const label = tuningLabel(tuning)

  // Pill and combo treatments both render the colored pill chip.
  // (Combo adds a stripe on the row; see parent SongRow.)
  if (treatment === 'pill' || treatment === 'combo') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{
          backgroundColor: `${color}22`,
          color: color,
          border: `1px solid ${color}66`,
        }}
      >
        <Guitar size={12} style={{ color }} />
        <span>{label}</span>
      </span>
    )
  }

  if (treatment === 'icon') {
    return (
      <div className="flex items-center gap-2 text-[#a0a0a0] text-sm min-w-[110px]">
        <Guitar size={14} style={{ color }} />
        <span className="truncate">{label}</span>
      </div>
    )
  }

  // 'stripe' treatment — plain neutral label (the row stripe is the signal)
  return (
    <div className="flex items-center gap-2 text-[#a0a0a0] text-sm min-w-[110px]">
      <Guitar size={14} className="text-[#606060]" />
      <span className="truncate">{label}</span>
    </div>
  )
}
