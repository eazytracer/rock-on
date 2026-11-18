/**
 * The way into a song's chart (Song Chart 1; docs/redesign/12 · 2.2): the
 * primary **Chords & lyrics** when there's a chart, a dashed **Add chords &
 * lyrics** when there isn't, and **Copy ‹band›'s chart** on an empty My Songs
 * copy whose band song has one (decision 2). Links carry the page's `?from=`.
 */
import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Copy, Music2, Plus } from 'lucide-react'
import { useChart } from '../../hooks/useChart'
import { useLinkedChartCopy } from '../../hooks/useLinkedChartCopy'
import type { Song } from '../../models/Song'

const BASE =
  'h-11 px-4 rounded-full font-bold flex items-center gap-2 active:scale-[.96] transition-transform'

export const ChartButton: React.FC<{
  song: Song
  /** `?from=…` to carry; default: the current page's own `from`. */
  search?: string
  testId: string
}> = ({ song, search, testId }) => {
  const location = useLocation()
  const from = new URLSearchParams(location.search).get('from')
  const carry =
    search ?? (from ? `?${new URLSearchParams({ from }).toString()}` : '')
  const bandId = song.contextType === 'band' ? song.contextId : undefined
  const { chart, loading } = useChart(song.id, bandId)
  const has = !!chart?.chordpro.trim()
  const copy = useLinkedChartCopy(song, loading || has)

  if (loading || has)
    return (
      <Link
        to={`/songs/${song.id}/chart${carry}`}
        className={`${BASE} bg-accent text-on-accent`}
        data-testid={testId}
      >
        <Music2 size={17} /> Chords &amp; lyrics
      </Link>
    )
  return (
    <>
      <Link
        to={`/songs/${song.id}/chart/edit${carry}`}
        className={`${BASE} bg-bg-2 text-ink-1 border-[1.5px] border-dashed border-border-1`}
        data-testid={`${testId.replace('chords', 'add-chart')}`}
      >
        <Plus size={17} /> Add chords &amp; lyrics
      </Link>
      {copy.available && (
        <button
          type="button"
          disabled={copy.copying}
          onClick={() => void copy.copy()}
          className={`${BASE} bg-bg-3 text-ink-1 disabled:opacity-50`}
          data-testid={`${testId.replace('chords', 'copy-chart')}`}
        >
          <Copy size={16} /> Copy {copy.bandName}&apos;s chart
        </button>
      )}
    </>
  )
}
