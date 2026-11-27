/**
 * A song's chart in a panel (the practice session's right side, from tablet
 * up): the text as the reader shows it, in your key and with your chords
 * setting and size, scrolling. Full screen (paging, Key −/+, chord diagrams)
 * is the reader, opened over the session.
 */
import React, { useMemo } from 'react'
import { ChartText } from './ChartText'
import { useChartPrefs } from '../../hooks/useChartPrefs'
import { chordsInOrder, parse } from '../../domain/chordpro'
import { chartKey } from '../../domain/chartView'
import type { Song } from '../../models/Song'

export const ChartPanel: React.FC<{ song: Song; chordpro: string }> = ({
  song,
  chordpro,
}) => {
  const prefs = useChartPrefs(song.id)
  const parsed = useMemo(() => parse(chordpro), [chordpro])
  const key = chartKey(song.key, chordsInOrder(parsed))
  return (
    <ChartText
      chart={parsed}
      transpose={prefs.transpose}
      chartKey={key}
      size={prefs.size}
      chords={prefs.chords}
      data-testid="session-chart-text"
    />
  )
}
