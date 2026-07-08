import { useEffect, useRef } from 'react'
import { getSupabaseClient } from '../services/supabase/client'

/**
 * Monotonic id so every hook instance gets its own channel topic. Multiple
 * subscribers to the same table+value (e.g. one SongCastPanel per lineup song)
 * would otherwise share a channel name and clobber each other.
 */
let channelSeq = 0

/**
 * Subscribe to Supabase realtime changes on a single table, filtered to one
 * column value, and fire `onChange` whenever a matching row is inserted,
 * updated, or deleted. Used by the event hooks so hosts/guests see hands,
 * casts, and participants update live instead of only on remount.
 *
 * The callback is held in a ref so passing a fresh closure each render doesn't
 * tear down and rebuild the channel — the subscription only re-subscribes when
 * the table or filter value actually changes.
 */
export function useRealtimeTable(
  table: string,
  filterColumn: string,
  filterValue: string | undefined,
  onChange: () => void
) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // Stable, unique topic for this hook instance (assigned once).
  const idRef = useRef<number>()
  if (idRef.current === undefined) idRef.current = channelSeq++

  useEffect(() => {
    if (!filterValue) return
    const supabase = getSupabaseClient()
    if (!supabase) return

    const channel = supabase
      .channel(`rt:${table}:${filterValue}:${idRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        () => onChangeRef.current()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [table, filterColumn, filterValue])
}
