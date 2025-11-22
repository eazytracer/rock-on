/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from './database' // Keep for entities not yet in repository (bandMemberships)
import { repository } from './data/RepositoryFactory'
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
  visibility?: 'personal' | 'band' | 'public'
}

export interface ConfidenceRating {
  memberId: string
  confidence: 1 | 2 | 3 | 4 | 5
  feedback?: string
}

export class SongService {
  static async getAllSongs(filters: SongFilters): Promise<SongListResponse> {
    // Use repository with supported filters (contextType, contextId)
    const repoFilter: any = {}
    if (filters.contextType) {
      repoFilter.contextType = filters.contextType
    }
    if (filters.contextId) {
      repoFilter.contextId = filters.contextId
    }

    // Fetch from repository
    let songs = await repository.getSongs(repoFilter)

    // Apply client-side filters for unsupported filters
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      songs = songs.filter(
        song =>
          song.title.toLowerCase().includes(searchTerm) ||
          song.artist.toLowerCase().includes(searchTerm)
      )
    }

    if (filters.key) {
      songs = songs.filter(song => song.key === filters.key)
    }

    if (filters.difficulty) {
      songs = songs.filter(song => song.difficulty === filters.difficulty)
    }

    if (filters.tags && filters.tags.length > 0) {
      songs = songs.filter(song =>
        filters.tags!.some(tag => song.tags.includes(tag))
      )
    }

    // Sort by title (repository doesn't guarantee order)
    songs.sort((a, b) => a.title.localeCompare(b.title))

    return {
      songs,
      total: songs.length,
      filtered: songs.length,
    }
  }

  /**
   * Get all personal songs for a specific user
   */
  static async getPersonalSongs(
    userId: string,
    additionalFilters?: Partial<SongFilters>
  ): Promise<SongListResponse> {
    return this.getAllSongs({
      bandId: '', // Not used for personal songs
      contextType: 'personal',
      contextId: userId,
      ...additionalFilters,
    })
  }

  /**
   * Get all band songs for a specific band
   */
  static async getBandSongs(
    bandId: string,
    additionalFilters?: Partial<SongFilters>
  ): Promise<SongListResponse> {
    return this.getAllSongs({
      bandId,
      contextType: 'band',
      contextId: bandId,
      ...additionalFilters,
    })
  }

  /**
   * Get all songs accessible by a user (personal + bands they're in)
   */
  static async getUserAccessibleSongs(
    userId: string
  ): Promise<SongListResponse> {
    // Get user's band memberships (keep using db.bandMemberships until it's in repository)
    const memberships = await db.bandMemberships
      .where('userId')
      .equals(userId)
      .and(m => m.status === 'active')
      .toArray()

    const bandIds = memberships.map(m => m.bandId)

    // Get personal songs from repository
    const personalSongs = await repository.getSongs({
      contextType: 'personal',
      contextId: userId,
    })

    // Get band songs from repository
    const bandSongsPromises = bandIds.map(bandId =>
      repository.getSongs({
        contextType: 'band',
        contextId: bandId,
      })
    )
    const bandSongsArrays = await Promise.all(bandSongsPromises)
    const bandSongs = bandSongsArrays.flat()

    // Combine and sort
    const songs = [...personalSongs, ...bandSongs].sort((a, b) =>
      a.title.localeCompare(b.title)
    )

    return {
      songs,
      total: songs.length,
      filtered: songs.length,
    }
  }

  static async createSong(songData: CreateSongRequest): Promise<Song> {
    // Validate required fields
    this.validateSongData(songData)

    // Check for duplicate song (fetch all and check client-side for now)
    const allSongs = await repository.getSongs({})
    const existingSong = allSongs.find(
      song => song.title === songData.title && song.artist === songData.artist
    )

    if (existingSong) {
      throw new Error('Song already exists')
    }

    // Create song via repository
    const newSong = await repository.addSong({
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
      visibility: songData.visibility || 'band', // Default to 'band' for MVP
    })

    return newSong
  }

  static async getSongById(songId: string): Promise<Song | null> {
    const songs = await repository.getSongs({ id: songId })
    return songs[0] || null
  }

  static async updateSong(
    songId: string,
    updateData: Partial<Song>
  ): Promise<Song> {
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

    await repository.updateSong(songId, updateData)
    return (await this.getSongById(songId)) as Song
  }

  static async deleteSong(songId: string): Promise<void> {
    const song = await this.getSongById(songId)
    if (!song) {
      throw new Error('Song not found')
    }

    // Check if song is used in any setlists
    const allSetlists = await repository.getSetlists(song.contextId)
    const setlistsWithSong = allSetlists.filter(setlist =>
      setlist.items.some(item => item.type === 'song' && item.songId === songId)
    )

    if (setlistsWithSong.length > 0) {
      throw new Error('Cannot delete song: used in setlists')
    }

    await repository.deleteSong(songId)
  }

  static async submitConfidenceRating(
    songId: string,
    rating: ConfidenceRating
  ): Promise<{ averageConfidence: number; totalRatings: number }> {
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
    await repository.updateSong(songId, {
      confidenceLevel: newConfidence,
      lastPracticed: new Date(),
    })

    return {
      averageConfidence: newConfidence,
      totalRatings: 1,
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
