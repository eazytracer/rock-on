import { db } from '../database'
import { IDataRepository, SongFilter, BandFilter } from './IDataRepository'
import { Song } from '../../models/Song'
import { Band } from '../../models/Band'
import { Setlist } from '../../models/Setlist'
import { PracticeSession } from '../../models/PracticeSession'
import { Show } from '../../models/Show'
import { BandMembership } from '../../models/BandMembership'

/**
 * Local repository implementation using Dexie (IndexedDB)
 * This is the existing data access pattern, refactored into a repository
 */
export class LocalRepository implements IDataRepository {
  // ========== SONGS ==========

  async getSongs(filter?: SongFilter): Promise<Song[]> {
    let query = db.songs.toCollection()

    if (filter?.contextType) {
      query = db.songs.where('contextType').equals(filter.contextType)

      if (filter.contextId) {
        return query.filter(s => s.contextId === filter.contextId).toArray()
      }
    }

    if (filter?.createdBy) {
      return query.filter(s => s.createdBy === filter.createdBy).toArray()
    }

    if (filter?.songGroupId) {
      return query.filter(s => s.songGroupId === filter.songGroupId).toArray()
    }

    return query.toArray()
  }

  async getSong(id: string): Promise<Song | null> {
    const song = await db.songs.get(id)
    return song || null
  }

  async addSong(song: Song): Promise<Song> {
    // Ensure ID exists
    if (!song.id) {
      song.id = crypto.randomUUID()
    }

    await db.songs.add(song)
    return song
  }

  async updateSong(id: string, updates: Partial<Song>): Promise<Song> {
    await db.songs.update(id, updates)

    const updated = await db.songs.get(id)
    if (!updated) {
      throw new Error(`Song ${id} not found after update`)
    }

    return updated
  }

  async deleteSong(id: string): Promise<void> {
    console.log('[LocalRepository] Deleting song from IndexedDB:', id)

    // Check if song exists before delete
    const existsBefore = await db.songs.get(id)
    console.log('[LocalRepository] Song exists before delete:', !!existsBefore, existsBefore?.title)

    await db.songs.delete(id)

    // Verify deletion
    const existsAfter = await db.songs.get(id)
    console.log('[LocalRepository] Song exists after delete:', !!existsAfter)

    if (existsAfter) {
      console.error('[LocalRepository] ⚠️ WARNING: Song still exists after delete!', id)
    } else {
      console.log('[LocalRepository] ✅ Song successfully deleted from IndexedDB')
    }
  }

  // ========== BANDS ==========

  async getBands(filter?: BandFilter): Promise<Band[]> {
    let query = db.bands.toCollection()

    // isActive filter not supported in current Band model
    // Will be added when needed

    if (filter?.userId) {
      // Get bands where user is a member
      const memberships = await db.bandMemberships
        .where('userId')
        .equals(filter.userId)
        .filter(m => m.status === 'active')
        .toArray()

      const bandIds = memberships.map(m => m.bandId)
      return query.filter(b => bandIds.includes(b.id)).toArray()
    }

    return query.toArray()
  }

  async getBand(id: string): Promise<Band | null> {
    const band = await db.bands.get(id)
    return band || null
  }

  async getBandsForUser(userId: string): Promise<Band[]> {
    const memberships = await db.bandMemberships
      .where('userId')
      .equals(userId)
      .filter(m => m.status === 'active')
      .toArray()

    const bands = await Promise.all(
      memberships.map(async (m) => await db.bands.get(m.bandId))
    )

    return bands.filter((b): b is Band => b !== undefined)
  }

  async addBand(band: Band): Promise<Band> {
    if (!band.id) {
      band.id = crypto.randomUUID()
    }

    await db.bands.add(band)
    return band
  }

  async updateBand(id: string, updates: Partial<Band>): Promise<Band> {
    await db.bands.update(id, updates)

    const updated = await db.bands.get(id)
    if (!updated) {
      throw new Error(`Band ${id} not found after update`)
    }

    return updated
  }

  async deleteBand(id: string): Promise<void> {
    await db.bands.delete(id)
  }

  // ========== SETLISTS ==========

  async getSetlists(bandId: string): Promise<Setlist[]> {
    return db.setlists
      .where('bandId')
      .equals(bandId)
      .reverse()
      .toArray()
  }

  async getSetlist(id: string): Promise<Setlist | null> {
    const setlist = await db.setlists.get(id)
    return setlist || null
  }

  async addSetlist(setlist: Setlist): Promise<Setlist> {
    if (!setlist.id) {
      setlist.id = crypto.randomUUID()
    }

    await db.setlists.add(setlist)
    return setlist
  }

  async updateSetlist(id: string, updates: Partial<Setlist>): Promise<Setlist> {
    await db.setlists.update(id, updates)

    const updated = await db.setlists.get(id)
    if (!updated) {
      throw new Error(`Setlist ${id} not found after update`)
    }

    return updated
  }

  async deleteSetlist(id: string): Promise<void> {
    await db.setlists.delete(id)
  }

  // ========== PRACTICE SESSIONS ==========

  async getPracticeSessions(bandId: string): Promise<PracticeSession[]> {
    return db.practiceSessions
      .where('bandId')
      .equals(bandId)
      .reverse()
      .toArray()
  }

  async getPracticeSession(id: string): Promise<PracticeSession | null> {
    const session = await db.practiceSessions.get(id)
    return session || null
  }

  async addPracticeSession(session: PracticeSession): Promise<PracticeSession> {
    if (!session.id) {
      session.id = crypto.randomUUID()
    }

    await db.practiceSessions.add(session)
    return session
  }

  async updatePracticeSession(id: string, updates: Partial<PracticeSession>): Promise<PracticeSession> {
    await db.practiceSessions.update(id, updates)

    const updated = await db.practiceSessions.get(id)
    if (!updated) {
      throw new Error(`Practice session ${id} not found after update`)
    }

    return updated
  }

  async deletePracticeSession(id: string): Promise<void> {
    await db.practiceSessions.delete(id)
  }

  // ========== SHOWS ==========

  async getShows(bandId: string): Promise<Show[]> {
    return db.shows
      .where('bandId')
      .equals(bandId)
      .reverse()  // Most recent first
      .toArray()
  }

  async getShow(id: string): Promise<Show | null> {
    const show = await db.shows.get(id)
    return show || null
  }

  async addShow(show: Show): Promise<Show> {
    if (!show.id) {
      show.id = crypto.randomUUID()
    }

    await db.shows.add(show)
    return show
  }

  async updateShow(id: string, updates: Partial<Show>): Promise<Show> {
    await db.shows.update(id, updates)

    const updated = await db.shows.get(id)
    if (!updated) {
      throw new Error(`Show ${id} not found after update`)
    }

    return updated
  }

  async deleteShow(id: string): Promise<void> {
    console.log('[LocalRepository] Deleting show from IndexedDB:', id)

    const existsBefore = await db.shows.get(id)
    console.log('[LocalRepository] Show exists before delete:', !!existsBefore, existsBefore?.name)

    await db.shows.delete(id)

    const existsAfter = await db.shows.get(id)
    console.log('[LocalRepository] Show exists after delete:', !!existsAfter)

    if (existsAfter) {
      console.error('[LocalRepository] ⚠️ WARNING: Show still exists after delete!', id)
    } else {
      console.log('[LocalRepository] ✅ Show successfully deleted from IndexedDB')
    }
  }

  // ========== BAND MEMBERSHIPS ==========

  async getBandMemberships(bandId: string): Promise<BandMembership[]> {
    return db.bandMemberships
      .where('bandId')
      .equals(bandId)
      .toArray()
  }

  async getUserMemberships(userId: string): Promise<BandMembership[]> {
    return db.bandMemberships
      .where('userId')
      .equals(userId)
      .toArray()
  }

  async addBandMembership(membership: BandMembership): Promise<BandMembership> {
    if (!membership.id) {
      membership.id = crypto.randomUUID()
    }

    await db.bandMemberships.add(membership)
    return membership
  }

  async updateBandMembership(id: string, updates: Partial<BandMembership>): Promise<BandMembership> {
    await db.bandMemberships.update(id, updates)

    const updated = await db.bandMemberships.get(id)
    if (!updated) {
      throw new Error(`Band membership ${id} not found after update`)
    }

    return updated
  }

  async deleteBandMembership(id: string): Promise<void> {
    await db.bandMemberships.delete(id)
  }

  // ========== SYNC OPERATIONS ==========
  // These are no-op implementations since LocalRepository doesn't handle sync
  // Sync is handled by SyncRepository/SyncEngine

  setCurrentUser(_userId: string): void {
    // No-op: LocalRepository doesn't handle sync
  }

  async isInitialSyncNeeded(): Promise<boolean> {
    // No-op: LocalRepository doesn't handle sync
    return false
  }

  async performInitialSync(_userId: string): Promise<void> {
    // No-op: LocalRepository doesn't handle sync
  }

  async pullFromRemote(_userId: string): Promise<void> {
    // No-op: LocalRepository doesn't handle sync
  }
}
