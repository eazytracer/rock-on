import { db } from './database'
import { Setlist } from '../models/Setlist'
import { SetlistStatus, SetlistSong } from '../types'

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
  static async getSetlists(filters: SetlistFilters): Promise<SetlistListResponse> {
    let query = db.setlists
      .where('bandId')
      .equals(filters.bandId)
      .reverse()

    // Apply status filter
    if (filters.status) {
      query = query.filter(setlist => setlist.status === filters.status)
    }

    // Apply show date filter
    if (filters.showDate) {
      const targetDate = new Date(filters.showDate)
      query = query.filter(setlist => {
        if (!setlist.showDate) return false
        const showDate = new Date(setlist.showDate)
        return showDate.toDateString() === targetDate.toDateString()
      })
    }

    const setlists = await query.toArray()
    const total = await db.setlists.where('bandId').equals(filters.bandId).count()

    return {
      setlists,
      total
    }
  }

  static async createSetlist(setlistData: CreateSetlistRequest): Promise<Setlist> {
    this.validateSetlistData(setlistData)

    const songs: SetlistSong[] = setlistData.songs?.map((songId, index) => ({
      songId,
      order: index + 1
    })) || []

    const newSetlist: Setlist = {
      id: crypto.randomUUID(),
      name: setlistData.name,
      bandId: setlistData.bandId,
      showDate: setlistData.showDate ? new Date(setlistData.showDate) : undefined,
      venue: setlistData.venue,
      songs,
      totalDuration: await this.calculateTotalDuration(songs),
      notes: setlistData.notes,
      status: 'draft',
      createdDate: new Date(),
      lastModified: new Date()
    }

    await db.setlists.add(newSetlist)
    return newSetlist
  }

  static async getSetlistById(setlistId: string): Promise<Setlist | null> {
    const setlist = await db.setlists.get(setlistId)
    return setlist || null
  }

  static async updateSetlist(setlistId: string, updateData: UpdateSetlistRequest): Promise<Setlist> {
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
    if (updateData.status && !['draft', 'rehearsed', 'performed'].includes(updateData.status)) {
      throw new Error('Invalid setlist status')
    }

    const updates: Partial<Setlist> = { lastModified: new Date() }
    if (updateData.name !== undefined) updates.name = updateData.name
    if (updateData.showDate !== undefined) {
      updates.showDate = updateData.showDate ? new Date(updateData.showDate) : undefined
    }
    if (updateData.venue !== undefined) updates.venue = updateData.venue
    if (updateData.notes !== undefined) updates.notes = updateData.notes
    if (updateData.status) updates.status = updateData.status

    await db.setlists.update(setlistId, updates)
    return await this.getSetlistById(setlistId) as Setlist
  }

  static async deleteSetlist(setlistId: string): Promise<void> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    await db.setlists.delete(setlistId)
  }

  static async addSongToSetlist(setlistId: string, songData: AddSetlistSongRequest): Promise<Setlist> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    if (songData.keyChange && !this.isValidMusicalKey(songData.keyChange)) {
      throw new Error('Invalid musical key format')
    }
    if (songData.tempoChange && (songData.tempoChange < -50 || songData.tempoChange > 50)) {
      throw new Error('Tempo change must be between -50 and +50')
    }

    const newSong: SetlistSong = {
      songId: songData.songId,
      order: songData.position || setlist.songs.length + 1,
      keyChange: songData.keyChange,
      tempoChange: songData.tempoChange,
      specialInstructions: songData.specialInstructions
    }

    // Reorder existing songs if inserting at specific position
    const updatedSongs = [...setlist.songs]
    if (songData.position && songData.position <= setlist.songs.length) {
      updatedSongs.splice(songData.position - 1, 0, newSong)
      // Renumber all songs
      updatedSongs.forEach((song, index) => {
        song.order = index + 1
      })
    } else {
      updatedSongs.push(newSong)
    }

    const totalDuration = await this.calculateTotalDuration(updatedSongs)
    await db.setlists.update(setlistId, {
      songs: updatedSongs,
      totalDuration,
      lastModified: new Date()
    })

    return await this.getSetlistById(setlistId) as Setlist
  }

  static async updateSongInSetlist(setlistId: string, songId: string, updateData: UpdateSetlistSongRequest): Promise<Setlist> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    const songIndex = setlist.songs.findIndex(s => s.songId === songId)
    if (songIndex === -1) {
      throw new Error('Song not found in setlist')
    }

    if (updateData.keyChange && !this.isValidMusicalKey(updateData.keyChange)) {
      throw new Error('Invalid musical key format')
    }
    if (updateData.tempoChange && (updateData.tempoChange < -50 || updateData.tempoChange > 50)) {
      throw new Error('Tempo change must be between -50 and +50')
    }

    const updatedSongs = [...setlist.songs]
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
    await db.setlists.update(setlistId, {
      songs: updatedSongs,
      lastModified: new Date()
    })

    return await this.getSetlistById(setlistId) as Setlist
  }

  static async removeSongFromSetlist(setlistId: string, songId: string): Promise<Setlist> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    const songIndex = setlist.songs.findIndex(s => s.songId === songId)
    if (songIndex === -1) {
      throw new Error('Song not found in setlist')
    }

    const updatedSongs = setlist.songs.filter(s => s.songId !== songId)
    // Renumber remaining songs
    updatedSongs.forEach((song, index) => {
      song.order = index + 1
    })

    const totalDuration = await this.calculateTotalDuration(updatedSongs)
    await db.setlists.update(setlistId, {
      songs: updatedSongs,
      totalDuration,
      lastModified: new Date()
    })

    return await this.getSetlistById(setlistId) as Setlist
  }

  static async reorderSongs(setlistId: string, reorderData: ReorderSongsRequest): Promise<Setlist> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    const reorderedSongs: SetlistSong[] = reorderData.songOrder.map((songId, index) => {
      const existingSong = setlist.songs.find(s => s.songId === songId)
      if (!existingSong) {
        throw new Error(`Song ${songId} not found in setlist`)
      }
      return {
        ...existingSong,
        order: index + 1
      }
    })

    await db.setlists.update(setlistId, {
      songs: reorderedSongs,
      lastModified: new Date()
    })

    return await this.getSetlistById(setlistId) as Setlist
  }

  static async generateReadinessReport(setlistId: string): Promise<ReadinessReport> {
    const setlist = await this.getSetlistById(setlistId)
    if (!setlist) {
      throw new Error('Setlist not found')
    }

    const songReadiness: SongReadiness[] = []
    let totalConfidence = 0
    let readySongs = 0
    let needsPracticeSongs = 0

    for (const setlistSong of setlist.songs) {
      const song = await db.songs.get(setlistSong.songId)
      if (!song) continue

      const daysSincePractice = song.lastPracticed
        ? Math.floor((Date.now() - song.lastPracticed.getTime()) / (1000 * 60 * 60 * 24))
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
        warnings
      })

      totalConfidence += song.confidenceLevel
    }

    const overallReadiness = setlist.songs.length > 0 ? totalConfidence / setlist.songs.length : 0

    const recommendations: string[] = []
    if (needsPracticeSongs > 0) {
      recommendations.push(`Practice ${needsPracticeSongs} songs that need work`)
    }
    if (readySongs < setlist.songs.length * 0.8) {
      recommendations.push('Schedule additional practice sessions')
    }

    const estimatedPracticeTime = needsPracticeSongs * 30 + (setlist.songs.length - readySongs - needsPracticeSongs) * 15

    return {
      setlistId,
      overallReadiness,
      totalSongs: setlist.songs.length,
      readySongs,
      needsPracticeSongs,
      songReadiness,
      recommendations,
      estimatedPracticeTime
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

  private static async calculateTotalDuration(songs: SetlistSong[]): Promise<number> {
    let total = 0
    for (const setlistSong of songs) {
      const song = await db.songs.get(setlistSong.songId)
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
}