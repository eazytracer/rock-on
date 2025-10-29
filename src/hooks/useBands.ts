import { useState, useEffect } from 'react'
import { db } from '../services/database'
import { BandService } from '../services/BandService'
import { BandMembershipService } from '../services/BandMembershipService'
import { getSyncRepository } from '../services/data/SyncRepository'
import type { Band } from '../models/Band'
import type { BandMembership, InviteCode } from '../models/BandMembership'
import type { UserProfile } from '../models/User'

/**
 * Hook to fetch a band by ID
 */
export function useBand(bandId: string) {
  const [band, setBand] = useState<Band | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!bandId) {
      setBand(null)
      setLoading(false)
      return
    }

    const fetchBand = async () => {
      try {
        setLoading(true)
        const foundBand = await BandService.getBandById(bandId)
        setBand(foundBand || null)
        setError(null)
      } catch (err) {
        console.error('Error fetching band:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchBand()

    // Listen for sync events to refetch data
    const repo = getSyncRepository()
    repo.on('changed', fetchBand)

    return () => {
      repo.off('changed', fetchBand)
    }
  }, [bandId])

  return { band, loading, error }
}

/**
 * Hook to fetch band memberships for a band
 */
export function useBandMemberships(bandId: string) {
  const [memberships, setMemberships] = useState<BandMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!bandId) {
      setMemberships([])
      setLoading(false)
      return
    }

    const fetchMemberships = async () => {
      try {
        setLoading(true)
        const bandMemberships = await BandMembershipService.getBandMembers(bandId)
        setMemberships(bandMemberships)
        setError(null)
      } catch (err) {
        console.error('Error fetching memberships:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchMemberships()

    // Listen for sync events to refetch data
    const repo = getSyncRepository()
    repo.on('changed', fetchMemberships)

    return () => {
      repo.off('changed', fetchMemberships)
    }
  }, [bandId])

  return { memberships, loading, error }
}

/**
 * Hook to get band members with their profile info
 */
export function useBandMembers(bandId: string) {
  const [members, setMembers] = useState<Array<{
    membership: BandMembership
    profile: UserProfile | null
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!bandId) {
      setMembers([])
      setLoading(false)
      return
    }

    const fetchMembers = async () => {
      try {
        setLoading(true)

        // Get memberships via service
        const memberships = await BandMembershipService.getBandMembers(bandId)

        // Get profiles for each member (still using db directly as there's no UserService yet)
        const membersWithProfiles = await Promise.all(
          memberships.map(async (membership) => {
            const profile = await db.userProfiles
              .where('userId')
              .equals(membership.userId)
              .first()

            return {
              membership,
              profile: profile || null
            }
          })
        )

        setMembers(membersWithProfiles)
        setError(null)
      } catch (err) {
        console.error('Error fetching band members:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchMembers()

    // Listen for sync events to refetch data
    const repo = getSyncRepository()
    repo.on('changed', fetchMembers)

    return () => {
      repo.off('changed', fetchMembers)
    }
  }, [bandId])

  return { members, loading, error }
}

/**
 * Hook to get active invite codes for a band
 */
export function useBandInviteCodes(bandId: string) {
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!bandId) {
      setInviteCodes([])
      setLoading(false)
      return
    }

    const fetchInviteCodes = async () => {
      try {
        setLoading(true)
        const codes = await BandMembershipService.getBandInviteCodes(bandId)
        // Filter for active codes only (client-side filtering)
        const activeCodes = codes.filter(code => code.isActive === true)
        setInviteCodes(activeCodes)
        setError(null)
      } catch (err) {
        console.error('Error fetching invite codes:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchInviteCodes()

    // Listen for sync events to refetch data
    const repo = getSyncRepository()
    repo.on('changed', fetchInviteCodes)

    return () => {
      repo.off('changed', fetchInviteCodes)
    }
  }, [bandId])

  return { inviteCodes, loading, error }
}

/**
 * Hook to create a band
 */
export function useCreateBand() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createBand = async (bandData: Partial<Band>, ownerId: string) => {
    try {
      setLoading(true)
      setError(null)

      // Create band via service
      const newBand = await BandService.createBand({
        name: bandData.name || 'My Band',
        description: bandData.description || '',
        settings: bandData.settings
      })

      // Add owner membership
      await BandMembershipService.getUserBands(ownerId) // Ensure user context exists

      // Create owner membership (role is 'admin' but permissions include 'owner')
      const membership: BandMembership = {
        id: crypto.randomUUID(),
        userId: ownerId,
        bandId: newBand.id,
        role: 'admin',
        joinedDate: new Date(),
        status: 'active',
        permissions: ['owner', 'admin']
      }

      // Note: BandMembershipService doesn't expose addMembership directly yet
      // For now, we'll use the repository directly for this operation
      await db.bandMemberships.add(membership)

      return newBand.id
    } catch (err) {
      console.error('Error creating band:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { createBand, loading, error }
}

/**
 * Hook to generate an invite code
 */
export function useGenerateInviteCode() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generateCode = async (bandId: string, createdBy: string) => {
    try {
      setLoading(true)
      setError(null)

      // Create invite code via service
      const inviteCode = await BandMembershipService.createInviteCode({
        bandId,
        createdBy
      })

      return inviteCode.code
    } catch (err) {
      console.error('Error generating invite code:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { generateCode, loading, error }
}

/**
 * Hook to remove a member from a band
 */
export function useRemoveBandMember() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const removeMember = async (membershipId: string) => {
    try {
      setLoading(true)
      setError(null)

      // Note: BandMembershipService uses updateMembershipRole for status changes
      // We should update status to 'inactive' rather than delete
      // This preserves history and is better practice
      // For now, we'll use db.bandMemberships directly as the service doesn't expose this
      await db.bandMemberships.update(membershipId, { status: 'inactive' })

      return true
    } catch (err) {
      console.error('Error removing band member:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { removeMember, loading, error }
}

/**
 * Hook to update a band membership role
 */
export function useUpdateMemberRole() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateRole = async (membershipId: string, role: 'owner' | 'admin' | 'member') => {
    try {
      setLoading(true)
      setError(null)

      // Map UI role to database role
      let dbRole: 'admin' | 'member' | 'viewer'

      if (role === 'owner' || role === 'admin') {
        dbRole = 'admin'
      } else {
        dbRole = 'member'
      }

      // Update role via service
      await BandMembershipService.updateMembershipRole(membershipId, dbRole)

      return true
    } catch (err) {
      console.error('Error updating member role:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { updateRole, loading, error }
}

/**
 * Hook to update a band's information
 */
export function useUpdateBand() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateBand = async (bandId: string, updates: { name?: string; description?: string; settings?: Record<string, any> }) => {
    try {
      setLoading(true)
      setError(null)

      // Update band via service
      await BandService.updateBand(bandId, updates)

      return true
    } catch (err) {
      console.error('Error updating band:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { updateBand, loading, error }
}
