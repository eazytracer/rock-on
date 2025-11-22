/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from './database'
import { Setlist } from '../models/Setlist'
import { SetlistStatus, SetlistSong } from '../types'
import { castingService } from './CastingService'
import { repository } from './data/RepositoryFactory'

export interface SetlistFilters {
  bandId: string
  status?: SetlistStatus
  showDate?: string
}

export interface SetlistListResponse {
  setlists: Setlist[]
  total: number
}

export interface CreateSetlistRequest {
  name: string
  bandId: string
  showDate?: string
  venue?: string
  songs?: string[]
  notes?: string
}

export interface UpdateSetlistRequest {
  name?: string
  showDate?: string
  venue?: string
  notes?: string
  status?: SetlistStatus
  showId?: string
}

export interface AddSetlistSongRequest {
  songId: string
  position?: number
  keyChange?: string
  tempoChange?: number
  specialInstructions?: string
}

export interface UpdateSetlistSongRequest {
  transitionNotes?: string
  keyChange?: string
  tempoChange?: number
  specialInstructions?: string
}

export interface ReorderSongsRequest {
  songOrder: string[]
}

export interface ReadinessReport {
  setlistId: string
  overallReadiness: number
  totalSongs: number
  readySongs: number
  needsPracticeSongs: number
  songReadiness: SongReadiness[]
  recommendations: string[]
  estimatedPracticeTime: number
}

export interface SongReadiness {
  songId: string
  title: string
  artist: string
  confidenceLevel: number
  lastPracticed?: Date
  daysSincePractice: number
  status: 'ready' | 'needs-practice' | 'warning' | 'not-practiced'
  warnings: string[]
}

export class SetlistService {
  static async getSetlists(
    filters: SetlistFilters
  ): Promise<SetlistListResponse> {
    // Get all setlists for the band from repository
    let setlists = await repository.getSetlists(filters.bandId)

    // Apply status filter (client-side)
    if (filters.status) {
      setlists = setlists.filter(setlist => setlist.status === filters.status)
    }

    // Apply show date filter (client-side)
    if (filters.showDate) {
      const targetDate = new Date(filters.showDate)
      setlists = setlists.filter(setlist => {
        if (!setlist.showDate) return false
        const showDate = new Date(setlist.showDate)
        return showDate.toDateString() === targetDate.toDateString()
      })
    }

    // Sort by creation date (most recent first) to mimic .reverse()
    setlists.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime())

    const total = setlists.length

    return {
      setlists,
      total,
    }
  }

  static async createSetlist(
    setlistData: CreateSetlistRequest
  ): Promise<Setlist> {
    this.validateSetlistData(setlistData)

    const songs: SetlistSong[] =
      setlistData.songs?.map((songId, index) => ({
        songId,
        order: index + 1,
      })) || []

    const newSetlist: Setlist = {
      id: crypto.randomUUID(),
      name: setlistData.name,
      bandId: setlistData.bandId,
      showDate: setlistData.showDate
        ? new Date(setlistData.showDate)
        : undefined,
      venue: setlistData.venue,
      songs,
      items: [], // Required by Setlist model
      totalDuration: await this.calculateTotalDuration(songs),
      notes: setlistData.notes,
      status: 'draft',
      createdDate: new Date(),
      lastModified: new Date(),
    }

    return await repository.addSetlist(newSetlist)
  }

  /**
   * Fork (copy) an existing setlist for use with a show
   * Creates a new setlist with all items copied, maintaining a reference to the original
   * @param sourceSetlistId - ID of the setlist to fork
   * @param showName - Name of the show (used to name the forked setlist)
   * @returns The newly created forked setlist
   */
  static async forkSetlist(
    sourceSetlistId: string,
    showName: string
  ): Promise<Setlist> {
    const sourceSetlist = await this.getSetlistById(sourceSetlistId)
    if (!sourceSetlist) {
      throw new Error('Source setlist not found')
    }

    const forkedSetlist: Setlist = {
      id: crypto.randomUUID(),
      name: `${sourceSetlist.name} (${showName})`,
      bandId: sourceSetlist.bandId,
      sourceSetlistId: sourceSetlistId, // Reference to original
      showId: undefined, // Will be set when show is created
      showDate: undefined,
      venue: undefined,
      songs: [...(sourceSetlist.songs || [])], // Copy songs array
      items: JSON.parse(JSON.stringify(sourceSetlist.items)), // Deep copy items
      totalDuration: sourceSetlist.totalDuration,
      notes: sourceSetlist.notes
        ? `Forked from "${sourceSetlist.name}"\n\n${sourceSetlist.notes}`
        : `Forked from "${sourceSetlist.name}"`,
      status: 'draft', // New fork starts as draft
      createdDate: new Date(),
      lastModified: new Date(),
    }

    return await repository.addSetlist(forkedSetlist)
  }

  static async getSetlistById(setlistId: string): Promise<Setlist | null> {
    return await repository.getSetlist(setlistId)
  }

  static async updateSetlist(
    setlistId: string,
    updateData: UpdateSetlistRequest
  ): Promise<Setlist> {
    const existingSetlist = await this.getSetlistById(setlistId)
    if (!existingSetlist) {
      throw new Error('Setlist not found')
    }

    if (updateData.name !== undefined && updateData.name.trim().length === 0) {
      throw new Error('Setlist name cannot be empty')
    }
    if (updateData.name && updateData.name.length > 100) {
      throw new Error('Setlist name cannot exceed 100 characters')
    }
    if (
      updateData.status &&
      !['draft', 'rehearsed', 'performed'].includes(updateData.status)
    ) {
      throw new Error('Invalid setlist status')
    }

    const updates: Partial<Setlist> = { lastModified: new Date() }
    if (updateData.name !== undefined) updates.name = updateData.name
    if (updateData.showDate !== undefined) {
      updates.showDate = updateData.showDate
        ? new Date(updateData.showDate)
        : undefined
    }
    if (updateData.venue !== undefined) updates.venue = updateData.venue
    if (updateData.notes !== undefined) updates.notes = updateData.notes
    if (updateData.status) updates.status = updateData.status
    if (updateData.showId !== undefined) updates.showId = updateData.showId

    await repository.updateSetlist(setlistId, updates)
    return (await this.getSetlistById(setlistId)) as Setlist
  }

  static async deleteSetlist(setlistId: string): Promise<void> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    await repository.deleteSetlist(setlistId)
  }

  static async addSongToSetlist(
    setlistId: string,
    songData: AddSetlistSongRequest
  ): Promise<Setlist> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    if (songData.keyChange && !this.isValidMusicalKey(songData.keyChange)) {
      throw new Error('Invalid musical key format')
    }
    if (
      songData.tempoChange &&
      (songData.tempoChange < -50 || songData.tempoChange > 50)
    ) {
      throw new Error('Tempo change must be between -50 and +50')
    }

    const newSong: SetlistSong = {
      songId: songData.songId,
      order: songData.position || (setlist.songs || []).length + 1,
      keyChange: songData.keyChange,
      tempoChange: songData.tempoChange,
      specialInstructions: songData.specialInstructions,
    }

    // Reorder existing songs if inserting at specific position
    const updatedSongs = [...(setlist.songs || [])]
    if (
      songData.position &&
      songData.position <= (setlist.songs || []).length
    ) {
      updatedSongs.splice(songData.position - 1, 0, newSong)
      // Renumber all songs
      updatedSongs.forEach((song, index) => {
        song.order = index + 1
      })
    } else {
      updatedSongs.push(newSong)
    }

    const totalDuration = await this.calculateTotalDuration(updatedSongs)
    await repository.updateSetlist(setlistId, {
      songs: updatedSongs,
      totalDuration,
      lastModified: new Date(),
    })

    return (await this.getSetlistById(setlistId)) as Setlist
  }

  static async updateSongInSetlist(
    setlistId: string,
    songId: string,
    updateData: UpdateSetlistSongRequest
  ): Promise<Setlist> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    const songIndex = (setlist.songs || []).findIndex(s => s.songId === songId)
    if (songIndex === -1) {
      throw new Error('Song not found in setlist')
    }

    if (updateData.keyChange && !this.isValidMusicalKey(updateData.keyChange)) {
      throw new Error('Invalid musical key format')
    }
    if (
      updateData.tempoChange &&
      (updateData.tempoChange < -50 || updateData.tempoChange > 50)
    ) {
      throw new Error('Tempo change must be between -50 and +50')
    }

    const updatedSongs = [...(setlist.songs || [])]
    const songToUpdate = { ...updatedSongs[songIndex] }

    if (updateData.transitionNotes !== undefined) {
      songToUpdate.transitionNotes = updateData.transitionNotes
    }
    if (updateData.keyChange !== undefined) {
      songToUpdate.keyChange = updateData.keyChange
    }
    if (updateData.tempoChange !== undefined) {
      songToUpdate.tempoChange = updateData.tempoChange
    }
    if (updateData.specialInstructions !== undefined) {
      songToUpdate.specialInstructions = updateData.specialInstructions
    }

    updatedSongs[songIndex] = songToUpdate
    await repository.updateSetlist(setlistId, {
      songs: updatedSongs,
      lastModified: new Date(),
    })

    return (await this.getSetlistById(setlistId)) as Setlist
  }

  static async removeSongFromSetlist(
    setlistId: string,
    songId: string
  ): Promise<Setlist> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    const songIndex = (setlist.songs || []).findIndex(s => s.songId === songId)
    if (songIndex === -1) {
      throw new Error('Song not found in setlist')
    }

    const updatedSongs = (setlist.songs || []).filter(s => s.songId !== songId)
    // Renumber remaining songs
    updatedSongs.forEach((song, index) => {
      song.order = index + 1
    })

    const totalDuration = await this.calculateTotalDuration(updatedSongs)
    await repository.updateSetlist(setlistId, {
      songs: updatedSongs,
      totalDuration,
      lastModified: new Date(),
    })

    return (await this.getSetlistById(setlistId)) as Setlist
  }

  static async reorderSongs(
    setlistId: string,
    reorderData: ReorderSongsRequest
  ): Promise<Setlist> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    const reorderedSongs: SetlistSong[] = reorderData.songOrder.map(
      (songId, index) => {
        const existingSong = (setlist.songs || []).find(
          s => s.songId === songId
        )
        if (!existingSong) {
          throw new Error(`Song ${songId} not found in setlist`)
        }
        return {
          ...existingSong,
          order: index + 1,
        }
      }
    )

    await repository.updateSetlist(setlistId, {
      songs: reorderedSongs,
      lastModified: new Date(),
    })

    return (await this.getSetlistById(setlistId)) as Setlist
  }

  static async generateReadinessReport(
    setlistId: string
  ): Promise<ReadinessReport> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    const songReadiness: SongReadiness[] = []
    let totalConfidence = 0
    let readySongs = 0
    let needsPracticeSongs = 0

    for (const setlistSong of setlist.songs || []) {
      const song = await db.songs.get(setlistSong.songId)
      if (!song) continue

      const daysSincePractice = song.lastPracticed
        ? Math.floor(
            (Date.now() - song.lastPracticed.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 999

      let status: 'ready' | 'needs-practice' | 'warning' | 'not-practiced'
      const warnings: string[] = []

      if (!song.lastPracticed) {
        status = 'not-practiced'
        warnings.push('Never practiced')
        needsPracticeSongs++
      } else if (song.confidenceLevel >= 4) {
        status = 'ready'
        readySongs++
        if (daysSincePractice > 14) {
          warnings.push('Not practiced recently')
        }
      } else if (song.confidenceLevel >= 3) {
        status = 'warning'
        warnings.push('Could use more practice')
        if (daysSincePractice > 7) {
          warnings.push('Not practiced recently')
        }
      } else {
        status = 'needs-practice'
        needsPracticeSongs++
        warnings.push('Needs significant practice')
      }

      songReadiness.push({
        songId: song.id,
        title: song.title,
        artist: song.artist,
        confidenceLevel: song.confidenceLevel,
        lastPracticed: song.lastPracticed,
        daysSincePractice,
        status,
        warnings,
      })

      totalConfidence += song.confidenceLevel
    }

    const overallReadiness =
      (setlist.songs || []).length > 0
        ? totalConfidence / (setlist.songs || []).length
        : 0

    const recommendations: string[] = []
    if (needsPracticeSongs > 0) {
      recommendations.push(
        `Practice ${needsPracticeSongs} songs that need work`
      )
    }
    if (readySongs < (setlist.songs || []).length * 0.8) {
      recommendations.push('Schedule additional practice sessions')
    }

    const estimatedPracticeTime =
      needsPracticeSongs * 30 +
      ((setlist.songs || []).length - readySongs - needsPracticeSongs) * 15

    return {
      setlistId,
      overallReadiness,
      totalSongs: (setlist.songs || []).length,
      readySongs,
      needsPracticeSongs,
      songReadiness,
      recommendations,
      estimatedPracticeTime,
    }
  }

  private static validateSetlistData(setlistData: CreateSetlistRequest): void {
    if (!setlistData.name || setlistData.name.trim().length === 0) {
      throw new Error('Setlist name is required')
    }
    if (setlistData.name.length > 100) {
      throw new Error('Setlist name cannot exceed 100 characters')
    }
    if (!setlistData.bandId) {
      throw new Error('Band ID is required')
    }
  }

  private static async calculateTotalDuration(
    songs: SetlistSong[]
  ): Promise<number> {
    let total = 0
    for (const setlistSong of songs) {
      // Get songs from repository
      const allSongs = await repository.getSongs({ id: setlistSong.songId })
      const song = allSongs[0]
      if (song) {
        total += song.duration
      }
    }
    return total
  }

  private static isValidMusicalKey(key: string): boolean {
    const keyPattern = /^[A-G](#|b)?m?$/
    return keyPattern.test(key)
  }

  /**
   * Get casting for all songs in a setlist
   */
  static async getSetlistCasting(
    setlistId: string
  ): Promise<{ songId: number; casting: any }[]> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    const castings = await castingService.getCastingsForContext(
      'setlist',
      setlistId
    )

    return castings.map(casting => ({
      songId: casting.songId,
      casting,
    }))
  }

  /**
   * Create casting for a song in a setlist
   */
  static async createSongCasting(
    setlistId: string,
    songId: number,
    createdBy: string
  ): Promise<number> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    return await castingService.createCasting({
      contextType: 'setlist',
      contextId: setlistId,
      songId,
      createdBy,
      createdDate: new Date(),
    })
  }

  /**
   * Copy casting from another setlist
   */
  static async copyCastingFromSetlist(
    sourceSetlistId: string,
    targetSetlistId: string,
    createdBy: string
  ): Promise<void> {
    await castingService.copyCasting(
      'setlist',
      sourceSetlistId,
      'setlist',
      targetSetlistId,
      createdBy
    )
  }

  /**
   * Delete casting when a setlist is deleted
   */
  static async deleteSetlistCasting(setlistId: string): Promise<void> {
    const castings = await castingService.getCastingsForContext(
      'setlist',
      setlistId
    )

    for (const casting of castings) {
      if (casting.id) {
        await castingService.deleteCasting(casting.id)
      }
    }
  }

  /**
   * Get complete setlist with casting information
   */
  static async getSetlistWithCasting(setlistId: string) {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) return null

    const castings = await castingService.getCastingsForContext(
      'setlist',
      setlistId
    )

    const songsWithCasting = await Promise.all(
      (setlist.songs || []).map(async setlistSong => {
        const song = await db.songs.get(setlistSong.songId)
        const casting = castings.find(
          c => c.songId === parseInt(setlistSong.songId)
        )

        let completeCasting = null
        if (casting && casting.id) {
          completeCasting = await castingService.getCompleteCasting(casting.id)
        }

        return {
          ...setlistSong,
          song,
          casting: completeCasting,
        }
      })
    )

    return {
      ...setlist,
      songsWithCasting,
    }
  }
}
