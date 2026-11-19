/**
 * Account (Account and Settings 5; desktop `settings.account`): email,
 * sign-in methods (from the session's identities), Change password (asks the
 * current one first; hidden without a password identity), and on desktop the
 * way to Delete account.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Eye, EyeOff } from 'lucide-react'
import { Button, Group, ListRow } from '../ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useSignInMethods } from '../../hooks/useAccount'
import { ApiError } from '../../services/api/errors'
import { PASSWORD_MIN, changePassword } from '../../services/api/account'
import { fieldInput, fieldLabel } from './fields'
import { methodsText } from './labels'

export const AccountSettings: React.FC<{
  /** Open the change-password form (`/settings/password`). */
  passwordOpen?: boolean
  /** Desktop lists Delete account here; the phone has it alone on the list. */
  showDelete?: boolean
}> = ({ passwordOpen = false, showDelete = false }) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: providers } = useSignInMethods()
  const [open, setOpen] = useState(passwordOpen)
  const hasPassword = (providers ?? []).includes('email')

  return (
    <div data-testid="settings-account">
      <Group>
        <ListRow
          title="Email"
          sub={<span data-testid="account-email">{user?.email}</span>}
        />
        <ListRow
          title="Sign-in methods"
          sub={
            <span data-testid="account-signin-methods">
              {providers ? methodsText(providers) : '…'}
            </span>
          }
        />
        {hasPassword &&
          (open ? (
            <ChangePasswordForm
              email={user?.email ?? ''}
              onDone={() => setOpen(false)}
            />
          ) : (
            <ListRow
              title="Change password"
              sub="We'll ask for the current one first"
              trail={<ChevronRight size={18} />}
              onClick={() => setOpen(true)}
              data-testid="account-change-password"
            />
          ))}
        {showDelete && (
          <ListRow
            title={<span className="text-danger">Delete account…</span>}
            sub="Typed confirmation; transfer bands you own first"
            trail={<ChevronRight size={18} />}
            onClick={() => navigate('/settings/delete')}
            data-testid="delete-account-button"
          />
        )}
      </Group>
    </div>
  )
}

const PasswordField: React.FC<{
  id: string
  name: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  error?: string
  autoFocus?: boolean
}> = ({ id, name, label, value, onChange, autoComplete, error, autoFocus }) => {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          data-testid={`${id}-input`}
          className={`${fieldInput} pr-12 ${
            error ? 'shadow-[inset_0_0_0_1.5px_rgb(var(--danger-rgb))]' : ''
          }`}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-0 grid place-items-center w-11 h-11 text-ink-3"
          data-testid={`${id}-toggle`}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1.5 text-[13px] text-danger"
          data-testid={`${id}-error`}
        >
          {error}
        </p>
      )}
    </div>
  )
}

const ChangePasswordForm: React.FC<{ email: string; onDone: () => void }> = ({
  email,
  onDone,
}) => {
  const { showToast } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{
    field: 'current' | 'next'
    text: string
  }>()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    setBusy(true)
    try {
      await changePassword(email, current, next)
      showToast('Password changed', 'success')
      onDone()
    } catch (err) {
      const key = err instanceof ApiError ? err.key : 'unknown'
      setError({
        field: key === 'wrong_password' ? 'current' : 'next',
        text:
          err instanceof ApiError
            ? err.message
            : "That didn't work. Try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 p-4"
      data-testid="change-password-form"
    >
      <b className="text-[15px] font-semibold text-ink-1">Change password</b>
      <PasswordField
        id="change-password-current"
        name="currentPassword"
        label="Current password"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        error={error?.field === 'current' ? error.text : undefined}
        autoFocus
      />
      <PasswordField
        id="change-password-new"
        name="newPassword"
        label={`New password · at least ${PASSWORD_MIN} characters`}
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        error={error?.field === 'next' ? error.text : undefined}
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button
          variant="text"
          onClick={onDone}
          data-testid="change-password-cancel"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={busy || !current || next.length < PASSWORD_MIN}
          data-testid="change-password-save"
        >
          {busy ? 'Saving…' : 'Change password'}
        </Button>
      </div>
    </form>
  )
}
