import { Song } from '../../models/Song'
import { Band } from '../../models/Band'
import { Setlist } from '../../models/Setlist'
import { PracticeSession } from '../../models/PracticeSession'
import { Show } from '../../models/Show'
import { BandMembership, InviteCode } from '../../models/BandMembership'

export interface SongFilter {
  id?: string
  contextType?: 'band' | 'personal'
  contextId?: string
  createdBy?: string
  songGroupId?: string
}

export interface BandFilter {
  name?: string
  userId?: string
  isActive?: boolean
}

/**
 * Data repository interface
 * Abstracts data access for local, remote, or synchronized storage
 */
export interface IDataRepository {
  // ========== SONGS ==========
  getSongs(filter?: SongFilter): Promise<Song[]>
  getSong(id: string): Promise<Song | null>
  addSong(song: Song): Promise<Song>
  updateSong(id: string, updates: Partial<Song>): Promise<Song>
  deleteSong(id: string): Promise<void>

  // ========== BANDS ==========
  getBands(filter?: BandFilter): Promise<Band[]>
  getBand(id: string): Promise<Band | null>
  getBandsForUser(userId: string): Promise<Band[]>
  addBand(band: Band): Promise<Band>
  updateBand(id: string, updates: Partial<Band>): Promise<Band>
  deleteBand(id: string): Promise<void>

  // ========== SETLISTS ==========
  getSetlists(bandId: string): Promise<Setlist[]>
  getSetlist(id: string): Promise<Setlist | null>
  addSetlist(setlist: Setlist): Promise<Setlist>
  updateSetlist(id: string, updates: Partial<Setlist>): Promise<Setlist>
  deleteSetlist(id: string): Promise<void>

  // ========== PRACTICE SESSIONS ==========
  getPracticeSessions(bandId: string): Promise<PracticeSession[]>
  getPracticeSession(id: string): Promise<PracticeSession | null>
  addPracticeSession(session: PracticeSession): Promise<PracticeSession>
  updatePracticeSession(
    id: string,
    updates: Partial<PracticeSession>
  ): Promise<PracticeSession>
  deletePracticeSession(id: string): Promise<void>

  // ========== SHOWS ==========
  getShows(bandId: string): Promise<Show[]>
  getShow(id: string): Promise<Show | null>
  addShow(show: Show): Promise<Show>
  updateShow(id: string, updates: Partial<Show>): Promise<Show>
  deleteShow(id: string): Promise<void>

  // ========== BAND MEMBERSHIPS ==========
  getBandMemberships(bandId: string): Promise<BandMembership[]>
  getUserMemberships(userId: string): Promise<BandMembership[]>
  addBandMembership(membership: BandMembership): Promise<BandMembership>
  updateBandMembership(
    id: string,
    updates: Partial<BandMembership>
  ): Promise<BandMembership>
  deleteBandMembership(id: string): Promise<void>

  // ========== INVITE CODES ==========
  /**
   * Get all invite codes for a band
   */
  getInviteCodes(bandId: string): Promise<InviteCode[]>

  /**
   * Get a specific invite code by ID
   */
  getInviteCode(id: string): Promise<InviteCode | null>

  /**
   * Get an invite code by its code string
   * Used for validation during band joining
   */
  getInviteCodeByCode(code: string): Promise<InviteCode | null>

  /**
   * Create a new invite code
   * Automatically syncs to Supabase via SyncEngine
   */
  addInviteCode(inviteCode: InviteCode): Promise<InviteCode>

  /**
   * Update an invite code (e.g., increment currentUses)
   */
  updateInviteCode(
    id: string,
    updates: Partial<InviteCode>
  ): Promise<InviteCode>

  /**
   * Increment invite code usage count
   * Uses secure Postgres function to bypass RLS restrictions
   */
  incrementInviteCodeUsage(id: string): Promise<InviteCode>

  /**
   * Delete/deactivate an invite code
   */
  deleteInviteCode(id: string): Promise<void>

  // ========== SYNC OPERATIONS ==========
  /**
   * Set the current user ID for sync operations
   */
  setCurrentUser(userId: string): void

  /**
   * Check if initial sync is needed
   * Returns true if never synced or > 30 days since last full sync
   */
  isInitialSyncNeeded(): Promise<boolean>

  /**
   * Perform initial sync - download all data from cloud on first login
   */
  performInitialSync(userId: string): Promise<void>

  /**
   * Pull changes from remote (incremental sync)
   */
  pullFromRemote(userId: string): Promise<void>
}
