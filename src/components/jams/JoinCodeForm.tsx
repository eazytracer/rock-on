/**
 * Join with a code: a code field that opens `/j/CODE`, where the code is
 * looked up and the preview-first join takes over.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode } from 'lucide-react'
import { Button } from '../ui'
import { formatCode, normalizeCode } from '../../hooks/useJam'

export const JoinCodeForm: React.FC<{ autoFocus?: boolean }> = ({
  autoFocus,
}) => {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const c = normalizeCode(code)
  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (c) navigate(`/j/${c}`)
      }}
      className="flex items-center gap-2"
      data-testid="jam-join-form"
    >
      <label
        htmlFor="jam-join-code"
        className="flex-1 min-w-0 flex items-center gap-2.5 h-12 px-4 rounded-full bg-bg-3"
      >
        <QrCode size={18} className="text-ink-3 shrink-0" />
        <input
          id="jam-join-code"
          name="jamJoinCode"
          data-testid="jam-join-input"
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          value={code}
          maxLength={12}
          onChange={e => setCode(formatCode(e.target.value))}
          placeholder="ABCD-EFGH"
          aria-label="Jam code"
          className="flex-1 min-w-0 bg-transparent font-mono text-[16px] tracking-[.12em] uppercase text-ink-1 outline-none placeholder:text-ink-4"
        />
      </label>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={!c}
        data-testid="jam-join-button"
      >
        Join
      </Button>
    </form>
  )
}
