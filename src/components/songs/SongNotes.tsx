/**
 * Song page notes (docs/redesign/10 · 1.4). Each layer shows rendered Markdown;
 * Edit (or a click on the text) opens the editor in place with Cancel / Done.
 * One note open at a time. The band note keeps your draft when a bandmate
 * saved first and lets you pick which to keep.
 */
import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ListMusic,
  Lock,
  Pencil,
  Users,
} from 'lucide-react'
import type { Song } from '../../models/Song'
import type { SetlistItem } from '../../models/Setlist'
import { MarkdownRenderer } from '../notes/MarkdownRenderer'
import { MarkdownWriter } from '../notes/MarkdownWriter'
import { usePersonalNote, useNoteEntries } from '../../hooks/useNotes'
import { useBandMembers } from '../../hooks/useBands'
import {
  useSaveBandNote,
  useSaveSetlistItemNote,
} from '../../hooks/useSongCatalog'
import { useToast } from '../../contexts/ToastContext'
import { shortTime } from '../../domain/notifications'
import { createLogger } from '../../utils/logger'

const log = createLogger('SongNotes')

export type NoteLayerKey = 'band' | 'mine' | 'set'

const SECTION =
  'px-1 pt-6 pb-2 font-mono text-[11px] tracking-[.14em] uppercase text-ink-3'

interface Conflict {
  theirs: string
  name: string
}

const NoteLayer: React.FC<{
  layer: NoteLayerKey
  icon: React.ReactNode
  title: string
  sub: string
  value: string
  placeholder: string
  editing: boolean
  onEdit: () => void
  onClose: () => void
  /** Returns a conflict to show instead of closing, or nothing when saved. */
  onDone: (draft: string, base: string) => Promise<Conflict | void>
  accent?: boolean
  footer?: React.ReactNode
}> = ({
  layer,
  icon,
  title,
  sub,
  value,
  placeholder,
  editing,
  onEdit,
  onClose,
  onDone,
  accent,
  footer,
}) => {
  const { showToast } = useToast()
  const [draft, setDraft] = useState(value)
  const [base, setBase] = useState(value)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [busy, setBusy] = useState(false)

  // Opening the editor starts from what's saved now.
  useEffect(() => {
    if (editing) {
      setDraft(value)
      setBase(value)
      setMode('write')
      setConflict(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const done = async (text = draft, against = base) => {
    if (text === against && !conflict) return onClose()
    setBusy(true)
    try {
      const c = await onDone(text, against)
      if (c) setConflict(c)
      else {
        setConflict(null)
        onClose()
      }
    } catch (err) {
      log.error(`Saving the ${layer} note failed`, err)
      showToast("Couldn't save the note. Try again.", 'error')
    } finally {
      setBusy(false)
    }
  }

  const showTheirs = () => {
    if (!conflict) return
    const mine = draft
    setDraft(conflict.theirs)
    setBase(conflict.theirs)
    setConflict(null)
    showToast(`Showing ${conflict.name}'s note`, 'info', {
      action: { label: 'Undo', onClick: () => setDraft(mine) },
    })
  }

  return (
    <div
      className={`rounded-[18px] bg-bg-2 shadow-group p-4 ${
        accent ? 'border-l-[3px] border-accent' : ''
      }`}
      data-testid={`song-note-${layer}`}
    >
      <div className="flex items-center gap-2 min-h-[40px]">
        <span className="text-ink-3 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
        <b className="text-[14.5px] text-ink-1">{title}</b>
        <span className="text-[12.5px] text-ink-3">{sub}</span>
        {!editing && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto h-10 px-4 rounded-full bg-bg-3 text-ink-1 font-bold flex items-center gap-2 hover:bg-bg-4"
            data-testid={`song-note-${layer}-edit`}
          >
            <Pencil size={15} /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div
          role="button"
          tabIndex={0}
          onClick={e => {
            // Links inside the note open; anywhere else starts editing.
            if (!(e.target as HTMLElement).closest('a')) onEdit()
          }}
          onKeyDown={e => e.key === 'Enter' && onEdit()}
          className="mt-1 cursor-text text-[15px]"
          data-testid={`song-note-${layer}-view`}
        >
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="py-1 italic text-ink-4">{placeholder}</p>
          )}
        </div>
      ) : (
        <div className="mt-2">
          {conflict && (
            <div
              className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-warn/15 px-3.5 py-3"
              role="alert"
              data-testid="song-note-conflict"
            >
              <AlertTriangle size={18} className="text-warn shrink-0" />
              <p className="flex-1 min-w-[200px] text-[13.5px] text-ink-1">
                <b>
                  {conflict.name} saved a newer band note while you were typing.
                </b>{' '}
                Yours isn't lost. Pick which to keep.
              </p>
              <button
                type="button"
                onClick={showTheirs}
                className="h-10 px-4 rounded-full bg-bg-3 text-ink-1 font-bold hover:bg-bg-4"
                data-testid="song-note-conflict-theirs"
              >
                Show theirs
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => done(draft, conflict.theirs)}
                className="h-10 px-4 rounded-full bg-accent text-on-accent font-bold disabled:opacity-60"
                data-testid="song-note-conflict-keep"
              >
                Keep mine
              </button>
            </div>
          )}
          <MarkdownWriter
            value={draft}
            onChange={setDraft}
            mode={mode}
            onModeChange={setMode}
            onDone={() => void done()}
            onCancel={onClose}
            rows={12}
          />
          <div className="mt-3 flex items-center gap-2">
            <span className="hidden md:inline font-mono text-[11px] tracking-[.1em] uppercase text-ink-4">
              Markdown · ⌘↵ Done · Esc Cancel
            </span>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto h-11 px-5 rounded-full bg-bg-3 text-ink-1 font-bold hover:bg-bg-4"
              data-testid="song-note-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void done()}
              className="h-11 px-5 rounded-full bg-accent text-on-accent font-bold flex items-center gap-2 disabled:opacity-60"
              data-testid="song-note-done"
            >
              <Check size={17} /> Done
            </button>
          </div>
        </div>
      )}
      {!editing && footer}
    </div>
  )
}

export const SongNotes: React.FC<{
  song: Song
  userId: string
  editing: NoteLayerKey | null
  setEditing: (layer: NoteLayerKey | null) => void
  setlist?: { id: string; name: string; item: SetlistItem }
}> = ({ song, userId, editing, setEditing, setlist }) => {
  const { showToast } = useToast()
  const isBand = song.contextType === 'band'
  const bandId = isBand ? song.contextId : ''
  const { personalNote, upsertNote } = usePersonalNote(song.id, userId, bandId)
  const { entries } = useNoteEntries(song.id, bandId, userId)
  const { members } = useBandMembers(bandId)
  const saveBand = useSaveBandNote(song.id)
  const saveSetNote = useSaveSetlistItemNote(setlist?.id ?? '')
  const [logOpen, setLogOpen] = useState(false)

  const firstName = (id?: string | null) => {
    if (!id) return 'Former member'
    if (id === userId) return 'You'
    const m = members.find(x => x.membership.userId === id)
    return (m?.profile?.displayName || m?.user?.name || 'A bandmate').split(
      ' '
    )[0]
  }

  const open = (layer: NoteLayerKey) => () => {
    if (editing && editing !== layer) {
      showToast("Finish or cancel the note you're editing", 'info')
      return
    }
    setEditing(layer)
  }
  const close = () => setEditing(null)

  const editor = firstName(song.notesEditedBy)
  const log = [...entries].sort(
    (a, b) =>
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
  )

  const bandFooter =
    isBand && (editor || log.length > 0) ? (
      <div className="mt-3">
        <p className="flex items-center gap-3 font-mono text-[11px] tracking-[.1em] uppercase text-ink-3">
          {editor && song.notesEditedAt && (
            <span data-testid="song-note-band-edited">
              {editor} · {shortTime(song.notesEditedAt.toISOString())}
            </span>
          )}
          {log.length > 0 && (
            <button
              type="button"
              onClick={() => setLogOpen(o => !o)}
              aria-expanded={logOpen}
              className="text-accent-ink tracking-[.1em] uppercase"
              data-testid="song-practice-log-toggle"
            >
              Practice log · {log.length}
            </button>
          )}
        </p>
        {logOpen && (
          <div
            className="mt-2 divide-y divide-divider border-t border-divider"
            data-testid="song-practice-log"
          >
            {log.map(e => (
              <div key={e.id} className="flex gap-4 py-2.5">
                <span className="w-[100px] shrink-0 font-mono text-[11px] uppercase leading-snug text-ink-3">
                  {new Date(e.createdDate).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  <br />
                  {firstName(e.userId)}
                </span>
                <div className="flex-1 min-w-0 text-[14px] text-ink-1">
                  <MarkdownRenderer content={e.content} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ) : null

  return (
    <section id="notes" aria-label="Notes">
      <div className={SECTION}>Notes</div>
      <div className="space-y-3">
        {setlist && (
          <NoteLayer
            layer="set"
            icon={<ListMusic />}
            title={`In ${setlist.name}`}
            sub="this set only"
            value={setlist.item.notes || ''}
            placeholder="A note for this song in this set. Click to add."
            accent
            editing={editing === 'set'}
            onEdit={open('set')}
            onClose={close}
            onDone={async draft => {
              await saveSetNote(setlist.item.id, draft)
            }}
          />
        )}
        <NoteLayer
          layer="band"
          icon={isBand ? <Users /> : <Lock />}
          title={isBand ? 'Band note' : 'Notes'}
          sub={isBand ? 'shared with the band' : 'only you'}
          value={song.notes || ''}
          placeholder={
            isBand
              ? 'A note the whole band sees. Click to add.'
              : 'Click to add.'
          }
          editing={editing === 'band'}
          onEdit={open('band')}
          onClose={close}
          onDone={async (draft, base) => {
            const r = await saveBand(draft, base, song.version)
            if (!r.ok)
              return {
                theirs: r.theirs,
                name: firstName(r.editedBy) || 'A bandmate',
              }
          }}
          footer={bandFooter}
        />
        {isBand && (
          <NoteLayer
            layer="mine"
            icon={<Lock />}
            title="My notes"
            sub="only you"
            value={personalNote?.content || ''}
            placeholder="Only you see this. Click to add."
            editing={editing === 'mine'}
            onEdit={open('mine')}
            onClose={close}
            onDone={async draft => {
              await upsertNote(draft)
            }}
          />
        )}
      </div>
    </section>
  )
}
