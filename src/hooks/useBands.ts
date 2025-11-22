import { useState, useEffect } from 'react'
import { db } from '../services/database'
import { BandService } from '../services/BandService'
import { BandMembershipService } from '../services/BandMembershipService'
import { getSyncRepository } from '../services/data/SyncRepository'
import { getSupabaseClient } from '../services/supabase/client'
import type { Band } from '../models/Band'
import type {
  BandMembership,
  BandMembershipRow,
  InviteCode,
} from '../models/BandMembership'
import type { User, UserProfile } from '../models/User'

/**
 * Helper: Create band directly in Supabase (server-side creation)
 * This ensures the auto_add_band_creator trigger creates the membership atomically
 *
 * NOTE: The trigger uses auth.uid() to determine creator, so we don't set created_by
 */
async function createBandInSupabase(bandInput: {
  name: string
  description?: string
  settings?: Record<string, any>
}): Promise<Band> {
  const supabase = getSupabaseClient()

  const newBand = {
    id: crypto.randomUUID(),
    name: bandInput.name,
    description: bandInput.description || '',
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    settings: bandInput.settings || {},
  }

  // Use 'as any' to bypass TypeScript's overly strict Supabase types
  const { data, error } = await supabase
    .from('bands')
    .insert(newBand as any)
    .select()
    .single()

  if (error) {
    console.error('[createBandInSupabase] Failed to create band:', error)
    throw new Error(`Failed to create band: ${error.message}`)
  }

  if (!data) {
    throw new Error('Band created but no data returned from Supabase')
  }

  // Cast to any to work around TypeScript's overly strict types
  const bandData = data as any

  // Convert snake_case to camelCase for application use
  return {
    id: bandData.id,
    name: bandData.name,
    description: bandData.description || '',
    createdDate: new Date(bandData.created_date),
    memberIds: [], // Not stored in bands table anymore (use band_memberships)
    settings: bandData.settings || {},
  }
}

/**
 * Helper: Wait for band membership to be created by Supabase trigger
 * Queries Supabase directly (not IndexedDB) to avoid sync race conditions
 */
async function waitForMembership(
  bandId: string,
  userId: string,
  options = { timeout: 5000, interval: 500 }
): Promise<BandMembership> {
  const supabase = getSupabaseClient()
  const startTime = Date.now()

  while (Date.now() - startTime < options.timeout) {
    // Query Supabase directly for the membership (source of truth)
    const { data, error } = await supabase
      .from('band_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('band_id', bandId)
      .single()

    if (data) {
      console.log('[waitForMembership] Membership found in Supabase:', data)

      // Type the Supabase row data properly
      const row = data as BandMembershipRow

      // Convert snake_case to camelCase for application use
      const membership: BandMembership = {
        id: row.id,
        userId: row.user_id,
        bandId: row.band_id,
        role: row.role,
        joinedDate: new Date(row.joined_date),
        status: row.status,
        permissions: row.permissions || [],
      }

      // Add to IndexedDB for caching (fire and forget)
      db.bandMemberships.put(membership).catch(err => {
        console.warn(
          '[waitForMembership] Failed to cache membership in IndexedDB:',
          err
        )
      })

      return membership
    }

    // If error is not "not found", throw immediately
    if (error && error.code !== 'PGRST116') {
      console.error('[waitForMembership] Supabase query error:', error)
      throw new Error(`Failed to query membership: ${error.message}`)
    }

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, options.interval))
  }

  throw new Error(
    `Timeout waiting for band membership (${options.timeout}ms). ` +
      'The band was created successfully, but the membership was not created by the database trigger. ' +
      'Please contact support.'
  )
}

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
        const bandMemberships =
          await BandMembershipService.getBandMembers(bandId)
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
 * Fetches User data from Supabase (cloud-first) to ensure all band members are visible
 */
export function useBandMembers(bandId: string) {
  const [members, setMembers] = useState<
    Array<{
      membership: BandMembership
      user: User | null
      profile: UserProfile | null
    }>
  >([])
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

        // Get repository for cloud-first queries
        const repo = getSyncRepository()

        // Get memberships via service (already cloud-first)
        const memberships = await BandMembershipService.getBandMembers(bandId)

        // Get user and profile data for each member (cloud-first to see all band members)
        const membersWithData = await Promise.all(
          memberships.map(async membership => {
            // Cloud-first: Get user from Supabase so User 2 can see User 1's data
            const user = await repo.getUser(membership.userId)

            // Also try to get profile (instruments, etc.) - still local for now
            const profile = await db.userProfiles
              .where('userId')
              .equals(membership.userId)
              .first()

            return {
              membership,
              user: user || null,
              profile: profile || null,
            }
          })
        )

        setMembers(membersWithData)
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

  const fetchInviteCodes = async () => {
    if (!bandId) {
      setInviteCodes([])
      setLoading(false)
      return
    }

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

  useEffect(() => {
    fetchInviteCodes()

    // Listen for sync events to refetch data
    const repo = getSyncRepository()
    repo.on('changed', fetchInviteCodes)

    return () => {
      repo.off('changed', fetchInviteCodes)
    }
  }, [bandId])

  return { inviteCodes, loading, error, refetch: fetchInviteCodes }
}

/**
 * Hook to create a band
 *
 * IMPORTANT: Uses server-side creation pattern to prevent duplicate memberships
 * - Creates band directly in Supabase (not IndexedDB)
 * - auto_add_band_creator trigger creates membership atomically
 * - Polls until membership syncs to IndexedDB
 * - No manual membership creation (prevents duplicates)
 */
export function useCreateBand() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createBand = async (bandData: Partial<Band>, ownerId: string) => {
    try {
      setLoading(true)
      setError(null)

      console.log('[useCreateBand] Creating band in Supabase:', bandData.name)

      // Step 1: Create band directly in Supabase
      // This triggers auto_add_band_creator which creates the membership
      // The trigger uses auth.uid() to determine the creator automatically
      const newBand = await createBandInSupabase({
        name: bandData.name || 'My Band',
        description: bandData.description || '',
        settings: bandData.settings,
      })

      console.log('[useCreateBand] Band created in Supabase:', newBand.id)

      // Step 2: Add band to IndexedDB immediately (don't wait for sync)
      await db.bands.add({
        id: newBand.id,
        name: newBand.name,
        description: newBand.description,
        createdDate: newBand.createdDate,
        memberIds: newBand.memberIds,
        settings: newBand.settings,
      })

      console.log('[useCreateBand] Band added to IndexedDB')

      // Step 3: Wait for trigger to create membership and sync to IndexedDB
      // The auto_add_band_creator trigger creates the membership in Supabase
      // We poll until the sync engine pulls it to IndexedDB
      console.log('[useCreateBand] Waiting for membership to sync...')
      await waitForMembership(newBand.id, ownerId, {
        timeout: 5000,
        interval: 500,
      })

      console.log('[useCreateBand] Membership synced successfully')

      return newBand.id
    } catch (err) {
      console.error('[useCreateBand] Error creating band:', err)
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
        createdBy,
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

  const updateRole = async (
    membershipId: string,
    role: 'owner' | 'admin' | 'member'
  ) => {
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

  const updateBand = async (
    bandId: string,
    updates: {
      name?: string
      description?: string
      settings?: Record<string, any>
    }
  ) => {
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
