/**
 * Delete account (Account and Settings 9; decision 8; slice 6f): what goes,
 * what stays, a required transfer while you own a band, and DELETE typed.
 * The `delete-account` edge function does the work; then we sign out.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Crown } from 'lucide-react'
import { Button, Group, ListRow } from '../ui'
import { useAuth } from '../../contexts/AuthContext'
import { useMyContexts } from '../../hooks/useMyContexts'
import { ApiError } from '../../services/api/errors'
import { deleteAccount } from '../../services/api/account'
import { queryClient } from '../../services/queryClient'
import { createLogger } from '../../utils/logger'
import { fieldLabel } from './fields'

const log = createLogger('DeleteAccount')

export const DeleteAccount: React.FC = () => {
  const navigate = useNavigate()
  const { signOut, setContext } = useAuth()
  const { data: contexts, isLoading } = useMyContexts()
  const owned = (contexts ?? []).filter(c => c.role === 'owner')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const transfer = async (bandId: string) => {
    try {
      await setContext(bandId)
    } catch (err) {
      log.error('Switch to band failed', err)
    }
    navigate('/band')
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteAccount()
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "That didn't work. Try again."
      )
      if (err instanceof ApiError && err.key === 'owns_band')
        void queryClient.invalidateQueries({ queryKey: ['contexts'] })
      setBusy(false)
      return
    }
    queryClient.clear()
    await signOut()
    navigate('/auth', { replace: true })
  }

  const ready = typed === 'DELETE' && owned.length === 0 && !isLoading

  return (
    <div className="px-3" data-testid="settings-delete">
      <div className="px-3">
        <p className="text-[15px] text-ink-2">
          This can't be undone. Before it goes:
        </p>
        <ul
          className="list-disc pl-5 mt-2 mb-4 space-y-1 text-[14px] leading-relaxed text-ink-2"
          data-testid="delete-account-consequences"
        >
          {owned.map(b => (
            <li key={b.band_id}>
              You own <b className="text-ink-1">{b.name}</b>. Transfer it or
              delete it first.
            </li>
          ))}
          <li>
            Your personal songs, setlists and notes are deleted, and your
            friends list with them.
          </li>
          <li>
            Songs, setlists and shows you added to bands stay with the band,
            credited to “Former member”.
          </li>
        </ul>
      </div>

      {owned.length > 0 && (
        <Group data-testid="delete-account-owner-block">
          {owned.map(b => (
            <ListRow
              key={b.band_id}
              lead={<Crown size={20} className="text-warn shrink-0" />}
              title={`Transfer ${b.name}`}
              sub="Required · pick a new owner"
              trail={<ChevronRight size={18} />}
              onClick={() => void transfer(b.band_id)}
              data-testid={`delete-account-transfer-${b.band_id}`}
            />
          ))}
        </Group>
      )}

      <div className="px-3 pt-3">
        <label htmlFor="delete-account-confirm" className={fieldLabel}>
          Type DELETE to confirm
        </label>
        <input
          id="delete-account-confirm"
          name="deleteConfirm"
          data-testid="delete-account-confirmation-input"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="DELETE"
          className="w-full h-12 px-3.5 rounded-xl bg-bg-3 font-mono text-[15px] text-ink-1 placeholder:text-ink-5 outline-none shadow-[inset_0_0_0_2px_rgb(var(--danger-rgb)/.7)]"
        />
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-[14px] bg-danger/10 px-3.5 py-3 text-[14px] text-ink-1"
            data-testid="delete-account-error"
          >
            {error}
          </p>
        )}
        <Button
          variant="danger"
          size="lg"
          fullWidth
          className="mt-4"
          disabled={!ready || busy}
          onClick={() => void submit()}
          data-testid="delete-account-confirm-button"
        >
          {busy ? 'Deleting…' : 'Delete account'}
        </Button>
      </div>
    </div>
  )
}
