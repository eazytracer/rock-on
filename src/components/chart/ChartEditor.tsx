/**
 * The chart editor (Song Chart 5–8; desktop `chartedit`): an explicit-save
 * working document. Desktop: two panes, a text box on the left (chord lines
 * over lyric lines, `[Section]` headers, ChordPro works too) and the live
 * preview on the right with Lyrics + chords / Chords only. Phones: Text,
 * Lyrics and Chords modes plus a Preview (ChartPhoneEditor).
 *
 * A paste is stored as ChordPro (decision 4): chords over lyrics convert on
 * the client, ChordPro and plain lyrics stay as pasted; the preview says what
 * was detected. Saves send the version the editor opened; a newer save shows
 * the conflict banner and nothing is lost.
 */
import React, { useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ClipboardPaste } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../hooks/useConfirm'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { Button, Segmented } from '../ui'
import { ChartText } from './ChartText'
import {
  ConflictBanner,
  DetectedLine,
  SAMPLE_CHART,
  StartingNoteRow,
} from './chartEditorShared'
import { useChartSaver } from '../../hooks/useChartSaver'
import { ChartPhoneEditor } from './ChartPhoneEditor'
import { chordsInOrder, importChart, parse } from '../../domain/chordpro'
import {
  copyVerseInText,
  editableText,
  nextVerseTarget,
} from '../../domain/chartEdit'
import { chartKey } from '../../domain/chartView'
import type { SongChart } from '../../services/api/charts'
import type { Song } from '../../models/Song'

export interface ChartEditorProps {
  song: Song
  /** The chart as it was when the editor opened (null = none yet). */
  opened: SongChart | null
  /** The live chart (for the starting note, which saves as you pick). */
  live: SongChart | null
  refetch: () => Promise<{ data?: SongChart | null }>
  desktop: boolean
  /** Where Save lands (the reader) and where Back / Cancel go. */
  readerHref: string
  onLeave: () => void
}

export const ChartEditor: React.FC<ChartEditorProps> = props =>
  props.desktop ? <DesktopEditor {...props} /> : <ChartPhoneEditor {...props} />

const DesktopEditor: React.FC<ChartEditorProps> = ({
  song,
  opened,
  live,
  refetch,
  readerHref,
  onLeave,
}) => {
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const initial = useMemo(() => editableText(opened?.chordpro ?? ''), [opened])
  const [text, setText] = useState(initial)
  const [mode, setMode] = useState<'full' | 'chords'>('full')
  const area = useRef<HTMLTextAreaElement>(null)
  const saver = useChartSaver(song.id, opened, refetch, readerHref)

  const imported = useMemo(() => importChart(text), [text])
  const preview = useMemo(() => parse(imported.chordpro), [imported])
  const key = chartKey(song.key, chordsInOrder(preview))
  const dirty = text !== initial
  const canCopyVerse = useMemo(
    () => nextVerseTarget(preview) != null,
    [preview]
  )

  const cancel = async () => {
    if (
      dirty &&
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
  const save = () => (dirty ? void saver.save(imported.chordpro) : onLeave())

  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip.trim()) setText(clip)
      else showToast('Nothing to paste yet. Copy a chart first.', 'info')
    } catch {
      area.current?.focus()
      showToast('Paste with ⌘V or Ctrl+V into the box.', 'info')
    }
  }
  const copyVerse = () => {
    const r = copyVerseInText(text)
    if (!r) return
    setText(r.text)
    showToast(`Copied ${r.from}'s chords onto ${r.to}`, 'success')
  }
  const showTheirs = () => {
    const theirs = saver.takeTheirs()
    if (!theirs) return
    const mine = text
    setText(editableText(theirs.chordpro))
    showToast(`Showing ${theirs.editorName || 'their'} chart`, 'info', {
      action: { label: 'Undo', onClick: () => setText(mine) },
    })
  }

  return (
    <div
      className="-mx-7 lg:-mx-8 -my-6 h-screen flex flex-col"
      data-testid="chart-editor-page"
    >
      <div className="px-8 pt-5">
        <button
          type="button"
          onClick={() => void cancel()}
          className="h-10 pl-2 pr-3.5 rounded-full bg-bg-3 text-ink-1 font-semibold flex items-center gap-1 hover:bg-bg-4"
          data-testid="chart-editor-back"
        >
          <ChevronLeft size={19} /> Song
        </button>
      </div>
      <div className="flex items-end gap-3 px-8 pt-2 pb-4">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11.5px] tracking-[.14em] uppercase text-ink-3">
            Chords &amp; lyrics
          </p>
          <h1 className="font-display font-extrabold uppercase leading-[.9] text-[48px] truncate">
            {song.title}
          </h1>
        </div>
        <Button onClick={() => void cancel()} data-testid="chart-editor-cancel">
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={<Check size={16} />}
          disabled={saver.saving}
          onClick={save}
          data-testid="chart-editor-save"
        >
          Save chart
        </Button>
      </div>
      {saver.conflict && (
        <div className="px-8 pb-3">
          <ConflictBanner
            conflict={saver.conflict}
            busy={saver.saving}
            onTheirs={showTheirs}
            onKeep={() => void saver.keepMine(imported.chordpro)}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-2 gap-5 px-8 pb-6">
        <section className="min-h-0 flex flex-col rounded-[20px] bg-bg-2 shadow-group p-4">
          <div className="flex items-center gap-3 mb-2.5">
            <b className="text-[15px] text-ink-1">Edit</b>
            <span className="ml-auto font-mono text-[10px] tracking-[.1em] uppercase text-ink-3 truncate">
              Chord lines above lyric lines · [Section] headers · ChordPro works
              too
            </span>
          </div>
          <label htmlFor="chart-editor-text" className="sr-only">
            Chart text
          </label>
          <textarea
            ref={area}
            id="chart-editor-text"
            name="chartText"
            data-testid="chart-editor-text"
            value={text}
            onChange={e => setText(e.target.value)}
            spellCheck={false}
            placeholder={
              'Paste a chart here.\n\nChord lines above lyric lines,\n[Verse] headers. ChordPro works too.'
            }
            className="flex-1 min-h-0 w-full resize-none rounded-xl bg-bg-1 p-3.5 font-mono text-[13px] leading-[1.55] text-ink-1 placeholder:text-ink-4 outline-none focus:ring-2 focus:ring-accent/40 custom-scrollbar-thin whitespace-pre overflow-auto"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              icon={<ClipboardPaste size={16} />}
              onClick={() => void paste()}
              data-testid="chart-editor-paste"
            >
              Paste
            </Button>
            {text ? (
              <Button
                onClick={() => setText('')}
                data-testid="chart-editor-clear"
              >
                Clear
              </Button>
            ) : (
              <Button
                onClick={() => setText(SAMPLE_CHART)}
                data-testid="chart-editor-sample"
              >
                Try a sample
              </Button>
            )}
            <Button
              disabled={!canCopyVerse}
              onClick={copyVerse}
              title="Copies the first verse's chords onto the next verse, word by word"
              data-testid="chart-editor-copy-verse"
            >
              Chords from Verse 1 → next verse
            </Button>
          </div>
          <div className="mt-4 pt-3 border-t border-divider">
            <StartingNoteRow
              songId={song.id}
              value={live?.startingNote ?? null}
              chartKey={key}
              desktop
            />
          </div>
        </section>

        <section className="min-h-0 flex flex-col rounded-[20px] bg-bg-2 shadow-group p-4">
          <div className="flex items-center gap-3 mb-2.5">
            <b className="text-[15px] text-ink-1">Preview</b>
            <div className="ml-auto w-[260px]">
              <Segmented
                label="Preview"
                options={[
                  { value: 'full', label: 'Lyrics + chords' },
                  { value: 'chords', label: 'Chords only' },
                ]}
                value={mode}
                onChange={setMode}
                data-testid="chart-editor-mode"
              />
            </div>
          </div>
          {text.trim() ? (
            <>
              <DetectedLine
                format={imported.format}
                sections={imported.sections}
                chords={imported.chords}
              />
              <div
                className="flex-1 min-h-0 overflow-y-auto custom-scrollbar-thin mt-3 pr-2"
                data-testid="chart-editor-preview"
              >
                <ChartText
                  chart={preview}
                  chartKey={key}
                  size={18}
                  mode={mode}
                />
              </div>
            </>
          ) : (
            <div
              className="flex-1 grid place-items-center text-center px-6"
              data-testid="chart-editor-preview-empty"
            >
              <div>
                <b className="block text-[16px] text-ink-1 mb-1">
                  No chart yet
                </b>
                <p className="text-[14px] text-ink-3">
                  Paste chords over lyrics on the left. Chords snap to the
                  letter they sit over.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
