/**
 * Song page header (docs/redesign/10 · 1.2–1.3): artist, title and the four
 * fact tiles, each edited in place and saved on its own. Tuning and key open a
 * picker anchored to the tile (a sheet on phones); BPM and length are typed
 * straight into the tile.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import { ForkIcon } from '../setlists/SetlistStats'
import { MetroIcon } from '../ui/ToolIcons'
import type { Song } from '../../models/Song'
import type { Tuning } from '../../models/Tuning'
import { Sheet, TuningPill } from '../ui'
import CircleOfFifths from './CircleOfFifths'
import { TuningEditor } from '../tunings/TuningEditor'
import { useTunings } from '../../hooks/useTunings'
import { useToast } from '../../contexts/ToastContext'
import { ChartButton } from '../chart/ChartButton'
import {
  KEY_ROOTS,
  formatSeconds,
  parseLength,
  sameKey,
  showKey,
} from '../../domain/format'
import { commitTitle } from '../../domain/songs'
import { toolsHref } from '../../domain/toolsLink'
import { songTuningParam } from '../../domain/tuner'
import { customColour } from '../../domain/tuningEdit'
import { pitchNames, tuningColor, tuningOrderIndex } from '../../utils/tunings'

export type SaveField = (label: string, fields: Partial<Song>) => Promise<void>

/** Click-to-edit text in the same type style; Enter / blur saves, Esc cancels. */
export const InlineText: React.FC<{
  value: string
  placeholder: string
  onCommit: (value: string) => void
  className: string
  inputTestId: string
  label: string
  testId?: string
  as?: 'h1' | 'p' | 'span'
}> = ({
  value,
  placeholder,
  onCommit,
  className,
  inputTestId,
  label,
  testId,
  as: Tag = 'span',
}) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const cancelled = useRef(false)

  if (editing)
    return (
      <input
        autoFocus
        value={draft}
        aria-label={label}
        name={inputTestId.replace(/-(\w)/g, (_, c) => c.toUpperCase())}
        id={inputTestId}
        data-testid={inputTestId}
        onChange={e => setDraft(e.target.value)}
        onFocus={e => e.target.select()}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            e.stopPropagation()
            cancelled.current = true
            e.currentTarget.blur()
          }
        }}
        onBlur={() => {
          setEditing(false)
          if (cancelled.current) cancelled.current = false
          else onCommit(draft)
        }}
        className={`${className} w-full min-w-0 bg-transparent rounded-lg outline-none ring-2 ring-accent px-1 -mx-1`}
      />
    )
  return (
    <Tag
      role="button"
      tabIndex={0}
      title={`Edit ${label.toLowerCase()}`}
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          setDraft(value)
          setEditing(true)
        }
      }}
      data-testid={testId}
      className={`${className} cursor-text rounded-lg hover:bg-bg-2 -mx-1 px-1 ${value ? '' : 'text-ink-4'}`}
    >
      {value || placeholder}
    </Tag>
  )
}

const TILE =
  'relative min-w-0 md:min-w-[92px] h-[62px] px-3 md:px-3.5 rounded-[14px] bg-bg-2 text-left flex flex-col justify-center outline-none'
const TILE_LABEL = 'font-mono text-[10px] tracking-[.14em] uppercase text-ink-3'

const FactTile: React.FC<{
  label: string
  open?: boolean
  onClick?: (el: HTMLElement) => void
  testId: string
  children: React.ReactNode
}> = ({ label, open, onClick, testId, children }) => (
  <button
    type="button"
    onClick={e => onClick?.(e.currentTarget)}
    className={`${TILE} hover:bg-bg-3 ${open ? 'ring-2 ring-accent' : ''}`}
    data-testid={testId}
    aria-label={`${label}: edit`}
  >
    <span className={TILE_LABEL}>{label}</span>
    <span className="font-mono text-[21px] font-semibold text-ink-1 leading-tight">
      {children}
    </span>
  </button>
)

/** BPM / length typed into the tile. Enter / blur saves, Esc cancels. */
const NumberTile: React.FC<{
  label: string
  value: string
  placeholder: string
  testId: string
  inputTestId: string
  onCommit: (text: string) => void
}> = ({ label, value, placeholder, testId, inputTestId, onCommit }) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const cancelled = useRef(false)
  if (!editing)
    return (
      <FactTile
        label={label}
        testId={testId}
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value || '—'}
      </FactTile>
    )
  return (
    <label className={`${TILE} ring-2 ring-accent`} data-testid={testId}>
      <span className={TILE_LABEL}>{label}</span>
      <input
        autoFocus
        type="text"
        inputMode="numeric"
        value={draft}
        placeholder={placeholder}
        name={inputTestId.replace(/-(\w)/g, (_, c) => c.toUpperCase())}
        id={inputTestId}
        data-testid={inputTestId}
        onChange={e => setDraft(e.target.value.replace(/[^\d:]/g, ''))}
        onFocus={e => e.target.select()}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            e.stopPropagation()
            cancelled.current = true
            e.currentTarget.blur()
          }
        }}
        onBlur={() => {
          setEditing(false)
          if (cancelled.current) cancelled.current = false
          else onCommit(draft)
        }}
        className="w-[5ch] bg-transparent font-mono text-[21px] font-semibold text-ink-1 leading-tight outline-none"
      />
    </label>
  )
}

const KeyGrid: React.FC<{ value: string; onPick: (k: string) => void }> = ({
  value,
  onPick,
}) => (
  <div className="p-1.5" data-testid="song-key-grid">
    {(['', 'm'] as const).map(suffix => (
      <div key={suffix}>
        <p className="px-1.5 pt-1.5 pb-1 font-mono text-[10px] tracking-[.14em] uppercase text-ink-3">
          {suffix ? 'Minor' : 'Major'}
        </p>
        <div className="grid grid-cols-6 gap-1">
          {KEY_ROOTS.map(n => {
            const k = n + suffix
            const on = !!value && sameKey(value, k)
            return (
              <button
                key={k}
                type="button"
                onClick={() => onPick(k)}
                className={`h-10 rounded-xl font-mono text-[14px] ${
                  on
                    ? 'bg-accent text-on-accent font-bold'
                    : 'text-ink-1 hover:bg-bg-3'
                }`}
                data-testid={`song-key-option-${k}`}
              >
                {showKey(k)}
              </button>
            )
          })}
        </div>
      </div>
    ))}
  </div>
)

const TuningList: React.FC<{
  value: string
  onPick: (t: Tuning) => void
  onNew: () => void
}> = ({ value, onPick, onNew }) => {
  const { builtins, customs } = useTunings('guitar')
  const list = [
    ...[...builtins].sort(
      (a, b) =>
        tuningOrderIndex(a.slug) - tuningOrderIndex(b.slug) ||
        a.name.localeCompare(b.name)
    ),
    ...customs,
  ]
  return (
    <div role="menu" data-testid="song-tuning-picker">
      {list.map(t => {
        const on = t.name === value
        return (
          <button
            key={t.id}
            type="button"
            role="menuitemradio"
            aria-checked={on}
            onClick={() => onPick(t)}
            className={`w-full flex items-center gap-3 min-h-[48px] md:min-h-[40px] px-2.5 rounded-xl text-left hover:bg-bg-3 ${on ? 'bg-bg-3' : ''}`}
            data-testid={`song-tuning-option-${t.name}`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                background: t.isBuiltin
                  ? tuningColor(t.name)
                  : (customColour(t) ?? tuningColor(t.name)),
              }}
            />
            <span className="flex-1 truncate text-[15px] md:text-[14px] font-semibold text-ink-1">
              {t.name}
            </span>
            <span className="hidden md:inline font-mono text-[11px] text-ink-3">
              {pitchNames(t.pitches)}
            </span>
            {on && <Check size={16} className="text-accent shrink-0" />}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onNew}
        className="w-full flex items-center gap-3 min-h-[48px] md:min-h-[40px] px-2.5 rounded-xl text-left text-[15px] md:text-[14px] font-semibold text-ink-1 hover:bg-bg-3"
        data-testid="song-tuning-new"
      >
        <Plus size={18} className="text-ink-3" /> New tuning…
      </button>
    </div>
  )
}

type Picker = { kind: 'tuning' | 'key'; at: { x: number; y: number } } | null

export const SongFacts: React.FC<{
  song: Song
  onSave: SaveField
  desktop: boolean
}> = ({ song, onSave, desktop }) => {
  const { showToast } = useToast()
  const [picker, setPicker] = useState<Picker>(null)
  const [newTuning, setNewTuning] = useState(false)
  const tuning = song.guitarTuning || 'Standard'
  const { customs } = useTunings()
  const custom = customs.find(t => t.id === song.tuningId)

  // Stepping to another song closes any open picker.
  useEffect(() => setPicker(null), [song.id])

  const anchor = (kind: 'tuning' | 'key') => (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    setPicker({ kind, at: { x: r.left, y: r.bottom + 8 } })
  }

  const pickTuning = (t: Tuning) => {
    setPicker(null)
    if (t.name !== tuning)
      void onSave('Tuning', { guitarTuning: t.name, tuningId: t.id })
  }
  const pickKey = (k: string) => {
    setPicker(null)
    if (k !== song.key) void onSave('Key', { key: k })
  }

  return (
    <div>
      <InlineText
        value={song.artist || ''}
        placeholder="Add artist"
        label="Artist"
        inputTestId="song-artist-input"
        testId="song-artist"
        as="p"
        className="font-mono text-[12.5px] tracking-[.14em] uppercase text-ink-3 inline-block"
        onCommit={v => {
          const artist = v.trim()
          if (artist !== (song.artist || '')) void onSave('Artist', { artist })
        }}
      />
      <div className="mt-0.5">
        <InlineText
          value={song.title}
          placeholder="Title"
          label="Title"
          inputTestId="song-title-input"
          testId="song-detail-title"
          as="h1"
          className="block font-display font-extrabold uppercase leading-[.92] text-ink-1 break-words text-[44px] md:text-[64px]"
          onCommit={v => {
            const r = commitTitle(v, song.title)
            if (r.reverted)
              showToast('A song needs a title · kept the old one', 'info')
            else if (r.changed) void onSave('Title', { title: r.title })
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 md:flex md:flex-wrap">
        <FactTile
          label="Tuning"
          testId="song-fact-tuning"
          open={picker?.kind === 'tuning'}
          onClick={anchor('tuning')}
        >
          <TuningPill
            tuning={tuning}
            color={custom ? customColour(custom) : null}
            size="md"
          />
        </FactTile>
        <FactTile
          label="Key"
          testId="song-fact-key"
          open={picker?.kind === 'key'}
          onClick={anchor('key')}
        >
          {song.key ? showKey(song.key) : '—'}
        </FactTile>
        <NumberTile
          label="BPM"
          testId="song-fact-bpm"
          inputTestId="song-bpm-input"
          value={song.bpm ? String(song.bpm) : ''}
          placeholder="120"
          onCommit={text => {
            const bpm = text ? parseInt(text.replace(/\D/g, ''), 10) || 0 : 0
            if (bpm !== (song.bpm || 0)) void onSave('BPM', { bpm })
          }}
        />
        <NumberTile
          label="Length"
          testId="song-fact-length"
          inputTestId="song-length-input"
          value={formatSeconds(song.duration)}
          placeholder="3:30"
          onCommit={text => {
            const s = parseLength(text)
            if (s === null) showToast('Use minutes:seconds, like 3:51', 'info')
            else if (s !== (song.duration || 0))
              void onSave('Length', { duration: s })
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ChartButton song={song} testId="song-chords-button" />
        <Link
          to={toolsHref('tuner', { tuning: songTuningParam(song) })}
          className={TOOL_LINK}
          data-testid="song-tune-button"
        >
          <ForkIcon size={17} />
          Tune
        </Link>
        <Link
          to={toolsHref('metronome', { song: song.id })}
          className={TOOL_LINK}
          data-testid="song-click-button"
        >
          <MetroIcon size={17} />
          Click{song.bpm ? ` ${song.bpm}` : ''}
        </Link>
      </div>

      {picker?.kind === 'tuning' && (
        <Sheet
          onClose={() => setPicker(null)}
          at={desktop ? picker.at : null}
          width={380}
          title={desktop ? undefined : 'Tuning'}
          data-testid="song-tuning-sheet"
        >
          <TuningList
            value={tuning}
            onPick={pickTuning}
            onNew={() => {
              setPicker(null)
              setNewTuning(true)
            }}
          />
        </Sheet>
      )}
      {picker?.kind === 'key' && (
        <Sheet
          onClose={() => setPicker(null)}
          at={desktop ? picker.at : null}
          width={340}
          title={desktop ? undefined : 'Key'}
          data-testid="song-key-sheet"
        >
          {desktop ? (
            <KeyGrid value={song.key || ''} onPick={pickKey} />
          ) : (
            <div className="pb-2">
              <CircleOfFifths
                selectedKey={song.key || undefined}
                onKeySelect={pickKey}
              />
            </div>
          )}
        </Sheet>
      )}
      {newTuning && (
        <TuningEditor
          instrument="guitar"
          context={
            song.contextId
              ? { type: song.contextType, id: song.contextId }
              : null
          }
          onClose={() => setNewTuning(false)}
          onSaved={t => {
            setNewTuning(false)
            pickTuning(t)
          }}
        />
      )}
    </div>
  )
}

/** Tune / Click open the Tools screen on this song's tuning / BPM. */
const TOOL_LINK =
  'h-11 px-4 rounded-full font-bold flex items-center gap-2 bg-bg-3 text-ink-1 hover:bg-bg-4 active:scale-[.96] transition-transform'
