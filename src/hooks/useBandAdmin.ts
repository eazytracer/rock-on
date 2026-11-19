/**
 * Band page, Band profile, create and join (docs/redesign/13 · 6b, 6c). Reads
 * the band row and its live invite code; every write is a bands RPC.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as bandsApi from '../services/api/bands'
import { queryKeys } from '../services/queryClient'

export function useBandRow(bandId: string) {
  return useQuery({
    queryKey: queryKeys.bands.row(bandId),
    queryFn: () => bandsApi.getBand(bandId),
    enabled: !!bandId,
  })
}

/** Owner / admins only; null for members (they can't read codes). */
export function useInviteCode(bandId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.bands.invite(bandId),
    queryFn: () => bandsApi.getActiveInviteCode(bandId),
    enabled: !!bandId && enabled,
  })
}

export function useBandPreview(code: string) {
  return useQuery({
    queryKey: queryKeys.bands.preview(code),
    queryFn: () => bandsApi.bandPreviewByCode(code),
    enabled: !!code,
    retry: false,
  })
}

/** Every band write changes some of: the row, the roster, codes, contexts. */
function useInvalidateBand() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['bands'] })
    qc.invalidateQueries({ queryKey: ['memberships'] })
    qc.invalidateQueries({ queryKey: ['contexts'] })
  }
}

export function useBandActions(bandId: string) {
  const invalidate = useInvalidateBand()
  const opts = { onSettled: invalidate }
  return {
    regenerate: useMutation({
      mutationFn: () => bandsApi.regenerateInviteCode(bandId),
      ...opts,
    }),
    setRole: useMutation({
      mutationFn: (v: { userId: string; role: 'admin' | 'member' }) =>
        bandsApi.setMemberRole(bandId, v.userId, v.role),
      ...opts,
    }),
    remove: useMutation({
      mutationFn: (userId: string) => bandsApi.removeMember(bandId, userId),
      ...opts,
    }),
    transfer: useMutation({
      mutationFn: (userId: string) =>
        bandsApi.transferOwnership(bandId, userId),
      ...opts,
    }),
    leave: useMutation({
      mutationFn: () => bandsApi.leaveBand(bandId),
      ...opts,
    }),
    deleteBand: useMutation({
      mutationFn: (confirmName: string) =>
        bandsApi.deleteBand(bandId, confirmName),
      ...opts,
    }),
    updateProfile: useMutation({
      mutationFn: (patch: Parameters<typeof bandsApi.updateBandProfile>[1]) =>
        bandsApi.updateBandProfile(bandId, patch),
      ...opts,
    }),
  }
}

export function useCreateBandRpc() {
  const invalidate = useInvalidateBand()
  return useMutation({
    mutationFn: async (v: {
      name: string
      mark: bandsApi.BandMark
      profile?: { city?: string; description?: string; genres?: string[] }
    }) => {
      const band = await bandsApi.createBand(v.name, v.mark)
      const p = v.profile
      if (p && (p.city || p.description || p.genres?.length)) {
        await bandsApi.updateBandProfile(band.id, p)
      }
      return band
    },
    onSettled: invalidate,
  })
}

export function useJoinBand() {
  const invalidate = useInvalidateBand()
  return useMutation({
    mutationFn: (code: string) => bandsApi.joinBand(code),
    onSettled: invalidate,
  })
}

/**
 * Switch to a band the user just made or joined. A full load re-reads their
 * bands and re-scopes every page, like the context switcher.
 */
export function enterBand(bandId: string, path: string) {
  localStorage.setItem('rockon.context', bandId)
  localStorage.setItem('currentBandId', bandId)
  window.location.assign(path)
}
