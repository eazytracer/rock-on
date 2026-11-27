/**
 * The song preview pane, fixed on the right from 1440 px (Songs, setlists,
 * practices). The page makes room with `min-[1440px]:mr-[400px]
 * 2xl:mr-[480px]` while it's open.
 */
import React from 'react'
import { SongDetail } from './SongDetail'
import type { Song } from '../../models/Song'
import type { SongOrigin } from '../../utils/songOrigin'

export const SongPane: React.FC<{
  song: Song
  userId: string
  origin?: SongOrigin
  onClose?: () => void
}> = ({ song, userId, origin, onClose }) => (
  <aside
    className="fixed right-0 top-0 h-screen w-[400px] 2xl:w-[480px] border-l border-border-1 bg-bg-1 overflow-y-auto custom-scrollbar-thin px-6 pt-7"
    data-testid="song-pane"
  >
    <SongDetail
      key={song.id}
      song={song}
      userId={userId}
      origin={origin}
      onClose={onClose}
    />
  </aside>
)
