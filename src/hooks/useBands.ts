/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BandService } from '../services/BandService'
import { BandMembershipService } from '../services/BandMembershipService'
import { repository } from '../services/data/RepositoryFactory'
import { queryKeys, EMPTY_ARRAY } from '../services/queryClient'
import { getSupabaseClient } from '../services/supabase/client'
import type { Band } from '../models/Band'
import type {
  BandMembership,
  BandMembershipRow,
  InviteCode,
} from '../models/BandMembership'
import type { User, UserProfile } from '../models/User'
import { createLogger } from '../utils/logger'

const log = createLogger('useBands')

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

  const { data, error } = await supabase
    .from('bands')
    .insert(newBand as any)
    .select()
    .single()

  if (error) {
    log.error('createBandInSupabase: failed to create band:', error)
    throw new Error(`Failed to create band: ${error.message}`)
  }

  if (!data) {
    throw new Error('Band created but no data returned from Supabase')
  }

  const bandData = data as any

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
 * Helper: Wait for band membership to be created by the Supabase
 * auto_add_band_creator trigger. Queries Supabase directly (the source of truth).
 */
async function waitForMembership(
  bandId: string,
  userId: string,
  options = { timeout: 5000, interval: 500 }
): Promise<BandMembership> {
  const supabase = getSupabaseClient()
  const startTime = Date.now()

  while (Date.now() - startTime < options.timeout) {
    const { data, error } = await supabase
      .from('band_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('band_id', bandId)
      .single()

    if (data) {
      const row = data as BandMembershipRow
      return {
        id: row.id,
        userId: row.user_id,
        bandId: row.band_id,
        role: row.role,
        joinedDate: new Date(row.joined_date),
        status: row.status,
        permissions: row.permissions || [],
      }
    }

    // If error is not "not found", throw immediately
    if (error && error.code !== 'PGRST116') {
      log.error('waitForMembership: Supabase query error:', error)
      throw new Error(`Failed to query membership: ${error.message}`)
    }

    await new Promise(resolve => setTimeout(resolve, options.interval))
  }

  throw new Error(
    `Timeout waiting for band membership (${options.timeout}ms). ` +
      'The band was created successfully, but the membership was not created by the database trigger. ' +
      'Please contact support.'
  )
}

/**
 * Hook to fetch a band by ID.
 */
export function useBand(bandId: string) {
  const query = useQuery({
    queryKey: queryKeys.bands.detail(bandId),
    queryFn: async () => {
      const found = await BandService.getBandById(bandId)
      return found || null
    },
    enabled: !!bandId,
  })

  return {
    band: query.data ?? null,
    loading: query.isLoading,
    error: query.error as Error | null,
  }
}

/**
 * Hook to fetch band memberships for a band.
 */
export function useBandMemberships(bandId: string) {
  const query = useQuery({
    queryKey: queryKeys.memberships.band(bandId),
    queryFn: () => BandMembershipService.getBandMembers(bandId),
    enabled: !!bandId,
  })

  return {
    memberships: query.data ?? EMPTY_ARRAY,
    loading: query.isLoading,
    error: query.error as Error | null,
  }
}

/**
 * Hook to get band members with their profile info.
 * Fetches User + UserProfile from Supabase (cloud-first) so all band members
 * are visible with instruments/display info.
 */
export function useBandMembers(bandId: string) {
  const query = useQuery({
    queryKey: [...queryKeys.memberships.band(bandId), 'withProfiles'],
    queryFn: async () => {
      const memberships = await BandMembershipService.getBandMembers(bandId)
      return Promise.all(
        memberships.map(async membership => {
          const user = await repository.getUser(membership.userId)
          const profile = await repository.getUserProfile(membership.userId)
          return {
            membership,
            user: (user as User | null) || null,
            profile: (profile as UserProfile | null) || null,
          }
        })
      )
    },
    enabled: !!bandId,
  })

  return {
    members: query.data ?? EMPTY_ARRAY,
    loading: query.isLoading,
    error: query.error as Error | null,
  }
}

/**
 * Hook to get active invite codes for a band.
 */
export function useBandInviteCodes(bandId: string) {
  const query = useQuery({
    queryKey: [...queryKeys.bands.detail(bandId), 'inviteCodes'],
    queryFn: async () => {
      const codes = await BandMembershipService.getBandInviteCodes(bandId)
      return codes.filter(code => code.isActive === true)
    },
    enabled: !!bandId,
  })

  return {
    inviteCodes: (query.data ?? EMPTY_ARRAY) as InviteCode[],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: useCallback(async () => {
      await query.refetch()
    }, [query]),
  }
}

/**
 * Hook to create a band.
 *
 * Server-side creation: the band is created directly in Supabase and the
 * auto_add_band_creator trigger creates the owner membership atomically; we
 * poll Supabase until the membership exists before returning.
 */
export function useCreateBand() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      bandData,
      ownerId,
    }: {
      bandData: Partial<Band>
      ownerId: string
    }) => {
      const newBand = await createBandInSupabase({
        name: bandData.name || 'My Band',
        description: bandData.description || '',
        settings: bandData.settings,
      })

      // Wait for the trigger-created membership to exist in Supabase.
      await waitForMembership(newBand.id, ownerId, {
        timeout: 5000,
        interval: 500,
      })

      return newBand.id
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bands'] })
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
    },
  })

  return {
    createBand: (bandData: Partial<Band>, ownerId: string) =>
      mutation.mutateAsync({ bandData, ownerId }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to generate an invite code.
 */
export function useGenerateInviteCode() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      bandId,
      createdBy,
    }: {
      bandId: string
      createdBy: string
    }) => {
      const inviteCode = await BandMembershipService.createInviteCode({
        bandId,
        createdBy,
      })
      return inviteCode.code
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bands'] })
    },
  })

  return {
    generateCode: (bandId: string, createdBy: string) =>
      mutation.mutateAsync({ bandId, createdBy }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to remove a member from a band.
 */
export function useRemoveBandMember() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (membershipId: string) => {
      // Mark inactive through the service so the change reaches Supabase.
      await BandMembershipService.removeMember(membershipId)
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
    },
  })

  return {
    removeMember: (membershipId: string) => mutation.mutateAsync(membershipId),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to update a band membership role.
 */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      membershipId,
      role,
    }: {
      membershipId: string
      role: 'owner' | 'admin' | 'member'
    }) => {
      const dbRole: 'admin' | 'member' | 'viewer' =
        role === 'owner' || role === 'admin' ? 'admin' : 'member'
      await BandMembershipService.updateMembershipRole(membershipId, dbRole)
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
    },
  })

  return {
    updateRole: (membershipId: string, role: 'owner' | 'admin' | 'member') =>
      mutation.mutateAsync({ membershipId, role }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to update a band's information.
 */
export function useUpdateBand() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      bandId,
      updates,
    }: {
      bandId: string
      updates: {
        name?: string
        description?: string
        settings?: Record<string, any>
      }
    }) => {
      await BandService.updateBand(bandId, updates)
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bands'] })
    },
  })

  return {
    updateBand: (
      bandId: string,
      updates: {
        name?: string
        description?: string
        settings?: Record<string, any>
      }
    ) => mutation.mutateAsync({ bandId, updates }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}
