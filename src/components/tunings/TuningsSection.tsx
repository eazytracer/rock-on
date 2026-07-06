import { useState } from 'react'
import { Lock, Plus, Trash2, Guitar, Music2 } from 'lucide-react'
import { useTunings } from '../../hooks/useTunings'
import { useConfirm } from '../../hooks/useConfirm'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { useToast } from '../../contexts/ToastContext'
import { TuningService } from '../../services/TuningService'
import { midiToNoteName } from '../../utils/tunings'
import { CreateTuningModal } from './CreateTuningModal'
import type { Tuning } from '../../models/Tuning'

/** MIDI pitches → note string with the octave dropped, e.g. "E A D G B E". */
function noteString(pitches: number[]): string {
  return pitches.map(p => midiToNoteName(p).replace(/\d+$/, '')).join(' ')
}

function TuningRow({
  tuning,
  onDelete,
}: {
  tuning: Tuning
  onDelete?: (t: Tuning) => void
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-bg-1 border border-border-1 p-3"
      data-testid={`tuning-row-${tuning.id}`}
    >
      <span
        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: tuning.color ?? '#6b7280' }}
        aria-hidden
      />
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium text-white">
          {tuning.name}
        </span>
        <span className="block truncate font-mono text-xs text-ink-4">
          {noteString(tuning.pitches)}
        </span>
      </span>
      {tuning.isBuiltin ? (
        <Lock
          size={14}
          className="flex-shrink-0 text-ink-5"
          aria-label="Read-only"
        />
      ) : (
        <button
          onClick={() => onDelete?.(tuning)}
          data-testid={`tuning-delete-${tuning.id}`}
          aria-label={`Delete ${tuning.name}`}
          className="flex-shrink-0 rounded-lg p-1.5 text-ink-5 hover:text-danger hover:bg-bg-3"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}

/**
 * Settings › Tunings (fork #2). Built-ins are grouped by instrument and locked;
 * the user's custom tunings can be created (themed modal) and deleted (confirm).
 */
export function TuningsSection() {
  const { builtins, customs, loading, refetch } = useTunings()
  const { confirm, dialogProps } = useConfirm()
  const { showToast } = useToast()
  const [creating, setCreating] = useState(false)

  const guitarBuiltins = builtins.filter(t => t.instrument === 'guitar')
  const bassBuiltins = builtins.filter(t => t.instrument === 'bass')

  const handleDelete = async (t: Tuning) => {
    const ok = await confirm({
      title: 'Delete tuning',
      message: `Delete "${t.name}"? Songs using it keep their saved tuning label.`,
      variant: 'danger',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await TuningService.deleteCustomTuning(t.id)
      showToast('Tuning deleted', 'success')
      await refetch()
    } catch {
      showToast('Could not delete tuning', 'error')
    }
  }

  return (
    <section
      className="bg-surface-elevated rounded-lg border border-border-1 p-6"
      data-testid="settings-tunings"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Guitar size={22} className="text-accent" />
          <h2 className="text-xl font-semibold text-white">Tunings</h2>
        </div>
        <button
          onClick={() => setCreating(true)}
          data-testid="tunings-new-button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent"
        >
          <Plus size={16} /> New tuning
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink-4">Loading tunings…</p>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Your custom tunings */}
          <div>
            <h3 className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-4">
              Your tunings ({customs.length})
            </h3>
            {customs.length === 0 ? (
              <p className="text-sm text-ink-5">
                No custom tunings yet. Create one to reuse it across songs.
              </p>
            ) : (
              <div
                className="flex flex-col gap-2"
                data-testid="tunings-customs"
              >
                {customs.map(t => (
                  <TuningRow key={t.id} tuning={t} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>

          {/* Built-ins */}
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-4">
              <Guitar size={12} /> Guitar
            </h3>
            <div className="flex flex-col gap-2">
              {guitarBuiltins.map(t => (
                <TuningRow key={t.id} tuning={t} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-4">
              <Music2 size={12} /> Bass
            </h3>
            <div className="flex flex-col gap-2">
              {bassBuiltins.map(t => (
                <TuningRow key={t.id} tuning={t} />
              ))}
            </div>
          </div>
        </div>
      )}

      {creating && (
        <CreateTuningModal
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false)
            await refetch()
          }}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </section>
  )
}
