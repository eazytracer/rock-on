/**
 * Seed for the calendar, show and practice specs: a signed-up user in a new
 * band with three songs (Black and Breed in Standard, Everlong in Drop D, so
 * Black → Everlong is a retune), "Fall Set" (Black, Everlong), a show at The
 * Crocodile five days out and a practice ("Thursday run") of all three songs
 * two days out.
 */
import type { Page } from '@playwright/test'
import { createTestUser, signUpViaUI, getCurrentUserId } from '../fixtures/auth'
import { createBandViaUI } from '../fixtures/bands'
import { getSupabaseAdmin } from '../fixtures/supabase'

export type CalendarSeed = {
  userId: string
  bandId: string
  fall: string
  show: string
  practice: string
  songs: Record<string, string>
}

/** Local noon/evening N days out (dates stay on the same day in any timezone). */
export const daysOut = (n: number, hour = 19) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(hour, 0, 0, 0)
  return d
}

export async function seedCalendar(page: Page): Promise<CalendarSeed> {
  await signUpViaUI(page, createTestUser())
  await createBandViaUI(page, `Calendar ${Date.now()}`)
  const userId = await getCurrentUserId(page)
  const admin = await getSupabaseAdmin()
  const { data: m } = await admin
    .from('band_memberships')
    .select('band_id')
    .eq('user_id', userId)
    .single()
  const bandId = m!.band_id as string
  const { data: rows } = await admin
    .from('songs')
    .insert(
      (
        [
          ['Black', 'Standard', 343, 'Count in **slow**'],
          ['Everlong', 'Drop D', 250, null],
          ['Breed', 'Standard', 184, null],
        ] as const
      ).map(([title, guitar_tuning, duration, notes]) => ({
        title,
        artist: 'Test',
        guitar_tuning,
        duration,
        notes,
        context_type: 'band',
        context_id: bandId,
        created_by: userId,
      }))
    )
    .select('id, title')
  const songs = Object.fromEntries(rows!.map(r => [r.title, r.id as string]))
  const { data: set } = await admin
    .from('setlists')
    .insert({
      name: 'Fall Set',
      band_id: bandId,
      context_type: 'band',
      context_id: bandId,
      created_by: userId,
      items: [songs.Black, songs.Everlong].map((songId, i) => ({
        id: `i${i}`,
        type: 'song',
        position: i + 1,
        songId,
      })),
    })
    .select('id')
    .single()
  const { data: show } = await admin
    .from('shows')
    .insert({
      name: 'Next Gig',
      venue: 'The Crocodile',
      band_id: bandId,
      duration: 45,
      scheduled_date: daysOut(5, 20).toISOString(),
      created_by: userId,
    })
    .select('id')
    .single()
  const { data: practice } = await admin
    .from('practice_sessions')
    .insert({
      name: 'Thursday run',
      band_id: bandId,
      scheduled_date: daysOut(2).toISOString(),
      duration: 120,
      location: "Mike's Garage",
      type: 'rehearsal',
      songs: [songs.Black, songs.Everlong, songs.Breed].map(songId => ({
        songId,
        timeSpent: 0,
        status: 'not-started',
        sectionsWorked: [],
        improvements: [],
        needsWork: [],
        memberRatings: [],
      })),
    })
    .select('id')
    .single()
  return {
    userId,
    bandId,
    fall: set!.id as string,
    show: show!.id as string,
    practice: practice!.id as string,
    songs,
  }
}

/**
 * Gives a seeded show its own copy of a setlist (as `attach_set_to_show` does):
 * a setlists row with show_id, source_setlist_id and copied_at, and the show
 * pointing at it. The setlists index finds a set's show through its copies.
 */
export async function attachShowCopy(showId: string, setlistId: string) {
  const admin = await getSupabaseAdmin()
  const { data: src } = await admin
    .from('setlists')
    .select('*')
    .eq('id', setlistId)
    .single()
  const { data: copy } = await admin
    .from('setlists')
    .insert({
      name: src!.name,
      band_id: src!.band_id,
      context_type: src!.context_type,
      context_id: src!.context_id,
      created_by: src!.created_by,
      items: src!.items,
      notes: src!.notes,
      show_id: showId,
      source_setlist_id: setlistId,
      copied_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  await admin.from('shows').update({ setlist_id: copy!.id }).eq('id', showId)
  return copy!.id as string
}
