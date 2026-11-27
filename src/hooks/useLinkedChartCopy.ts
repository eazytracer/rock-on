import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useCopyLinkedChart, useLinkedChartAvailable } from './useChart'
import { useSong } from './useSongCatalog'
import { errorText } from '../services/api/errors'
import type { Song } from '../models/Song'
import { createLogger } from '../utils/logger'

const log = createLogger('useLinkedChartCopy')

/**
 * "Copy ‹band›'s chart" (decision 2): offered on a My Songs copy with no chart
 * of its own whose band song has one. Pass `hasChart` once the copy's own
 * chart has loaded, so nothing is fetched for songs that don't need it.
 */
export function useLinkedChartCopy(song: Song | null, hasChart: boolean) {
  const { userBands } = useAuth()
  const { showToast } = useToast()
  const linked =
    song && song.contextType === 'personal' && !hasChart
      ? song.linkedFromSongId || null
      : null
  const available = useLinkedChartAvailable(linked)
  const { song: bandSong } = useSong(available && linked ? linked : '')
  const bandName =
    userBands.find(b => b.id === bandSong?.contextId)?.name ?? 'the band'
  const { copyLinkedChart, copying } = useCopyLinkedChart(song?.id ?? '')

  const copy = async () => {
    try {
      await copyLinkedChart()
      showToast(`Copied ${bandName}'s chart`, 'success')
      return true
    } catch (err) {
      log.error('Copy linked chart failed', err)
      showToast(errorText(err), 'error')
      return false
    }
  }

  return { available: !!linked && available, bandName, copy, copying }
}
