import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Plus, Trash2, Guitar, Music2, Pencil } from 'lucide-react'
import { useTunings } from '../../hooks/useTunings'
import { useConfirm } from '../../hooks/useConfirm'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { useToast } from '../../contexts/ToastContext'
import { TuningService } from '../../services/TuningService'
import { pitchNames, tuningColor, tuningOrderIndex } from '../../utils/tunings'
import { customColour } from '../../domain/tuningEdit'
import { ForkIcon } from '../setlists/SetlistStats'
import { TuningEditor } from './TuningEditor'
import type { Tuning } from '../../models/Tuning'

function TuningRow({
  tuning,
  onDelete,
  onEdit,
}: {
  tuning: Tuning
  onDelete?: (t: Tuning) => void
  onEdit?: (t: Tuning) => void
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-bg-1 border border-border-1 p-3"
      data-testid={`tuning-row-${tuning.id}`}
    >
      <span
        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{
          backgroundColor: tuning.isBuiltin
            ? tuningColor(tuning.slug)
            : (customColour(tuning) ?? '#6b7280'),
        }}
        aria-hidden
      />
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium text-ink-1">
          {tuning.name}
        </span>
        <span className="block truncate font-mono text-xs text-ink-4">
          {pitchNames(tuning.pitches)}
        </span>
      </span>
      {tuning.isBuiltin ? (
        <Lock
          size={14}
          className="flex-shrink-0 text-ink-5"
          aria-label="Read-only"
        />
      ) : (
        <>
          <button
            onClick={() => onEdit?.(tuning)}
            data-testid={`tuning-edit-${tuning.id}`}
            aria-label={`Edit ${tuning.name}`}
            className="flex-shrink-0 rounded-lg p-1.5 text-ink-4 hover:text-ink-1 hover:bg-bg-3"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onDelete?.(tuning)}
            data-testid={`tuning-delete-${tuning.id}`}
            aria-label={`Delete ${tuning.name}`}
            className="flex-shrink-0 rounded-lg p-1.5 text-ink-5 hover:text-danger hover:bg-bg-3"
          >
            <Trash2 size={15} />
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Settings › Tunings (fork #2). Built-ins are grouped by instrument and locked;
 * the user's custom tunings can be created and edited (the neck editor) and
 * deleted (confirm). One Tuner shortcut in the top bar (DECISIONS).
 */
export function TuningsSection() {
  const { builtins, customs, loading, refetch } = useTunings()
  const { confirm, dialogProps } = useConfirm()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Tuning | null>(null)

  // Picker order (Standard first), as the song's tuning picker shows them.
  const ordered = [...builtins].sort(
    (a, b) =>
      tuningOrderIndex(a.slug) - tuningOrderIndex(b.slug) ||
      a.name.localeCompare(b.name)
  )
  const guitarBuiltins = ordered.filter(t => t.instrument === 'guitar')
  const bassBuiltins = ordered.filter(t => t.instrument === 'bass')

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Guitar size={22} className="text-accent" />
          <h2 className="text-xl font-semibold text-ink-1">Tunings</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/tools/tuner')}
            data-testid="settings-tunings-tuner"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-bg-3 px-3 py-2 text-sm font-medium text-ink-1"
          >
            <ForkIcon size={16} /> Tuner
          </button>
          <button
            onClick={() => setCreating(true)}
            data-testid="tunings-new-button"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent"
          >
            <Plus size={16} /> New tuning
          </button>
        </div>
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
                  <TuningRow
                    key={t.id}
                    tuning={t}
                    onDelete={handleDelete}
                    onEdit={setEditing}
                  />
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

      {(creating || editing) && (
        <TuningEditor
          tuning={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </section>
  )
}
