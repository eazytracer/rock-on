import { db } from './database'
import { Song } from '../models/Song'

export interface SongFilters {
  bandId: string
  search?: string
  key?: string
  difficulty?: number
  tags?: string[]
  contextType?: 'personal' | 'band'
  contextId?: string
  userId?: string
}

export interface SongListResponse {
  songs: Song[]
  total: number
  filtered: number
}

export interface CreateSongRequest {
  title: string
  artist: string
  album?: string
  duration: number
  key: string
  bpm: number
  difficulty: 1 | 2 | 3 | 4 | 5
  guitarTuning?: string
  lyrics?: string
  chords?: string[]
  notes?: string
  referenceLinks?: any[]
  tags?: string[]
  bandId: string
  createdBy: string
  contextType?: 'personal' | 'band'
  contextId?: string
  visibility?: 'private' | 'band_only' | 'public'
}

export interface ConfidenceRating {
  memberId: string
  confidence: 1 | 2 | 3 | 4 | 5
  feedback?: string
}

export class SongService {
  static async getAllSongs(filters: SongFilters): Promise<SongListResponse> {
    let query = db.songs.orderBy('title')

    // Apply context type filter
    if (filters.contextType) {
      query = query.filter(song => song.contextType === filters.contextType)
    }

    // Apply context ID filter
    if (filters.contextId) {
      query = query.filter(song => song.contextId === filters.contextId)
    }

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      query = query.filter(song =>
        song.title.toLowerCase().includes(searchTerm) ||
        song.artist.toLowerCase().includes(searchTerm)
      )
    }

    // Apply key filter
    if (filters.key) {
      query = query.filter(song => song.key === filters.key)
    }

    // Apply difficulty filter
    if (filters.difficulty) {
      query = query.filter(song => song.difficulty === filters.difficulty)
    }

    // Apply tags filter
    if (filters.tags && filters.tags.length > 0) {
      query = query.filter(song =>
        filters.tags!.some(tag => song.tags.includes(tag))
      )
    }

    const songs = await query.toArray()
    const total = await db.songs.count()

    return {
      songs,
      total,
      filtered: songs.length
    }
  }

  /**
   * Get all personal songs for a specific user
   */
  static async getPersonalSongs(userId: string, additionalFilters?: Partial<SongFilters>): Promise<SongListResponse> {
    return this.getAllSongs({
      bandId: '', // Not used for personal songs
      contextType: 'personal',
      contextId: userId,
      ...additionalFilters
    })
  }

  /**
   * Get all band songs for a specific band
   */
  static async getBandSongs(bandId: string, additionalFilters?: Partial<SongFilters>): Promise<SongListResponse> {
    return this.getAllSongs({
      bandId,
      contextType: 'band',
      contextId: bandId,
      ...additionalFilters
    })
  }

  /**
   * Get all songs accessible by a user (personal + bands they're in)
   */
  static async getUserAccessibleSongs(userId: string): Promise<SongListResponse> {
    // Get user's band memberships
    const memberships = await db.bandMemberships
      .where('userId')
      .equals(userId)
      .and(m => m.status === 'active')
      .toArray()

    const bandIds = memberships.map(m => m.bandId)

    // Get all songs for this user (personal + all their bands)
    const songs = await db.songs
      .filter(song => {
        // Personal songs
        if (song.contextType === 'personal' && song.contextId === userId) {
          return true
        }
        // Band songs from bands the user is in
        if (song.contextType === 'band' && bandIds.includes(song.contextId)) {
          return true
        }
        return false
      })
      .toArray()

    return {
      songs: songs.sort((a, b) => a.title.localeCompare(b.title)),
      total: songs.length,
      filtered: songs.length
    }
  }

  static async createSong(songData: CreateSongRequest): Promise<Song> {
    // Validate required fields
    this.validateSongData(songData)

    // Check for duplicate song
    const existingSong = await db.songs
      .where('title')
      .equals(songData.title)
      .and(song => song.artist === songData.artist)
      .first()

    if (existingSong) {
      throw new Error('Song already exists')
    }

    const newSong: Song = {
      id: crypto.randomUUID(),
      title: songData.title,
      artist: songData.artist,
      album: songData.album,
      duration: songData.duration,
      key: songData.key,
      bpm: songData.bpm,
      difficulty: songData.difficulty,
      guitarTuning: songData.guitarTuning,
      structure: [],
      lyrics: songData.lyrics,
      chords: songData.chords || [],
      notes: songData.notes,
      referenceLinks: songData.referenceLinks || [],
      tags: songData.tags || [],
      createdDate: new Date(),
      confidenceLevel: 1,
      contextType: songData.contextType || 'band',
      contextId: songData.contextId || songData.bandId,
      createdBy: songData.createdBy,
      visibility: songData.visibility || 'band_only'
    }

    await db.songs.add(newSong)
    return newSong
  }

  static async getSongById(songId: string): Promise<Song | null> {
    const song = await db.songs.get(songId)
    return song || null
  }

  static async updateSong(songId: string, updateData: Partial<Song>): Promise<Song> {
    const existingSong = await this.getSongById(songId)
    if (!existingSong) {
      throw new Error('Song not found')
    }

    // Validate update data if provided
    if (updateData.bpm !== undefined) {
      this.validateBpm(updateData.bpm)
    }
    if (updateData.difficulty !== undefined) {
      this.validateDifficulty(updateData.difficulty)
    }
    if (updateData.key !== undefined) {
      this.validateKey(updateData.key)
    }

    await db.songs.update(songId, updateData)
    return await this.getSongById(songId) as Song
  }

  static async deleteSong(songId: string): Promise<void> {
    const song = await this.getSongById(songId)
    if (!song) {
      throw new Error('Song not found')
    }

    // Check if song is used in any setlists
    const setlistsWithSong = await db.setlists
      .filter(setlist => setlist.songs.some(s => s.songId === songId))
      .toArray()

    if (setlistsWithSong.length > 0) {
      throw new Error('Cannot delete song: used in setlists')
    }

    await db.songs.delete(songId)
  }

  static async submitConfidenceRating(songId: string, rating: ConfidenceRating): Promise<{ averageConfidence: number, totalRatings: number }> {
    const song = await this.getSongById(songId)
    if (!song) {
      throw new Error('Song not found')
    }

    // Validate confidence rating
    if (rating.confidence < 1 || rating.confidence > 5) {
      throw new Error('Confidence rating must be between 1 and 5')
    }

    // For now, we'll update the song's overall confidence level
    // In a real implementation, we'd store individual member ratings
    const newConfidence = rating.confidence
    await db.songs.update(songId, {
      confidenceLevel: newConfidence,
      lastPracticed: new Date()
    })

    return {
      averageConfidence: newConfidence,
      totalRatings: 1
    }
  }

  private static validateSongData(songData: CreateSongRequest): void {
    if (!songData.title || songData.title.trim().length === 0) {
      throw new Error('Song title is required')
    }
    if (songData.title.length > 100) {
      throw new Error('Song title cannot exceed 100 characters')
    }
    if (!songData.artist || songData.artist.trim().length === 0) {
      throw new Error('Artist name is required')
    }
    if (songData.artist.length > 100) {
      throw new Error('Artist name cannot exceed 100 characters')
    }
    if (songData.duration <= 0) {
      throw new Error('Duration must be positive')
    }

    this.validateBpm(songData.bpm)
    this.validateDifficulty(songData.difficulty)
    this.validateKey(songData.key)
  }

  private static validateBpm(bpm: number): void {
    if (bpm < 40 || bpm > 300) {
      throw new Error('BPM must be between 40 and 300')
    }
  }

  private static validateDifficulty(difficulty: number): void {
    if (difficulty < 1 || difficulty > 5) {
      throw new Error('Difficulty must be between 1 and 5')
    }
  }

  private static validateKey(key: string): void {
    const keyPattern = /^[A-G](#|b)?m?$/
    if (!keyPattern.test(key)) {
      throw new Error('Invalid musical key format')
    }
  }
}