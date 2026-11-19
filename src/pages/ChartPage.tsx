/**
 * /songs/:songId/chart?from=… — the chart reader as a route (docs/redesign/12
 * · 2.1). A thin wrapper: loads the song and renders `ChartReader`. Back / ×
 * goes to the song page with the same `?from=`, so Back from there still goes
 * where the song came from.
 */
import React from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Music2 } from 'lucide-react'
import { BackCrumb } from '../components/layout/MobileHeader'
import { useSong } from '../hooks/useSongCatalog'
import { ChartReader } from '../components/chart/ChartReader'
import { Empty } from '../components/ui'

export const ChartPage: React.FC = () => {
  const { songId = '' } = useParams()
  const { search } = useLocation()
  const navigate = useNavigate()
  const { song, loading } = useSong(songId)
  const back = () => navigate(`/songs/${songId}${search}`)

  if (loading)
    return (
      <div
        className="fixed inset-0 z-[55] bg-bg-0 lg:static lg:bg-transparent"
        data-testid="chart-page-loading"
      />
    )
  if (!song)
    return (
      <div data-testid="chart-page">
        <BackCrumb
          to="/songs"
          label="Songs"
          className="mb-4"
          data-testid="chart-back"
        />
        <Empty
          icon={<Music2 size={28} />}
          title="This song was deleted."
          why="It's no longer in this catalog."
          data-testid="chart-song-missing"
        />
      </div>
    )
  return <ChartReader song={song} onClose={back} linkSearch={search} />
}

export default ChartPage
