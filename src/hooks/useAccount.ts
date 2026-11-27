/**
 * Settings data (docs/redesign/13 · 6e): your profile, sign-in methods, the
 * metronome click sound and push preferences. Saves are optimistic; a failed
 * save rolls back and rethrows so the screen can toast it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../services/queryClient'
import {
  getMyProfile,
  getSignInMethods,
  saveMyProfile,
  type MyProfile,
} from '../services/api/account'
import {
  METRONOME_PREF_DEFAULTS,
  getMetronomePrefs,
  getPushPrefs,
  pushPrefDefaults,
  setMetronomePrefs,
  setPushPrefs,
  type MetronomePrefs,
  type PushPrefs,
} from '../services/api/preferences'

function useOptimisticSave<T>(
  key: readonly unknown[],
  save: (changes: Partial<T>) => Promise<void>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: save,
    onMutate: async (changes: Partial<T>) => {
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<T>(key)
      if (prev) queryClient.setQueryData<T>(key, { ...prev, ...changes })
      return { prev }
    },
    onError: (_err, _changes, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useMyProfile() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const key = queryKeys.myProfile(userId)
  const query = useQuery({
    queryKey: key,
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  })
  const save = useOptimisticSave<MyProfile>(key, changes =>
    saveMyProfile(userId, changes)
  )
  return { ...query, save: save.mutateAsync, saving: save.isPending }
}

export function useSignInMethods() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.signInMethods(user?.id ?? ''),
    queryFn: getSignInMethods,
    enabled: !!user,
  })
}

/** The click sound the metronome plays. Beep until loaded or when signed out. */
export function useMetronomePrefs() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const key = queryKeys.metronomePrefs(userId)
  const query = useQuery({
    queryKey: key,
    queryFn: () => getMetronomePrefs(userId),
    enabled: !!userId,
    staleTime: 60_000,
  })
  const save = useOptimisticSave<MetronomePrefs>(key, changes =>
    setMetronomePrefs(userId, changes)
  )
  return {
    prefs: query.data ?? METRONOME_PREF_DEFAULTS,
    loaded: query.isFetched,
    save: save.mutateAsync,
  }
}

export function usePushPrefs() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const key = queryKeys.pushPrefs(userId)
  const query = useQuery({
    queryKey: key,
    queryFn: () => getPushPrefs(userId),
    enabled: !!userId,
  })
  const save = useOptimisticSave<PushPrefs>(key, changes =>
    setPushPrefs(userId, changes)
  )
  return {
    prefs: query.data ?? pushPrefDefaults(),
    loaded: query.isFetched,
    save: save.mutateAsync,
  }
}
