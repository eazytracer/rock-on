import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { useSaveChart } from './useChart'
import { ApiError, errorText } from '../services/api/errors'
import type { SongChart } from '../services/api/charts'
import { createLogger } from '../utils/logger'

const log = createLogger('useChartSaver')

/** The server's cap (save_chart): 200 KB of UTF-8. */
export const CHART_MAX_BYTES = 204800
const TOO_LONG = "That's too long for one chart."

export interface Conflict {
  name: string
  theirs: SongChart
}

/**
 * Save with the version the editor opened. On `stale_version` the draft stays
 * and a conflict comes back for the banner: Show theirs swaps the draft for
 * the latest, Keep mine saves over it.
 */
export function useChartSaver(
  songId: string,
  opened: SongChart | null,
  refetch: () => Promise<{ data?: SongChart | null }>,
  readerHref: string
) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { saveChart, saving } = useSaveChart(songId)
  const base = useRef<number | undefined>(opened?.version)
  const [conflict, setConflict] = useState<Conflict | null>(null)

  const save = async (chordpro: string) => {
    if (new TextEncoder().encode(chordpro).length > CHART_MAX_BYTES) {
      showToast(TOO_LONG, 'error')
      return
    }
    try {
      await saveChart(chordpro, base.current)
      setConflict(null)
      showToast('Chart saved', 'success')
      navigate(readerHref, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.key === 'stale_version') {
        const { data } = await refetch()
        if (data) {
          setConflict({ name: data.editorName || 'Someone', theirs: data })
          return
        }
      }
      log.error('Save chart failed', err)
      showToast(errorText(err), 'error')
    }
  }

  return {
    save,
    saving,
    conflict,
    /** Show theirs: the caller swaps its draft for this text. */
    takeTheirs: () => {
      if (!conflict) return null
      base.current = conflict.theirs.version
      setConflict(null)
      return conflict.theirs
    },
    /** Keep mine: save the draft over the newer version. */
    keepMine: (chordpro: string) => {
      if (conflict) base.current = conflict.theirs.version
      return save(chordpro)
    },
  }
}
