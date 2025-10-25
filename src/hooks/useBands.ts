import { useState, useEffect } from 'react'
import { db } from '../services/database'
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
        const foundBand = await db.bands.get(bandId)
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
        const bandMemberships = await db.bandMemberships
          .where('bandId')
          .equals(bandId)
          .toArray()

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

        // Get memberships
        const memberships = await db.bandMemberships
          .where('bandId')
          .equals(bandId)
          .toArray()

        // Get profiles for each member
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
        const codes = await db.inviteCodes
          .where('bandId')
          .equals(bandId)
          .and(code => code.isActive === true)
          .toArray()

        setInviteCodes(codes)
        setError(null)
      } catch (err) {
        console.error('Error fetching invite codes:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchInviteCodes()
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

      const bandId = crypto.randomUUID()
      const newBand: Band = {
        id: bandId,
        name: bandData.name || 'My Band',
        description: bandData.description || '',
        createdDate: new Date(),
        memberIds: [ownerId],
        settings: {
          defaultPracticeTime: 120,
          reminderMinutes: [60, 30, 10],
          autoSaveInterval: 30
        },
        ...bandData
      }

      await db.bands.add(newBand)

      // Add owner membership (role is 'admin' but permissions include 'owner')
      await db.bandMemberships.add({
        id: crypto.randomUUID(),
        userId: ownerId,
        bandId,
        role: 'admin',
        joinedDate: new Date(),
        status: 'active',
        permissions: ['owner', 'admin']
      })

      return bandId
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

      // Generate a random 8-character code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase()

      const inviteCode: InviteCode = {
        id: crypto.randomUUID(),
        bandId,
        code,
        createdBy,
        createdDate: new Date(),
        currentUses: 0,
        isActive: true
      }

      await db.inviteCodes.add(inviteCode)

      return code
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

      await db.bandMemberships.delete(membershipId)

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

      // Map UI role to database role and permissions
      let dbRole: 'admin' | 'member' | 'viewer'
      let permissions: string[]

      if (role === 'owner') {
        dbRole = 'admin'
        permissions = ['owner', 'admin']
      } else if (role === 'admin') {
        dbRole = 'admin'
        permissions = ['admin']
      } else {
        dbRole = 'member'
        permissions = ['member']
      }

      await db.bandMemberships.update(membershipId, { role: dbRole, permissions })

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
