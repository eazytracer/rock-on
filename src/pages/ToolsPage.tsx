/**
 * /tools/:tab — one Tools screen, three tabs (docs/redesign/12 · 2.1–2.3):
 * Back · "Tools" · Tuner | Metronome | Chords. The tabs are components so the
 * practice session can open them as layers; this page is a thin wrapper that
 * reads the link (`domain/toolsLink`). `/tools` lands on the last tab used.
 * Switching tabs unmounts the old one, which stops the mic and the clicks.
 */
import React, { useEffect } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BackCrumb } from '../components/layout/MobileHeader'
import { useGoBack } from '../hooks/useGoBack'
import { useMediaQuery } from '../hooks/useResponsive'
import { PageTitle, Segmented } from '../components/ui'
import { Tuner } from '../components/tools/Tuner'
import { Metronome } from '../components/tools/Metronome'
import { ChordLookup } from '../components/tools/ChordLookup'
import { normalizeChord } from '../domain/chords'
import { strum } from '../services/audio/synth'
import { resumeAudio } from '../services/audio/audioContext'
import {
  isToolsTab,
  parseToolsParams,
  toolsHref,
  type ToolsParams,
  type ToolsTab,
} from '../domain/toolsLink'
import { readToolsTab, saveToolsTab } from '../utils/toolsMemory'

const TAB_LABELS: Record<ToolsTab, string> = {
  tuner: 'Tuner',
  metronome: 'Metronome',
  chords: 'Chords',
}

/** The tab bodies. */
function tabBody(
  tab: ToolsTab,
  params: ToolsParams,
  setChord: (chord: string) => void
): React.ReactNode {
  switch (tab) {
    case 'tuner':
      return <Tuner tuning={params.tuning} prev={params.prev} />
    case 'metronome':
      return <Metronome songId={params.song} bpm={params.bpm} />
    case 'chords':
      return (
        <ChordLookup
          chord={normalizeChord(params.chord ?? '') ?? 'G'}
          onChange={setChord}
          onPlay={midis => {
            resumeAudio()
            strum(midis)
          }}
        />
      )
  }
}

export const ToolsPage: React.FC = () => {
  const { tab } = useParams<{ tab: string }>()
  const { search } = useLocation()
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const desktop = useMediaQuery('(min-width: 768px)')
  const valid = isToolsTab(tab)

  useEffect(() => {
    if (valid) saveToolsTab(tab)
  }, [valid, tab])

  if (!valid) return <Navigate to={toolsHref(readToolsTab())} replace />

  const params = parseToolsParams(search)
  const tabs = (
    <div className="w-full md:w-[340px]">
      <Segmented
        label="Tool"
        options={(Object.keys(TAB_LABELS) as ToolsTab[]).map(t => ({
          value: t,
          label: TAB_LABELS[t],
        }))}
        value={tab}
        onChange={t =>
          // A tab switch keeps the link's params for the tab they belong to.
          navigate(toolsHref(t, t === tab ? params : {}), { replace: true })
        }
        data-testid="tools-tab"
      />
    </div>
  )

  return (
    <div data-testid="tools-page" className="pb-28 md:pb-8">
      <BackCrumb
        label="Back"
        onClick={goBack}
        className="mb-3"
        data-testid="tools-back"
      />
      {desktop ? (
        <PageTitle eyebrow="Tools" title={TAB_LABELS[tab]} actions={tabs} />
      ) : (
        <header className="mb-4">{tabs}</header>
      )}
      {/* The chord lives in the link; picking one mustn't remount the tab. */}
      <React.Fragment key={tab === 'chords' ? tab : `${tab}${search}`}>
        {tabBody(tab, params, chord =>
          navigate(toolsHref('chords', { chord }), { replace: true })
        )}
      </React.Fragment>
    </div>
  )
}

export default ToolsPage
