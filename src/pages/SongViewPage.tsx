/**
 * /songs/:songId — the song view on phones (desktop shows it in the Songs
 * pane too). Back, Edit and the song menu on top; the rest is SongDetail.
 */
import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, MoreHorizontal } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  useSong,
  useSaveSong,
  useDuplicateSong,
  useCopyToPersonal,
} from '../hooks/useSongCatalog'
import { useDeleteSong, usePersonalSongs } from '../hooks/useSongs'
import { useHiddenSongs } from '../hooks/useHiddenSongs'
import { useConfirm } from '../hooks/useConfirm'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { EditSongModal } from '../components/songs/EditSongModal'
import { SongDetail } from '../components/songs/SongDetail'
import { SongMenu, AddToSetlistSheet } from '../components/songs/SongSheets'
import { Empty } from '../components/ui'
import { songUsage } from '../services/api/songs'
import { usageSummary } from '../domain/songs'
import { createLogger } from '../utils/logger'
import { Music2 } from 'lucide-react'

const log = createLogger('SongViewPage')

export const SongViewPage: React.FC = () => {
  const { songId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { currentBandId, currentUser } = useAuth()
  const userId = currentUser?.id ?? ''
  const { song, loading } = useSong(songId)
  const saveSong = useSaveSong(currentBandId, userId)
  const duplicate = useDuplicateSong()
  const copyToMine = useCopyToPersonal()
  const { deleteSong } = useDeleteSong()
  const { songs: mine } = usePersonalSongs(userId)
  const { hiddenIds, hide, unhide } = useHiddenSongs()
  const { confirm, dialogProps } = useConfirm()
  const [editing, setEditing] = useState(false)
  const [menu, setMenu] = useState(false)
  const [usage, setUsage] = useState('')
  const [addToSet, setAddToSet] = useState(false)

  // /songs/:id#notes (from the desktop pane) lands on the notes.
  const { hash } = useLocation()
  const ready = !!song
  useEffect(() => {
    if (ready && hash === '#notes')
      document.getElementById('notes')?.scrollIntoView({ block: 'start' })
  }, [ready, hash])

  const back = () =>
    window.history.length > 1 ? navigate(-1) : navigate('/songs')

  if (loading)
    return <ContentLoadingSpinner isLoading>{null}</ContentLoadingSpinner>
  if (!song)
    return (
      <Empty
        icon={<Music2 size={28} />}
        title="This song was deleted."
        why="It's no longer in this catalog."
        data-testid="song-view-missing"
      />
    )

  const hidden = hiddenIds.has(song.id)
  const run = async (what: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      log.error(what, err)
      showToast("That didn't work. Try again.", 'error')
    }
  }

  return (
    <div data-testid="song-view-page" className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={back}
          className="h-10 pl-2 pr-3.5 rounded-full bg-bg-3 text-ink-1 font-semibold flex items-center gap-1"
          data-testid="song-view-back"
        >
          <ChevronLeft size={19} /> Songs
        </button>
        <button
          type="button"
          onClick={() => {
            setMenu(true)
            songUsage(song.id)
              .then(u => setUsage(usageSummary(u)))
              .catch(() => {})
          }}
          aria-label="Song menu"
          className="ml-auto w-10 h-10 rounded-full bg-bg-3 grid place-items-center text-ink-1"
          data-testid="song-view-menu"
        >
          <MoreHorizontal size={19} />
        </button>
      </div>

      <SongDetail song={song} userId={userId} onEdit={() => setEditing(true)} />

      {editing && (
        <EditSongModal
          song={song}
          mode="edit"
          onClose={() => setEditing(false)}
          onSave={async s => {
            try {
              await saveSong(s, false)
              showToast(`Saved "${s.title}"`, 'success')
              setEditing(false)
            } catch (err) {
              log.error('Error saving song', err)
              showToast("Couldn't save the song. Try again.", 'error')
              throw err
            }
          }}
        />
      )}

      {menu && (
        <SongMenu
          song={song}
          at={null}
          hidden={hidden}
          inMySongs={mine.some(m => m.linkedFromSongId === song.id)}
          usage={usage}
          onClose={() => setMenu(false)}
          onOpen={() => {}}
          onEdit={() => setEditing(true)}
          onAddToSet={() => setAddToSet(true)}
          onCopyToMine={
            song.contextType === 'band'
              ? () =>
                  run('copy', async () => {
                    await copyToMine([song.id])
                    showToast('Added to My Songs', 'success')
                  })
              : undefined
          }
          onDuplicate={() =>
            run('duplicate', async () => {
              const id = await duplicate(song.id)
              navigate(`/songs/${id}`, { replace: true })
            })
          }
          onToggleHidden={() =>
            run('hide', () => (hidden ? unhide(song.id) : hide(song.id)))
          }
          onDelete={() =>
            run('delete', async () => {
              const ok = await confirm({
                title: `Delete "${song.title}"?`,
                message: usage
                  ? `${usage}. It comes out of those setlists. This can't be undone.`
                  : "This can't be undone.",
                confirmLabel: 'Delete',
                variant: 'danger',
              })
              if (!ok) return
              await deleteSong(song.id)
              showToast(`Deleted "${song.title}"`, 'success')
              navigate('/songs', { replace: true })
            })
          }
        />
      )}
      {addToSet && (
        <AddToSetlistSheet
          song={song}
          onClose={() => setAddToSet(false)}
          onNewSetlist={() => navigate('/setlists/new')}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
