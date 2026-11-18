/**
 * Home's Tools row (Tools on Home 1–2; desktop `tl3`): Tuner · Metronome ·
 * Chords, each with a live hint (the last tuning used, the last tempo,
 * "Lookup"). Each tile opens its tab.
 */
import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTunings } from '../../hooks/useTunings'
import { ForkIcon } from '../setlists/SetlistStats'
import { ChordBoxIcon, MetroIcon } from '../ui/ToolIcons'
import { resolveTuning, tunerTunings } from '../../domain/tuner'
import { toolsHref, type ToolsTab } from '../../domain/toolsLink'
import { readMetronomeMemory, readTunerMemory } from '../../utils/toolsMemory'

export const ToolsRow: React.FC = () => {
  const navigate = useNavigate()
  const { customs } = useTunings()

  const tunerHint = useMemo(() => {
    const m = readTunerMemory()
    const list = tunerTunings(customs)
    return (
      resolveTuning(m.tuning[m.instrument], list, customs)?.label ?? 'E STD'
    )
  }, [customs])
  const bpm = useMemo(() => readMetronomeMemory().bpm, [])

  const tiles: [ToolsTab, string, React.ReactNode, string][] = [
    ['tuner', 'Tuner', <ForkIcon key="t" size={28} />, tunerHint],
    ['metronome', 'Metronome', <MetroIcon key="m" size={28} />, `${bpm} BPM`],
    ['chords', 'Chords', <ChordBoxIcon key="c" size={28} />, 'Lookup'],
  ]

  return (
    <div className="grid grid-cols-3 gap-2.5" data-testid="home-tools">
      {tiles.map(([tab, label, icon, hint]) => (
        <button
          key={tab}
          type="button"
          onClick={() => navigate(toolsHref(tab))}
          className="flex flex-col items-center justify-center gap-1.5 h-[84px] md:h-24 rounded-[20px] bg-bg-2 shadow-group text-[14px] font-bold text-ink-1 hover:shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]"
          data-testid={`home-tool-${tab}`}
        >
          <span className="text-accent-ink">{icon}</span>
          {label}
          <small className="-mt-1 font-mono text-[10.5px] font-medium text-ink-3 truncate max-w-full px-1">
            {hint}
          </small>
        </button>
      ))}
    </div>
  )
}
