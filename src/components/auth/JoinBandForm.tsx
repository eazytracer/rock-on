import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { BandMembershipService } from '../../services/BandMembershipService'
import { BandService } from '../../services/BandService'
import { TouchButton } from '../common/TouchButton'
import { Band } from '../../models/Band'

interface JoinBandFormProps {
  onSuccess?: (bandId: string) => void
  onCancel?: () => void
}

export const JoinBandForm: React.FC<JoinBandFormProps> = ({ onSuccess, onCancel }) => {
  const { user } = useAuth()
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validatedBand, setValidatedBand] = useState<Band | null>(null)

  const handleValidateCode = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const validation = await BandMembershipService.validateInviteCode(inviteCode)

      if (!validation.valid) {
        setError(validation.error || 'Invalid invite code')
        setValidatedBand(null)
        return
      }

      // Get band details
      if (validation.inviteCode) {
        const band = await BandService.getBandById(validation.inviteCode.bandId)
        if (band) {
          setValidatedBand(band)
        } else {
          setError('Band not found')
        }
      }
    } catch (err) {
      console.error('Error validating code:', err)
      setError('Failed to validate invite code')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    console.log('[JoinBandForm] handleJoin called')
    console.log('[JoinBandForm] user:', user ? { id: user.id, email: user.email } : 'null')
    console.log('[JoinBandForm] inviteCode:', inviteCode)

    if (!user) {
      console.error('[JoinBandForm] No user - cannot join')
      setError('You must be logged in to join a band')
      return
    }

    if (!inviteCode.trim()) {
      console.error('[JoinBandForm] No invite code provided')
      setError('Please enter an invite code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('[JoinBandForm] Calling BandMembershipService.joinBandWithCode...')
      console.log('[JoinBandForm] Parameters:', { userId: user.id, code: inviteCode })

      const result = await BandMembershipService.joinBandWithCode(user.id, inviteCode)

      console.log('[JoinBandForm] Result received:', result)

      if (!result.success) {
        console.error('[JoinBandForm] Join failed:', result.error)
        setError(result.error || 'Failed to join band')
        return
      }

      console.log('[JoinBandForm] Join successful!', result.membership)
      if (result.membership) {
        onSuccess?.(result.membership.bandId)
      }
    } catch (err) {
      console.error('[JoinBandForm] Exception caught:', err)
      console.error('[JoinBandForm] Error type:', err?.constructor?.name)
      console.error('[JoinBandForm] Error message:', err instanceof Error ? err.message : 'Unknown error')
      console.error('[JoinBandForm] Error stack:', err instanceof Error ? err.stack : 'No stack trace')
      setError(err instanceof Error ? err.message : 'Failed to join band')
    } finally {
      console.log('[JoinBandForm] Cleaning up, setting loading to false')
      setLoading(false)
    }
  }

  const formatInviteCode = (value: string) => {
    // Remove any non-alphanumeric characters and convert to uppercase
    return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-steel-gray mb-2">Join a Band</h1>
        <p className="text-steel-gray/70">Enter the invite code to join your bandmates</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-amp-red/10 border border-amp-red rounded-lg">
          <p className="text-amp-red text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label htmlFor="inviteCode" className="block text-sm font-medium text-steel-gray mb-2">
            Invite Code
          </label>
          <input
            id="inviteCode"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(formatInviteCode(e.target.value))}
            className="w-full px-4 py-3 rounded-lg border border-steel-gray/30 bg-smoke-white text-steel-gray text-center text-2xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-energy-orange focus:border-transparent uppercase"
            placeholder="ABC123"
            disabled={loading}
            maxLength={6}
          />
          <p className="mt-2 text-xs text-steel-gray/60 text-center">
            Enter the 6-character code shared by your band leader
          </p>
        </div>

        {validatedBand && (
          <div className="bg-energy-orange/10 border border-energy-orange/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-10 h-10 text-energy-orange"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-steel-gray">{validatedBand.name}</h3>
                {validatedBand.description && (
                  <p className="text-sm text-steel-gray/70 mt-1">{validatedBand.description}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {onCancel && (
            <TouchButton
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </TouchButton>
          )}
          {!validatedBand ? (
            <TouchButton
              onClick={handleValidateCode}
              loading={loading}
              disabled={inviteCode.length !== 6}
              className="flex-1"
            >
              Validate Code
            </TouchButton>
          ) : (
            <TouchButton onClick={handleJoin} loading={loading} className="flex-1">
              Join Band
            </TouchButton>
          )}
        </div>
      </div>

      <div className="mt-8 p-4 bg-steel-gray/5 rounded-lg">
        <p className="text-xs text-steel-gray/70">
          <strong>Tip:</strong> Ask your band leader to share their invite code. You can also create
          your own band if you don't have an invite code yet.
        </p>
      </div>
    </div>
  )
}
