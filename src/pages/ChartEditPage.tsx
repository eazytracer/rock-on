/**
 * /songs/:songId/chart/edit?from=… — the chart editor as a route (docs/
 * redesign/12 · 2.1): a full-screen route on phones, a two-pane page inside
 * the layout on desktop. Loads the song and its chart, then hands the chart
 * as it was on opening to the editor (its version is what Save checks).
 */
import React, { useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Music2 } from 'lucide-react'
import { useSong } from '../hooks/useSongCatalog'
import { useChart } from '../hooks/useChart'
import { useGoBack } from '../hooks/useGoBack'
import { useMediaQuery } from '../hooks/useResponsive'
import { ChartEditor } from '../components/chart/ChartEditor'
import { Empty, RetryCard } from '../components/ui'
import type { SongChart } from '../services/api/charts'

export const ChartEditPage: React.FC = () => {
  const { songId = '' } = useParams()
  const { search } = useLocation()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const { song, loading } = useSong(songId)
  const bandId = song?.contextType === 'band' ? song.contextId : undefined
  const chart = useChart(song ? songId : null, bandId)
  const goBack = useGoBack(`/songs/${songId}${search}`)
  // The chart as it was when the editor opened: later updates (a bandmate's
  // save, our own starting note) never reset the draft.
  const [opened, setOpened] = useState<SongChart | null | undefined>(undefined)
  if (opened === undefined && song && !chart.loading && !chart.error)
    setOpened(chart.chart)

  if (loading || (song && opened === undefined && !chart.error))
    return (
      <div
        className="fixed inset-0 z-[55] bg-bg-1 lg:static lg:bg-transparent"
        data-testid="chart-editor-loading"
      />
    )
  if (!song)
    return (
      <Empty
        icon={<Music2 size={28} />}
        title="This song was deleted."
        why="It's no longer in this catalog."
        data-testid="chart-song-missing"
      />
    )
  if (opened === undefined)
    return (
      <div className="pt-6" data-testid="chart-editor-page">
        <RetryCard
          message="Couldn't load the chart."
          onRetry={() => void chart.refetch()}
        />
      </div>
    )
  return (
    <ChartEditor
      key={song.id}
      song={song}
      opened={opened}
      live={chart.chart}
      refetch={chart.refetch}
      desktop={desktop}
      readerHref={`/songs/${song.id}/chart${search}`}
      onLeave={goBack}
    />
  )
}

export default ChartEditPage
