/**
 * /songs/new — Add song (docs/redesign/10 · 1.5). Inside the layout, so the
 * sidebar stays on desktop; full screen on phones. Saving lands on Songs with
 * the new song selected.
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useSaveSong } from '../hooks/useSongCatalog'
import { EditSongModal } from '../components/songs/EditSongModal'
import { createLogger } from '../utils/logger'

const log = createLogger('SongNewPage')

export const SongNewPage: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { currentBandId, currentUser } = useAuth()
  const saveSong = useSaveSong(currentBandId, currentUser?.id ?? '')

  // Cancel returns to wherever Add song was opened from (Songs, Home…).
  const close = () =>
    (window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/songs')

  return (
    <div data-testid="song-new-page">
      <EditSongModal
        showAlsoSaveToPersonal={!!currentBandId}
        onClose={close}
        onSave={async (song, options) => {
          try {
            const id = await saveSong(song, true, options?.alsoSaveToPersonal)
            showToast(
              options?.alsoSaveToPersonal
                ? `Added "${song.title}" to the band and My Songs`
                : `Added "${song.title}"`,
              'success'
            )
            navigate(`/songs?selected=${id}`, { replace: true })
          } catch (err) {
            log.error('Error adding song', err)
            showToast("Couldn't save the song. Try again.", 'error')
            throw err
          }
        }}
      />
    </div>
  )
}
