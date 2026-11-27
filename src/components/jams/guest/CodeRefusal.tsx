/**
 * What `/j/:code` says when a code can't be used. Neutral on purpose: a bad
 * code, an unknown one and a near miss read the same, and an invite-only jam
 * names nothing.
 */
import React from 'react'
import { Link2Off, Lock } from 'lucide-react'
import { Button, Empty, RetryCard } from '../../ui'
import { ApiError, errorText } from '../../../services/api/errors'
import { INVALID_CODE, INVITE_ONLY, isRefusal } from './helpers'

export const CodeRefusal: React.FC<{
  error: unknown
  onRetry?: () => void
  onEnterCode?: () => void
}> = ({ error, onRetry, onEnterCode }) => {
  if (error instanceof ApiError && error.key === 'invite_only') {
    return (
      <Empty
        icon={<Lock size={26} />}
        title={INVITE_ONLY}
        why="Ask the host to invite you."
        data-testid="jam-code-invite-only"
      />
    )
  }
  if (!error || isRefusal(error)) {
    return (
      <Empty
        icon={<Link2Off size={26} />}
        title={INVALID_CODE}
        why="Check the letters, or ask whoever sent it."
        action={
          onEnterCode && (
            <Button
              variant="primary"
              onClick={onEnterCode}
              data-testid="jam-code-enter"
            >
              Enter a code
            </Button>
          )
        }
        data-testid="jam-code-invalid"
      />
    )
  }
  return <RetryCard message={errorText(error)} onRetry={() => onRetry?.()} />
}
