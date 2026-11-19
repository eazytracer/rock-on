import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BandService } from '../services/BandService'
import { BandMembershipService } from '../services/BandMembershipService'
import { repository } from '../services/data/RepositoryFactory'
import { queryKeys, EMPTY_ARRAY } from '../services/queryClient'
import * as bandsApi from '../services/api/bands'
import type { Band } from '../models/Band'

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
 * One embedded query returns each active membership with its User + UserProfile,
 * so all band members are visible with instruments/display info.
 */
export function useBandMembers(bandId: string) {
  const query = useQuery({
    queryKey: [...queryKeys.memberships.band(bandId), 'withProfiles'],
    queryFn: () => repository.getBandMembersWithProfiles(bandId),
    enabled: !!bandId,
  })

  return {
    members: query.data ?? EMPTY_ARRAY,
    loading: query.isLoading,
    error: query.error as Error | null,
  }
}

/**
 * Hook to create a band. create_band makes the band, the caller's owner
 * membership and a fresh invite code in one server call.
 */
export function useCreateBand() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({ bandData }: { bandData: Partial<Band> }) => {
      const band = await bandsApi.createBand(bandData.name || 'My Band')
      if (bandData.description) {
        await bandsApi.updateBandProfile(band.id, {
          description: bandData.description,
        })
      }
      return band.id
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bands'] })
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
    },
  })

  return {
    createBand: (bandData: Partial<Band>, _ownerId: string) =>
      mutation.mutateAsync({ bandData }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}
