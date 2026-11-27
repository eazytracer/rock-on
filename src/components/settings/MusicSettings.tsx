/**
 * Music (decision 6; Metronome 4 trimmed): the metronome's click sound, synced
 * in `user_preferences.metronome`, and Tunings. Tapping a sound picks it and
 * plays a bar of it. The Tools screen itself doesn't change.
 */
import React from 'react'
import { Check } from 'lucide-react'
import { Group, ListRow } from '../ui'
import { TuningsSection } from '../tunings/TuningsSection'
import { useMetronomePrefs } from '../../hooks/useAccount'
import { useToast } from '../../contexts/ToastContext'
import { errorText } from '../../services/api/errors'
import type { ClickSound } from '../../services/api/preferences'
import { playClick } from '../../services/audio/metronomeEngine'
import { resumeAudio } from '../../services/audio/audioContext'
import { groupNote } from './fields'
import { CLICK_LABELS } from './labels'

/** One bar of 4 at 120 BPM, accent first. */
function preview(sound: ClickSound) {
  try {
    const ctx = resumeAudio()
    const t = ctx.currentTime + 0.03
    for (let i = 0; i < 4; i++)
      playClick(ctx, ctx.destination, sound, i ? 'beat' : 'accent', t + i * 0.5)
  } catch {
    /* no audio on this device: the choice still saves */
  }
}

export const MusicSettings: React.FC = () => {
  const { prefs, save } = useMetronomePrefs()
  const { showToast } = useToast()

  const pick = (click: ClickSound) => {
    preview(click)
    if (click === prefs.click) return
    save({ click }).catch(err => showToast(errorText(err), 'error'))
  }

  return (
    <div className="flex flex-col gap-4" data-testid="settings-music">
      <div>
        <Group label="Metronome click" data-testid="music-click-sound">
          <div role="radiogroup" aria-label="Click sound">
            {(Object.keys(CLICK_LABELS) as ClickSound[]).map(k => (
              <div
                key={k}
                role="radio"
                aria-checked={prefs.click === k}
                className="border-b border-divider last:border-0"
              >
                <ListRow
                  title={CLICK_LABELS[k].title}
                  sub={CLICK_LABELS[k].sub}
                  onClick={() => pick(k)}
                  trail={
                    prefs.click === k ? (
                      <Check size={20} className="text-accent-ink" />
                    ) : undefined
                  }
                  data-testid={`music-click-${k}`}
                />
              </div>
            ))}
          </div>
        </Group>
        <p className={groupNote}>
          Tap to hear it. Tempo, time and flash stay as you left them on each
          device.
        </p>
      </div>
      <div className="px-3">
        <TuningsSection />
      </div>
    </div>
  )
}
