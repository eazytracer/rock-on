import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { search } from '../services/api/search'
import { queryKeys } from '../services/queryClient'

/** Live search, debounced; scoped to bandId (null = Personal) unless `all`. */
export function useSearch(query: string, bandId: string | null, all: boolean) {
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 150)
    return () => clearTimeout(t)
  }, [query])

  return useQuery({
    queryKey: queryKeys.search(debounced, bandId, all),
    queryFn: () => search(debounced, bandId, all),
    enabled: debounced.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}
