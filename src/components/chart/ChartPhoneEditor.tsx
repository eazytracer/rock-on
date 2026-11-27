/**
 * The phone chart editor (Song Chart 5–8; docs/redesign/12 · 5e, 5f): Text
 * (paste or type, shows what was detected), Lyrics (type words; chords dim
 * and ride their letters; "[Am]" or the Chord here button drops a chord at
 * the cursor), Chords (pick from the song's chords or the key's palette, tap a
 * letter; tap a placed chord to nudge ◀ ▶, change or remove it; Other… opens
 * the keypad; Chords from Verse 1) and Preview (with the starting note).
 * Explicit save, like the desktop editor.
 */
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Hand,
  Plus,
  Trash2,
} from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../hooks/useConfirm'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { Button, Segmented, Sheet } from '../ui'
import { ChartText } from './ChartText'
import { ChordPicker } from './ChordPicker'
import {
  ConflictBanner,
  DetectedLine,
  SAMPLE_CHART,
  StartingNoteRow,
} from './chartEditorShared'
import { useChartSaver } from '../../hooks/useChartSaver'
import type { ChartEditorProps } from './ChartEditor'
import {
  chordsInOrder,
  graphemes,
  importChart,
  parse,
  serialize,
  type Chart,
  type ChartLine,
} from '../../domain/chordpro'
import {
  changeChord,
  copyVerseChords,
  dropBracketChords,
  editText,
  editableText,
  flatLines,
  getLine,
  joinLines,
  keyPalette,
  moveChord,
  nudgeChord,
  placeChord,
  removeChord,
  setLines,
  splitLine,
  updateLine,
  verseSource,
} from '../../domain/chartEdit'
import { chartKey } from '../../domain/chartView'
import { showChord } from '../../domain/chords'

type Mode = 'text' | 'lyrics' | 'chords' | 'preview'
type Spot = { line: number; at: number }

const fromText = (text: string): Chart => parse(importChart(text).chordpro)
const utf16At = (text: string, at: number) =>
  graphemes(text).slice(0, at).join('').length
const graphemeAt = (text: string, offset: number) =>
  graphemes(text.slice(0, offset)).length

/** A chart with at least one (empty) line, so Lyrics mode has somewhere to type. */
const withALine = (c: Chart): Chart =>
  flatLines(c).length
    ? c
    : {
        ...c,
        sections: [
          { kind: 'other', label: '', lines: [{ text: '', chords: [] }] },
        ],
      }

export const ChartPhoneEditor: React.FC<ChartEditorProps> = ({
  song,
  opened,
  live,
  refetch,
  readerHref,
  onLeave,
}) => {
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const stored = opened?.chordpro ?? ''
  const [chart, setChartState] = useState<Chart>(() => parse(stored))
  const [text, setText] = useState(() => editableText(stored))
  const [mode, setMode] = useState<Mode>(stored.trim() ? 'chords' : 'text')
  const [touched, setTouched] = useState(false)
  const saver = useChartSaver(song.id, opened, refetch, readerHref)

  const setChart = (next: Chart) => {
    setChartState(next)
    setTouched(true)
  }
  // The chart as it stands in any mode.
  const current = (): string =>
    mode === 'text' ? importChart(text).chordpro : serialize(chart)

  const switchMode = (to: Mode) => {
    if (to === mode) return
    if (mode === 'text') {
      const parsed = fromText(text)
      setChartState(to === 'lyrics' ? withALine(parsed) : parsed)
    } else if (to === 'text') {
      setText(editableText(serialize(chart)))
    } else if (to === 'lyrics') {
      setChartState(withALine(chart))
    }
    setMode(to)
  }

  const view = mode === 'text' ? fromText(text) : chart
  const written = useMemo(() => chordsInOrder(view), [view])
  const key = chartKey(song.key, written)

  const cancel = async () => {
    if (
      touched &&
      !(await confirm({
        title: 'Discard your chart changes?',
        message: "What you've changed here won't be saved.",
        confirmLabel: 'Discard',
        variant: 'danger',
      }))
    )
      return
    onLeave()
  }
  const save = () => (touched ? void saver.save(current()) : onLeave())

  const showTheirs = () => {
    const theirs = saver.takeTheirs()
    if (!theirs) return
    const mine = { chart, text }
    setChartState(parse(theirs.chordpro))
    setText(editableText(theirs.chordpro))
    showToast(`Showing ${theirs.editorName || 'their'} chart`, 'info', {
      action: {
        label: 'Undo',
        onClick: () => {
          setChartState(mine.chart)
          setText(mine.text)
        },
      },
    })
  }

  return (
    <div
      className="fixed inset-0 z-[55] bg-bg-1 text-ink-1 flex flex-col"
      data-testid="chart-editor-page"
    >
      <header className="flex items-center justify-between px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2 shrink-0">
        <button
          type="button"
          onClick={() => void cancel()}
          className="h-11 px-1.5 font-semibold text-[16px] text-ink-2"
          data-testid="chart-editor-cancel"
        >
          Cancel
        </button>
        <h1 className="text-[17px] font-bold truncate px-2">{song.title}</h1>
        <Button
          variant="primary"
          disabled={saver.saving}
          onClick={save}
          className="!px-5"
          data-testid="chart-editor-save"
        >
          Save
        </Button>
      </header>
      <div className="px-3 pb-2 shrink-0">
        <Segmented
          label="Edit mode"
          options={[
            { value: 'text', label: 'Text' },
            { value: 'lyrics', label: 'Lyrics' },
            { value: 'chords', label: 'Chords' },
            { value: 'preview', label: 'Preview' },
          ]}
          value={mode}
          onChange={switchMode}
          data-testid="chart-mode"
        />
      </div>
      {saver.conflict && (
        <div className="px-3 pb-2 shrink-0">
          <ConflictBanner
            conflict={saver.conflict}
            busy={saver.saving}
            onTheirs={showTheirs}
            onKeep={() => void saver.keepMine(current())}
          />
        </div>
      )}

      {mode === 'text' && (
        <TextMode
          text={text}
          onText={t => {
            setText(t)
            setTouched(true)
          }}
        />
      )}
      {mode === 'lyrics' && <LyricsMode chart={chart} onChart={setChart} />}
      {mode === 'chords' && (
        <ChordsMode chart={chart} chartKey={key} onChart={setChart} />
      )}
      {mode === 'preview' && (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar-thin px-5 pb-10">
          <div className="rounded-2xl bg-bg-2 p-3.5 mb-4">
            <StartingNoteRow
              songId={song.id}
              value={live?.startingNote ?? null}
              chartKey={key}
              desktop={false}
            />
          </div>
          <ChartText
            chart={view}
            chartKey={key}
            size={20}
            data-testid="chart-editor-preview"
          />
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

// ── Text ─────────────────────────────────────────────────────────────────────

const TextMode: React.FC<{ text: string; onText: (t: string) => void }> = ({
  text,
  onText,
}) => {
  const { showToast } = useToast()
  const area = useRef<HTMLTextAreaElement>(null)
  const imported = useMemo(() => importChart(text), [text])
  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip.trim()) onText(clip)
      else showToast('Nothing to paste yet. Copy a chart first.', 'info')
    } catch {
      area.current?.focus()
      showToast('Long-press in the box and choose Paste.', 'info')
    }
  }
  return (
    <div className="flex-1 min-h-0 flex flex-col px-3 pb-[max(12px,env(safe-area-inset-bottom))] gap-2.5">
      <label htmlFor="chart-editor-text" className="sr-only">
        Chart text
      </label>
      <textarea
        ref={area}
        id="chart-editor-text"
        name="chartText"
        data-testid="chart-editor-text"
        value={text}
        onChange={e => onText(e.target.value)}
        spellCheck={false}
        placeholder={
          'Paste a chart, or type the words.\n\nChord lines above lyric lines and [Verse] headers convert. ChordPro works too.'
        }
        className="flex-1 min-h-0 w-full resize-none rounded-[18px] bg-bg-2 p-3.5 font-mono text-[12.5px] leading-[1.55] text-ink-1 placeholder:text-ink-4 outline-none whitespace-pre overflow-auto custom-scrollbar-thin"
      />
      {text.trim() && (
        <div className="rounded-2xl bg-bg-2 px-3.5 py-3">
          <DetectedLine
            format={imported.format}
            sections={imported.sections}
            chords={imported.chords}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="lg"
          icon={<ClipboardPaste size={17} />}
          onClick={() => void paste()}
          data-testid="chart-editor-paste"
        >
          Paste
        </Button>
        {text ? (
          <Button
            size="lg"
            onClick={() => onText('')}
            data-testid="chart-editor-clear"
          >
            Clear
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => onText(SAMPLE_CHART)}
            data-testid="chart-editor-sample"
          >
            Try a sample
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Lyrics ───────────────────────────────────────────────────────────────────

const LYRIC_TYPO =
  'block w-full m-0 p-0 border-0 text-[18px] leading-[48px] whitespace-pre-wrap break-words font-sans tracking-normal'

const LyricsMode: React.FC<{ chart: Chart; onChart: (c: Chart) => void }> = ({
  chart,
  onChart,
}) => {
  const refs = flatLines(chart)
  const [focus, setFocus] = useState<(Spot & { n: number }) | null>(null)
  const caret = useRef<Spot>({ line: 0, at: 0 })
  const [picking, setPicking] = useState(false)
  let flat = 0

  const split = (i: number, at: number) => {
    const ref = refs[i]
    const [a, b] = splitLine(getLine(chart, ref)!, at)
    onChart(setLines(chart, ref.section, ref.line, 1, [a, b]))
    setFocus({ line: i + 1, at: 0, n: Date.now() })
  }
  const joinPrev = (i: number) => {
    const ref = refs[i]
    if (ref.line === 0) return
    const prev = chart.sections[ref.section].lines[ref.line - 1]
    const cur = chart.sections[ref.section].lines[ref.line]
    onChart(
      setLines(chart, ref.section, ref.line - 1, 2, [joinLines(prev, cur)])
    )
    setFocus({ line: i - 1, at: graphemes(prev.text).length, n: Date.now() })
  }

  return (
    <>
      <p className="mx-4 mb-1 text-[13px] text-ink-3 shrink-0">
        Type freely. Chords stay on their letters. Type [Am] to drop a chord.
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar-thin px-5 pb-[140px]">
        {chart.sections.map((s, si) => (
          <section key={si} className="mt-3 first:mt-1">
            {s.label && (
              <h4 className="font-mono text-[10px] tracking-[.14em] uppercase text-ink-3 font-medium mb-0.5">
                {s.label}
              </h4>
            )}
            {s.lines.map((l, li) => {
              const i = flat++
              return (
                <LyricLine
                  key={`${si}-${li}`}
                  index={i}
                  line={l}
                  focus={focus?.line === i ? focus : null}
                  onChange={next =>
                    onChart(updateLine(chart, refs[i], () => next))
                  }
                  onSplit={at => split(i, at)}
                  onJoinPrev={() => joinPrev(i)}
                  onCaret={at => (caret.current = { line: i, at })}
                />
              )
            })}
          </section>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[3] px-3 pt-2 pb-[max(14px,env(safe-area-inset-bottom))] bg-bg-2 border-t border-divider">
        <Button
          fullWidth
          size="lg"
          icon={<Plus size={17} />}
          onMouseDown={e => e.preventDefault()}
          onClick={() => setPicking(true)}
          data-testid="chart-lyrics-add-chord"
        >
          Chord here
        </Button>
      </div>
      {picking && (
        <Sheet
          onClose={() => setPicking(false)}
          title="Chord here"
          data-testid="chart-lyrics-chord-sheet"
        >
          <ChordPicker
            onUse={chord => {
              setPicking(false)
              const { line, at } = caret.current
              const ref = refs[line]
              if (!ref) return
              onChart(updateLine(chart, ref, l => placeChord(l, at, chord)))
              setFocus({ line, at, n: Date.now() })
            }}
          />
        </Sheet>
      )}
    </>
  )
}

const LyricLine: React.FC<{
  index: number
  line: ChartLine
  focus: (Spot & { n: number }) | null
  onChange: (next: ChartLine) => void
  onSplit: (at: number) => void
  onJoinPrev: () => void
  onCaret: (at: number) => void
}> = ({ index, line, focus, onChange, onSplit, onJoinPrev, onCaret }) => {
  const el = useRef<HTMLTextAreaElement>(null)
  const pendingCaret = useRef<number | null>(null)

  useLayoutEffect(() => {
    const t = el.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${t.scrollHeight}px`
    if (pendingCaret.current != null) {
      const off = utf16At(line.text, pendingCaret.current)
      t.setSelectionRange(off, off)
      pendingCaret.current = null
    }
  }, [line.text])

  useEffect(() => {
    const t = el.current
    if (!focus || !t) return
    t.focus()
    const off = utf16At(t.value, focus.at)
    t.setSelectionRange(off, off)
  }, [focus])

  const g = graphemes(line.text)
  const sorted = [...line.chords].sort((a, b) => a.at - b.at)
  const mirror: React.ReactNode[] = []
  let p = 0
  sorted.forEach((c, k) => {
    mirror.push(g.slice(p, c.at).join(''))
    mirror.push(
      <span key={k} className="relative">
        <span className="absolute left-0 bottom-full -mb-0.5 font-mono font-bold text-[12px] leading-none whitespace-nowrap text-chord opacity-70">
          {showChord(c.chord)}
        </span>
      </span>
    )
    p = c.at
  })
  mirror.push(g.slice(p).join(''))

  const report = (t: HTMLTextAreaElement) =>
    onCaret(graphemeAt(t.value, t.selectionStart))

  // A chords-only line has no words to type: show its chords in a row (pinned
  // over spaces they would overlap). Chords mode edits them.
  if (sorted.length && !line.text.trim())
    return (
      <div
        className="flex flex-wrap gap-x-3 py-3 border-b border-divider font-mono font-bold text-[12px] text-chord opacity-70"
        data-testid={`chart-lyric-chords-${index}`}
      >
        {sorted.map((c, k) => (
          <span key={k}>{showChord(c.chord)}</span>
        ))}
      </div>
    )

  return (
    <div className="relative">
      <div
        aria-hidden
        className={`${LYRIC_TYPO} absolute inset-0 pointer-events-none text-transparent`}
      >
        {mirror}
        {'​'}
      </div>
      <textarea
        ref={el}
        rows={1}
        value={line.text}
        aria-label={`Line ${index + 1}`}
        name={`lyricLine${index}`}
        data-testid={`chart-lyric-${index}`}
        spellCheck
        onChange={e => {
          const t = e.target
          const next = editText(line, t.value)
          const dropped = dropBracketChords(next)
          if (dropped !== next) {
            const removed =
              graphemes(next.text).length - graphemes(dropped.text).length
            pendingCaret.current = Math.max(
              0,
              graphemeAt(t.value, t.selectionStart) - removed
            )
          }
          onChange(dropped)
        }}
        onKeyDown={e => {
          const t = e.currentTarget
          if (e.key === 'Enter') {
            e.preventDefault()
            onSplit(graphemeAt(t.value, t.selectionStart))
          } else if (
            e.key === 'Backspace' &&
            t.selectionStart === 0 &&
            t.selectionEnd === 0
          ) {
            e.preventDefault()
            onJoinPrev()
          }
        }}
        onSelect={e => report(e.currentTarget)}
        onFocus={e => report(e.currentTarget)}
        className={`${LYRIC_TYPO} relative bg-transparent resize-none outline-none overflow-hidden text-ink-1 caret-accent border-b border-divider focus:border-accent/60`}
      />
    </div>
  )
}

// ── Chords ───────────────────────────────────────────────────────────────────

const ChordsMode: React.FC<{
  chart: Chart
  chartKey: string | null
  onChart: (c: Chart) => void
}> = ({ chart, chartKey: key, onChart }) => {
  const { showToast } = useToast()
  const refs = flatLines(chart)
  const inSong = useMemo(() => chordsInOrder(chart), [chart])
  const suggested = useMemo(() => keyPalette(key, inSong), [key, inSong])
  const [picked, setPicked] = useState<string | null>(
    () => inSong[0] ?? suggested[0] ?? null
  )
  const [selected, setSelected] = useState<Spot | null>(null)
  const [flash, setFlash] = useState<Spot | null>(null)
  const [other, setOther] = useState<null | 'pick' | 'change'>(null)
  let flat = 0

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 600)
    return () => window.clearTimeout(t)
  }, [flash])

  const selChord = selected
    ? getLine(chart, refs[selected.line])?.chords.find(
        c => c.at === selected.at
      )?.chord
    : undefined

  const tapLetter = (line: number, at: number) => {
    const ref = refs[line]
    if (selected && selChord) {
      if (selected.line === line && selected.at === at) return
      onChart(
        moveChord(
          chart,
          { ...refs[selected.line], at: selected.at },
          { ...ref, at }
        )
      )
      setSelected({ line, at })
      return
    }
    if (!picked) {
      showToast('Pick a chord first', 'info')
      return
    }
    onChart(updateLine(chart, ref, l => placeChord(l, at, picked)))
    setFlash({ line, at })
  }
  const tapChord = (line: number, at: number) =>
    setSelected(s =>
      s && s.line === line && s.at === at ? null : { line, at }
    )

  const nudge = (dir: -1 | 1) => {
    if (!selected) return
    const ref = refs[selected.line]
    const r = nudgeChord(getLine(chart, ref)!, selected.at, dir)
    if (!r) return
    onChart(updateLine(chart, ref, () => r.line))
    setSelected({ line: selected.line, at: r.at })
  }
  const change = (to: string) => {
    if (!selected) return
    onChart(
      updateLine(chart, refs[selected.line], l =>
        changeChord(l, selected.at, to)
      )
    )
  }
  const remove = () => {
    if (!selected) return
    onChart(
      updateLine(chart, refs[selected.line], l => removeChord(l, selected.at))
    )
    setSelected(null)
  }

  const chip = (c: string) => (
    <button
      key={c}
      type="button"
      onClick={() => setPicked(c)}
      aria-pressed={picked === c}
      className={`h-11 min-w-[52px] px-3 rounded-[14px] font-mono font-bold text-[15px] ${
        picked === c ? 'bg-accent text-on-accent' : 'bg-bg-3 text-ink-1'
      }`}
      data-testid={`chart-palette-${c}`}
    >
      {showChord(c)}
    </button>
  )
  const label =
    'font-mono text-[9.5px] tracking-[.1em] uppercase text-ink-4 mx-1 mb-1.5'

  return (
    <>
      <p
        className="mx-4 mb-1 flex items-center gap-2 text-[13px] text-ink-3 min-h-[20px] shrink-0"
        data-testid="chart-chords-hint"
      >
        <Hand size={16} className="shrink-0" />
        {selChord ? (
          <span>
            <b className="text-ink-1">{showChord(selChord)}</b> selected. Nudge,
            change or remove it.
          </span>
        ) : picked ? (
          <span>
            Pick <b className="text-ink-1">{showChord(picked)}</b>, then tap a
            letter to place it.
          </span>
        ) : (
          <span>Pick a chord, then tap a letter to place it.</span>
        )}
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar-thin px-5 pb-[300px] text-[20px] leading-[1.2]">
        {chart.sections.map((s, si) => {
          const canCopy = verseSource(chart, si) != null
          return (
            <section key={si} className="mt-[.8em] first:mt-1">
              {(s.label || canCopy) && (
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-mono text-[10px] tracking-[.14em] uppercase text-ink-3 font-medium">
                    {s.label}
                  </h4>
                  {canCopy && (
                    <button
                      type="button"
                      onClick={() => {
                        onChart(copyVerseChords(chart, si))
                        setSelected(null)
                        showToast(
                          `Copied the chords onto ${s.label || 'this verse'}`,
                          'success'
                        )
                      }}
                      className="ml-auto h-[30px] px-2.5 rounded-full bg-bg-3 text-accent text-[11.5px] font-bold flex items-center gap-1.5"
                      data-testid="chart-editor-copy-verse"
                    >
                      <Copy size={13} /> Chords from Verse 1
                    </button>
                  )}
                </div>
              )}
              {s.lines.map((l, li) => {
                const i = flat++
                return (
                  <LetterLine
                    key={`${si}-${li}`}
                    index={i}
                    line={l}
                    selected={selected?.line === i ? selected.at : null}
                    flash={flash?.line === i ? flash.at : null}
                    onLetter={at => tapLetter(i, at)}
                    onChord={at => tapChord(i, at)}
                  />
                )
              })}
            </section>
          )
        })}
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-[3] bg-bg-2 border-t border-divider px-3 pt-2.5 pb-[max(20px,env(safe-area-inset-bottom))]"
        data-testid="chart-palette"
      >
        {selChord && selected ? (
          <>
            <div className={label}>Selected chord</div>
            <div className="flex items-center gap-1.5">
              <span className="px-1 font-mono text-[12px] text-ink-3">
                {showChord(selChord)}
              </span>
              <button
                type="button"
                aria-label="Move left one letter"
                onClick={() => nudge(-1)}
                className="grid place-items-center w-11 h-11 rounded-[14px] bg-bg-3 text-ink-1"
                data-testid="chart-chord-nudge-left"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label="Move right one letter"
                onClick={() => nudge(1)}
                className="grid place-items-center w-11 h-11 rounded-[14px] bg-bg-3 text-ink-1"
                data-testid="chart-chord-nudge-right"
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                onClick={() =>
                  picked && picked !== selChord
                    ? change(picked)
                    : setOther('change')
                }
                className="h-11 px-3.5 rounded-[14px] bg-bg-3 text-ink-1 font-bold text-[14px] truncate"
                data-testid="chart-chord-change"
              >
                {picked && picked !== selChord
                  ? `Change to ${showChord(picked)}`
                  : 'Change…'}
              </button>
              <button
                type="button"
                onClick={remove}
                className="ml-auto h-11 px-3 rounded-[14px] bg-bg-3 text-danger font-bold text-[14px] flex items-center gap-1.5"
                data-testid="chart-chord-remove"
              >
                <Trash2 size={16} /> Remove
              </button>
            </div>
            <div className={`${label} mt-2.5 mb-0`}>
              Or tap a letter to move it there
            </div>
          </>
        ) : (
          <>
            {inSong.length > 0 && (
              <>
                <div className={label}>In this song</div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {inSong.map(chip)}
                </div>
              </>
            )}
            <div className={label}>
              {key ? `Key of ${showChord(key)} · suggested` : 'Chords'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggested.map(chip)}
              <button
                type="button"
                onClick={() => setOther('pick')}
                className="h-11 px-3 rounded-[14px] text-[13.5px] font-semibold text-ink-2 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]"
                data-testid="chart-chord-other"
              >
                Other…
              </button>
            </div>
          </>
        )}
      </div>

      {other && (
        <Sheet
          onClose={() => setOther(null)}
          title={other === 'change' ? 'Change chord' : 'Other chord'}
          data-testid="chart-other-chord-sheet"
        >
          <ChordPicker
            initial={other === 'change' ? selChord : undefined}
            onUse={chord => {
              if (other === 'change') change(chord)
              else setPicked(chord)
              setOther(null)
            }}
          />
        </Sheet>
      )}
    </>
  )
}

/** One line in Chords mode: every letter is a target, chords sit over theirs. */
const LetterLine: React.FC<{
  index: number
  line: ChartLine
  selected: number | null
  flash: number | null
  onLetter: (at: number) => void
  onChord: (at: number) => void
}> = ({ index, line, selected, flash, onLetter, onChord }) => {
  const g = graphemes(line.text)
  const byAt = new Map(line.chords.map(c => [c.at, c.chord]))
  // A chords-only line ("Gsus4  G  F") has only spaces under its chords:
  // each chord holds its own width there so neighbours don't overlap.
  const chordsOnly = line.chords.length > 0 && !line.text.trim()
  // Words (with their trailing spaces) stay together when the line wraps.
  const words: number[][] = []
  g.forEach((ch, i) => {
    const prevSpace = i > 0 && /\s/.test(g[i - 1])
    if (!words.length || (prevSpace && !/\s/.test(ch))) words.push([])
    words[words.length - 1].push(i)
  })
  const letter = (i: number, ch: string) => {
    const chord = byAt.get(i)
    const sel = selected === i
    return (
      <span
        key={i}
        onClick={() => onLetter(i)}
        className="relative inline-block pt-[1.15em] cursor-pointer"
        style={
          chordsOnly && chord
            ? { minWidth: `${showChord(chord).length * 0.42 + 0.4}em` }
            : undefined
        }
        data-testid={`chart-letter-${index}-${i}`}
      >
        {chord && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onChord(i)
            }}
            className={`absolute z-[2] left-0 top-0 font-mono font-bold text-[.68em] leading-[1.5] whitespace-nowrap rounded-md px-0.5 -mx-0.5 ${
              sel
                ? 'bg-accent text-on-accent ring-[3px] ring-accent/25'
                : 'text-chord'
            }`}
            data-testid={`chart-placed-${index}-${i}`}
          >
            {showChord(chord)}
          </button>
        )}
        <span
          className={`rounded-[3px] ${flash === i ? 'bg-accent/20' : 'hover:bg-bg-3'} ${
            sel ? 'shadow-[inset_0_-2px_0_rgb(var(--accent-rgb))]' : ''
          }`}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      </span>
    )
  }
  return (
    <div className="flex flex-wrap mb-[.3em]" data-chart-line>
      {words.map((w, wi) => (
        <span key={wi} className="inline-flex whitespace-pre">
          {w.map(i => letter(i, g[i]))}
          {/* The end-of-line target rides the last word, never wraps alone. */}
          {wi === words.length - 1 && letter(g.length, ' ')}
        </span>
      ))}
      {!words.length && letter(g.length, ' ')}
    </div>
  )
}
