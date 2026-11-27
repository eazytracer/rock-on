/**
 * Jams (Phase 7). One thin wrapper per RPC; the contract, every return shape
 * and error key is the header of
 * supabase/migrations/20261121120000_redesign_phase_7.sql. Errors arrive as
 * ApiError keys (`forbidden`, `not_found`, `stale_version`, `no_jam`,
 * `invite_only`, `jam_ended`, `not_taking_people`, `rate_limited`, …).
 *
 * `guestToken` is a web guest's or the kiosk's token; leave it out when signed
 * in. Live updates: listen to the realtime broadcast topic `jam:<short_code>`
 * (event `changed` → refetch jamState; event `nudge` from askTheRoom).
 */
import { api } from './client'
import { ApiError, toApiError } from './errors'
import type { Database, Json } from '../../types/database.types'

type Fns = Database['public']['Functions']
type Tables = Database['public']['Tables']
export type JamRow = Tables['events']['Row']
export type JamParticipantRow = Tables['event_participants']['Row']
export type JamItemRow = Tables['event_lineup_items']['Row']
export type JamHandRow = Tables['event_hands']['Row']
export type SetlistRow = Tables['setlists']['Row']
export type MyJam = Fns['list_my_jams']['Returns'][number]
export type JamPreview = Omit<
  Fns['jam_preview_by_code']['Returns'][number],
  'error' | 'hint'
>
export type SongOverlap = Fns['who_knows_your_songs']['Returns'][number]

export type PartKey = 'vox' | 'guitar' | 'bass' | 'drums' | 'keys' | 'other'
/** A part: a key plus an optional label (custom parts are `other` + label). */
export interface Part {
  key: PartKey
  label?: string
}
/** Inputs also accept a plain key. */
export type PartInput = Part | PartKey
export type WhoCanJoin = 'invite' | 'friends' | 'code'
export type ItemState =
  | 'pending'
  | 'open'
  | 'queued'
  | 'stage'
  | 'played'
  | 'left'
  | 'removed'

/** jam_state(): one read for every jam screen. */
export interface JamState {
  viewer: 'app' | 'guest' | 'kiosk'
  jam: {
    id: string
    name: string
    status: 'scheduled' | 'confirmed' | 'live' | 'completed' | 'cancelled'
    scheduled_date: string
    end_time: string | null
    timezone: string | null
    venue: string | null
    location: string | null
    description: string | null
    short_code: string
    band_id: string | null
    host_participant_id: string | null
    host_name: string
    who_can_join: WhoCanJoin
    requests_open: boolean
    approve_myself: boolean
    requests_visible: boolean
    group_size: number
    joining_locked: boolean
    default_parts: Part[]
    version: number
  }
  me: {
    participant_id: string
    tier: 'host' | 'cohost' | 'guest'
    via: 'app' | 'web' | 'walkup' | 'kiosk'
    name: string
    parts: Part[]
    share_songs: boolean
    joined: boolean
    is_house: boolean
    is_host: boolean
    is_manager: boolean
  } | null
  people: {
    participant_id: string
    user_id?: string
    name: string
    parts: Part[]
    via: 'app' | 'web' | 'walkup' | 'kiosk'
    tier: 'host' | 'cohost' | 'guest'
    is_house: boolean
    joined: boolean
    has_account: boolean
  }[]
  items: {
    id: string
    position: number
    queue_position: number | null
    state: ItemState
    title: string
    artist: string | null
    tuning: string | null
    key: string | null
    song_id: string | null
    source: string
    group_id: string | null
    called_at: string | null
    created_at: string
    pitched_by: string | null
    pitched_by_name: string | null
    parts_needed: Part[]
    covered: number
    total: number
    rank: number | null
    slots: {
      key: PartKey
      label: string | null
      nth: number
      cast: { hand_id: string; participant_id: string; name: string } | null
      raised: number
      gap: boolean
    }[]
    hands: {
      id: string
      participant_id: string
      name: string
      key: PartKey
      label: string | null
      status: 'raised' | 'accepted'
      mine: boolean
    }[]
    /** My personal song matching this one (normalised title + artist), if any. */
    mine: { song_id: string; is_jam_song: boolean } | null
  }[]
  stage: string | null
  up_next: string | null
  queue: string[]
}

type JamStateItem = JamState['items'][number]

/** jam_tv_feed(): the bar TV. */
export interface JamTvFeed {
  jam: Partial<JamState['jam']>
  code: string
  stage: JamStateItem | null
  up_next: JamStateItem | null
  group?: { id: string; title: string; state: ItemState }[]
  looking_for: JamStateItem[]
}

async function rpc<N extends keyof Fns>(name: N, args?: Fns[N]['Args']) {
  const { data, error } = await api().rpc(name as never, args as never)
  if (error) throw toApiError(error)
  return data as Fns[N]['Returns']
}

const parts = (p?: PartInput[]) => p as unknown as Json | undefined

/**
 * The code-taking anon functions answer a wrong or unusable code with a
 * refusal ({ error: key, hint: copy }) instead of raising, so the guess counts
 * toward the rate limit. Turn it back into the usual ApiError.
 */
function unrefused<T>(result: T | undefined): Omit<T, 'error' | 'hint'> {
  const r = result as
    | { error?: string | null; hint?: string | null }
    | undefined
  if (!r) throw new ApiError('unknown', "That didn't work. Try again.")
  if (r.error) throw new ApiError(r.error, r.hint ?? r.error)
  const { error: _e, hint: _h, ...rest } = r as Record<string, unknown>
  return rest as Omit<T, 'error' | 'hint'>
}

// ── Planning ────────────────────────────────────────────────────────────────

export async function createJam(input: {
  name: string
  at: string
  timezone?: string
  where?: string
  bandId?: string
  whoCanJoin?: WhoCanJoin
  defaultParts?: PartInput[]
}) {
  return (await rpc('create_jam', {
    p_name: input.name,
    p_at: input.at,
    p_timezone: input.timezone,
    p_where: input.where,
    p_band_id: input.bandId,
    p_who_can_join: input.whoCanJoin,
    p_default_parts: parts(input.defaultParts),
  })) as JamRow
}

/** Host only. '' clears a text field; throws `stale_version` on a conflict. */
export async function updateJam(
  eventId: string,
  patch: Partial<
    Pick<
      JamRow,
      | 'name'
      | 'scheduled_date'
      | 'timezone'
      | 'venue'
      | 'location'
      | 'description'
      | 'end_time'
    >
  >,
  expectedVersion: number
) {
  return (await rpc('update_jam', {
    p_event: eventId,
    p_patch: patch as Json,
    p_expected_version: expectedVersion,
  })) as JamRow
}

export async function setJamSettings(
  eventId: string,
  s: {
    whoCanJoin?: WhoCanJoin
    requestsOpen?: boolean
    approveMyself?: boolean
    groupSize?: number
    requestsVisible?: boolean
    defaultParts?: PartInput[]
  }
) {
  return (await rpc('set_jam_settings', {
    p_event: eventId,
    p_who_can_join: s.whoCanJoin,
    p_requests_open: s.requestsOpen,
    p_approve_myself: s.approveMyself,
    p_group_size: s.groupSize,
    p_requests_visible: s.requestsVisible,
    p_default_parts: parts(s.defaultParts),
  })) as JamRow
}

export async function setCohost(participantId: string, on: boolean) {
  return (await rpc('set_cohost', {
    p_participant: participantId,
    p_on: on,
  })) as JamParticipantRow
}

/** Planned jams only; people who joined are notified. */
export async function deleteJam(eventId: string) {
  await rpc('delete_jam', { p_event: eventId })
}

/** Returns only the new invites (already-invited people are skipped). */
export async function inviteToJam(eventId: string, userIds: string[]) {
  return (await rpc('invite_to_jam', {
    p_event: eventId,
    p_user_ids: userIds,
  })) as JamParticipantRow[]
}

// ── Joining ─────────────────────────────────────────────────────────────────

export async function joinJam(
  code: string,
  myParts?: PartInput[],
  shareSongs?: boolean
) {
  return (await rpc('join_jam', {
    p_code: code,
    p_parts: parts(myParts),
    p_share_songs: shareSongs,
  })) as JamParticipantRow
}

/** Invitees, and in Friends mode the host's friends / bandmates. */
export async function joinJamById(
  eventId: string,
  myParts?: PartInput[],
  shareSongs?: boolean
) {
  return (await rpc('join_jam_by_id', {
    p_event: eventId,
    p_parts: parts(myParts),
    p_share_songs: shareSongs,
  })) as JamParticipantRow
}

/** Sections: hosting, invited (incl. joined), friends (Friends' jams). */
export async function listMyJams() {
  return (await rpc('list_my_jams')) as MyJam[]
}

/** Anon. Throws `no_jam` / `invite_only` (refusal rows, see unrefused). */
export async function jamPreviewByCode(code: string) {
  const rows = await rpc('jam_preview_by_code', { p_code: code })
  return unrefused(rows?.[0]) as JamPreview
}

/** Anon. What a `/j/:code` code is: 'band', 'jam' or null. */
export async function resolveCode(code: string) {
  const rows = (await rpc('resolve_code', { p_code: code })) ?? []
  return (rows[0]?.kind ?? null) as 'band' | 'jam' | null
}

/** Anon. The token is returned once: keep it on the device. */
export async function joinJamAsWebGuest(
  code: string,
  name: string,
  myParts?: PartInput[]
) {
  const rows = await rpc('join_jam_as_web_guest', {
    p_code: code,
    p_name: name,
    p_parts: parts(myParts),
  })
  return unrefused(rows?.[0]) as {
    event_id: string
    participant_id: string
    token: string
  }
}

export async function updateMe(
  eventId: string,
  patch: { name?: string; parts?: PartInput[]; shareSongs?: boolean },
  guestToken?: string
) {
  return (await rpc('update_me', {
    p_event: eventId,
    p_name: patch.name,
    p_parts: parts(patch.parts),
    p_share_songs: patch.shareSongs,
    p_guest_token: guestToken,
  })) as JamParticipantRow
}

export async function leaveJam(eventId: string, guestToken?: string) {
  await rpc('leave_jam', { p_event: eventId, p_guest_token: guestToken })
}

/** Host / co-host, or the kiosk with its token (via 'kiosk'). */
export async function addWalkup(
  eventId: string,
  w: {
    name: string
    parts?: PartInput[]
    via?: 'walkup' | 'kiosk'
    itemId?: string
    pitchTitle?: string
    pitchArtist?: string
  },
  kioskToken?: string
) {
  return (await rpc('add_walkup', {
    p_event: eventId,
    p_name: w.name,
    p_parts: parts(w.parts),
    p_via: w.via,
    p_item: w.itemId,
    p_pitch_title: w.pitchTitle,
    p_pitch_artist: w.pitchArtist,
    p_guest_token: kioskToken,
  })) as JamParticipantRow
}

// ── Lineup, pitches, hands, cast ────────────────────────────────────────────

export async function addLineupSongs(
  eventId: string,
  songIds: string[],
  partsNeeded?: PartInput[]
) {
  return (await rpc('add_lineup_songs', {
    p_event: eventId,
    p_song_ids: songIds,
    p_parts_needed: parts(partsNeeded),
  })) as JamItemRow[]
}

export async function addLineupTitle(
  eventId: string,
  title: string,
  artist?: string,
  partsNeeded?: PartInput[]
) {
  return (await rpc('add_lineup_title', {
    p_event: eventId,
    p_title: title,
    p_artist: artist,
    p_parts_needed: parts(partsNeeded),
  })) as JamItemRow
}

/** Duplicates are slots: ['guitar', 'guitar'] = Guitar 1 and Guitar 2. */
export async function setItemParts(itemId: string, partsNeeded: PartInput[]) {
  return (await rpc('set_item_parts', {
    p_item: itemId,
    p_parts_needed: parts(partsNeeded) as Json,
  })) as JamItemRow
}

/** Listed ids first, in order; the rest keep their order after. */
export async function reorderLineup(eventId: string, itemIds: string[]) {
  await rpc('reorder_lineup', { p_event: eventId, p_item_ids: itemIds })
}

/** Pending unless the host pitches or approval is off. Guests: free text only. */
export async function pitchSong(
  eventId: string,
  p: {
    songId?: string
    title?: string
    artist?: string
    myParts?: PartInput[]
    partsNeeded?: PartInput[]
    groupId?: string
  },
  guestToken?: string
) {
  return (await rpc('pitch_song', {
    p_event: eventId,
    p_song_id: p.songId,
    p_title: p.title,
    p_artist: p.artist,
    p_my_parts: parts(p.myParts),
    p_parts_needed: parts(p.partsNeeded),
    p_group_id: p.groupId,
    p_guest_token: guestToken,
  })) as JamItemRow
}

export async function approvePitch(itemId: string) {
  return (await rpc('approve_pitch', { p_item: itemId })) as JamItemRow
}

export async function declinePitch(itemId: string) {
  return (await rpc('decline_pitch', { p_item: itemId })) as JamItemRow
}

/** Returns all your hands on that song. */
export async function raiseHand(
  itemId: string,
  myParts: PartInput[],
  guestToken?: string
) {
  return (await rpc('raise_hand', {
    p_item: itemId,
    p_parts: parts(myParts) as Json,
    p_guest_token: guestToken,
  })) as JamHandRow[]
}

export async function lowerHand(handId: string, guestToken?: string) {
  await rpc('lower_hand', { p_hand: handId, p_guest_token: guestToken })
}

/** Host / co-host: put someone on a part (on = false un-casts). */
export async function setCast(
  itemId: string,
  part: PartInput,
  participantId: string,
  on = true
) {
  return (await rpc('set_cast', {
    p_item: itemId,
    p_part: part as unknown as Json,
    p_participant: participantId,
    p_on: on,
  })) as JamHandRow
}

export async function jamState(eventId: string, guestToken?: string) {
  return (await rpc('jam_state', {
    p_event: eventId,
    p_guest_token: guestToken,
  })) as unknown as JamState
}

/** Anon: the bar TV for a code jam. */
export async function jamTvFeed(code: string) {
  const feed = await rpc('jam_tv_feed', { p_code: code })
  return unrefused(feed as unknown as JamTvFeed)
}

/** Everyone sharing jam songs, by overlap; with `otherId`, just that person. */
export async function whoKnowsYourSongs(eventId: string, otherId?: string) {
  return (await rpc('who_knows_your_songs', {
    p_event: eventId,
    p_other: otherId,
  })) as SongOverlap[]
}

// ── The live night (host / co-host) ─────────────────────────────────────────

/** The open lineup becomes the queue. */
export async function goLive(eventId: string) {
  return (await rpc('go_live', { p_event: eventId })) as JamRow
}

export async function queuePitch(itemId: string, position?: number) {
  return (await rpc('queue_pitch', {
    p_item: itemId,
    p_position: position,
  })) as JamItemRow
}

export async function moveQueueItem(itemId: string, position: number) {
  return (await rpc('move_queue_item', {
    p_item: itemId,
    p_position: position,
  })) as JamItemRow
}

export async function makeUpNext(itemId: string) {
  return (await rpc('make_up_next', { p_item: itemId })) as JamItemRow
}

/** Up next moves behind the next song. */
export async function skipUpNext(eventId: string) {
  return (await rpc('skip_up_next', { p_event: eventId })) as JamItemRow
}

/** The previous song on stage becomes played. */
export async function callUp(itemId: string) {
  return (await rpc('call_up', { p_item: itemId })) as unknown as {
    called: JamItemRow
    previous: JamItemRow | null
  }
}

export async function setQueueState(
  itemId: string,
  state: Exclude<ItemState, 'pending'>,
  position?: number
) {
  return (await rpc('set_queue_state', {
    p_item: itemId,
    p_state: state,
    p_position: position,
  })) as JamItemRow
}

/** Broadcasts a 'nudge' {item_id, part, title} on the jam's topic. */
export async function askTheRoom(itemId: string, part: PartInput) {
  await rpc('ask_the_room', {
    p_item: itemId,
    p_part: part as unknown as Json,
  })
}

export async function markHousePlayer(participantId: string, on: boolean) {
  return (await rpc('mark_house_player', {
    p_participant: participantId,
    p_on: on,
  })) as JamParticipantRow
}

export async function removePerson(participantId: string) {
  await rpc('remove_person', { p_participant: participantId })
}

export async function lockJoining(eventId: string, on: boolean) {
  return (await rpc('lock_joining', { p_event: eventId, p_on: on })) as JamRow
}

/** A kiosk token (for the QR) and a one-time 6-character code (10 minutes). */
export async function startKiosk(eventId: string) {
  const rows = await rpc('start_kiosk', { p_event: eventId })
  return rows[0] as { token: string; pairing_code: string; expires_at: string }
}

/** Anon: trade a pairing code for the jam's kiosk token. */
export async function pairKiosk(pairingCode: string) {
  const rows = await rpc('pair_kiosk', { p_pairing_code: pairingCode })
  return unrefused(rows?.[0]) as {
    event_id: string
    short_code: string
    token: string
  }
}

/** Guests, hands and tokens go; played songs stay. */
export async function endJam(eventId: string) {
  return (await rpc('end_jam', { p_event: eventId })) as JamRow
}

/** Played songs in called order, as a setlist tagged 'jam'. */
export async function saveJamAsSetlist(
  eventId: string,
  contextType: 'personal' | 'band',
  contextId?: string
) {
  return (await rpc('save_jam_as_setlist', {
    p_event: eventId,
    p_context_type: contextType,
    p_context_id: contextId,
  })) as SetlistRow
}

/** How many of your personal songs are tagged 'jam' (the join's songs step). */
export async function myJamSongCount(userId: string) {
  const { count, error } = await api()
    .from('songs')
    .select('id', { count: 'exact', head: true })
    .eq('context_type', 'personal')
    .eq('context_id', userId)
    .contains('tags', ['jam'])
  if (error) throw toApiError(error)
  return count ?? 0
}
