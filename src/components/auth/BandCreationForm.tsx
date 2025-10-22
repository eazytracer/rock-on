import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { BandService } from '../../services/BandService'
import { BandMembershipService } from '../../services/BandMembershipService'
import { TouchButton } from '../common/TouchButton'
import { InviteCode } from '../../models/BandMembership'
import { db } from '../../services/database'

interface BandCreationFormProps {
  onSuccess?: (bandId: string) => void
  onCancel?: () => void
}

export const BandCreationForm: React.FC<BandCreationFormProps> = ({ onSuccess, onCancel }) => {
  const { user } = useAuth()
  const [bandName, setBandName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdBand, setCreatedBand] = useState<{
    bandId: string
    inviteCode: InviteCode
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!bandName.trim()) {
      setError('Band name is required')
      return
    }

    if (!user) {
      setError('You must be logged in to create a band')
      return
    }

    setLoading(true)
    try {
      // Create the band
      const band = await BandService.createBand({
        name: bandName,
        description: description || undefined
      })

      // Create admin membership for the creator directly
      await db.bandMemberships.add({
        id: crypto.randomUUID(),
        userId: user.id,
        bandId: band.id,
        role: 'admin',
        joinedDate: new Date(),
        status: 'active',
        permissions: ['admin', 'member']
      })

      // Create an invite code for others to join
      const inviteCode = await BandMembershipService.createInviteCode({
        bandId: band.id,
        createdBy: user.id,
        maxUses: 10,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      })

      setCreatedBand({ bandId: band.id, inviteCode })
    } catch (err) {
      console.error('Error creating band:', err)
      setError(err instanceof Error ? err.message : 'Failed to create band')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = () => {
    if (createdBand) {
      navigator.clipboard.writeText(createdBand.inviteCode.code)
      alert('Invite code copied to clipboard!')
    }
  }

  const handleDone = () => {
    if (createdBand) {
      onSuccess?.(createdBand.bandId)
    }
  }

  if (createdBand) {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-energy-orange/10 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-energy-orange"
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
          <h2 className="text-2xl font-bold text-steel-gray mb-2">Band Created!</h2>
          <p className="text-steel-gray/70">Share this code with your bandmates to invite them</p>
        </div>

        <div className="bg-steel-gray/5 rounded-lg p-6 mb-6">
          <p className="text-xs text-steel-gray/70 mb-2 text-center">Invite Code</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-energy-orange tracking-wider">
              {createdBand.inviteCode.code}
            </span>
          </div>
          <p className="text-xs text-steel-gray/60 mt-3 text-center">
            Expires in 30 days • {createdBand.inviteCode.maxUses} uses available
          </p>
        </div>

        <div className="space-y-3">
          <TouchButton variant="secondary" fullWidth onClick={handleCopyCode}>
            Copy Invite Code
          </TouchButton>
          <TouchButton fullWidth onClick={handleDone}>
            Done
          </TouchButton>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-steel-gray mb-2">Create a Band</h1>
        <p className="text-steel-gray/70">Start your musical journey together</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-amp-red/10 border border-amp-red rounded-lg">
          <p className="text-amp-red text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="bandName" className="block text-sm font-medium text-steel-gray mb-2">
            Band Name
          </label>
          <input
            id="bandName"
            type="text"
            value={bandName}
            onChange={(e) => setBandName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-steel-gray/30 bg-smoke-white text-steel-gray focus:outline-none focus:ring-2 focus:ring-energy-orange focus:border-transparent"
            placeholder="The Rock Stars"
            disabled={loading}
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-steel-gray mb-2">
            Description (Optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-steel-gray/30 bg-smoke-white text-steel-gray focus:outline-none focus:ring-2 focus:ring-energy-orange focus:border-transparent resize-none"
            placeholder="Tell us about your band..."
            rows={3}
            disabled={loading}
            maxLength={500}
          />
          <p className="mt-1 text-xs text-steel-gray/60 text-right">
            {description.length}/500 characters
          </p>
        </div>

        <div className="flex gap-3 pt-4">
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
          <TouchButton type="submit" loading={loading} className="flex-1">
            Create Band
          </TouchButton>
        </div>
      </form>
    </div>
  )
}
