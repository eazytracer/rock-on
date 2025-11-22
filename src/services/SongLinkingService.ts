/**
 * SongLinkingService
 *
 * Manages relationships between song variants across different contexts (personal/band).
 * Handles song group creation, linking, and suggestions for related songs.
 */

import { db } from './database'
import { Song } from '../models/Song'
import { SongGroup } from '../models/SongGroup'

export interface LinkingSuggestion {
  song: Song
  targetSong: Song
  confidence: 'high' | 'medium' | 'low'
  reason: string
  matchType: 'exact' | 'similar_title' | 'same_artist'
}

export class SongLinkingService {
  /**
   * Create a new song group to link related variants
   */
  static async createSongGroup(
    name: string,
    createdBy: string,
    description?: string
  ): Promise<string> {
    const groupId = crypto.randomUUID()

    await db.songGroups.add({
      id: groupId,
      name,
      createdBy,
      description,
      createdDate: new Date().toISOString(),
    })

    return groupId
  }

  /**
   * Link a song to a song group
   */
  static async linkSongToGroup(
    songId: string,
    songGroupId: string,
    addedBy: string,
    relationship: 'original' | 'variant' | 'arrangement' | 'cover' = 'variant',
    notes?: string
  ): Promise<string> {
    const membershipId = crypto.randomUUID()

    await db.songGroupMemberships.add({
      id: membershipId,
      songId,
      songGroupId,
      addedBy,
      addedDate: new Date().toISOString(),
      relationship,
      notes,
    })

    // Update the song's songGroupId field
    await db.songs.update(songId, { songGroupId })

    return membershipId
  }

  /**
   * Create a song group and link multiple songs at once
   */
  static async linkSongs(
    songIds: string[],
    groupName: string,
    createdBy: string,
    description?: string
  ): Promise<string> {
    const groupId = await this.createSongGroup(
      groupName,
      createdBy,
      description
    )

    // Link all songs to the group
    for (let i = 0; i < songIds.length; i++) {
      const songId = songIds[i]
      const relationship = i === 0 ? 'original' : 'variant'
      await this.linkSongToGroup(songId, groupId, createdBy, relationship)
    }

    return groupId
  }

  /**
   * Get all songs in a song group
   */
  static async getSongsInGroup(
    songGroupId: string
  ): Promise<Array<Song & { relationship: string; notes?: string }>> {
    const memberships = await db.songGroupMemberships
      .where('songGroupId')
      .equals(songGroupId)
      .toArray()

    const songsWithMetadata = await Promise.all(
      memberships.map(async membership => {
        const song = await db.songs.get(membership.songId)
        if (!song) return null

        return {
          ...song,
          relationship: membership.relationship,
          notes: membership.notes,
        }
      })
    )

    return songsWithMetadata.filter(
      (s): s is NonNullable<typeof s> => s !== null
    ) as Array<Song & { relationship: string; notes?: string }>
  }

  /**
   * Get the song group for a specific song
   */
  static async getSongGroup(songId: string): Promise<SongGroup | null> {
    const song = await db.songs.get(songId)
    if (!song?.songGroupId) return null

    const group = await db.songGroups.get(song.songGroupId)
    return group || null
  }

  /**
   * Find potential song variants to link
   * Returns suggestions based on title and artist matching
   */
  static async findLinkingSuggestions(
    song: Song,
    _userId?: string
  ): Promise<LinkingSuggestion[]> {
    const suggestions: LinkingSuggestion[] = []

    // Get all songs from different contexts (not the same song)
    const allSongs = await db.songs.toArray()

    console.log('[SongLinkingService] Finding suggestions for:', {
      title: song.title,
      artist: song.artist,
      contextType: song.contextType,
      contextId: song.contextId,
      totalSongsInDB: allSongs.length,
    })

    for (const targetSong of allSongs) {
      // Skip the same song
      if (targetSong.id === song.id) continue

      // Skip songs already in the same group
      if (song.songGroupId && targetSong.songGroupId === song.songGroupId)
        continue

      // Skip songs from the same context
      if (
        song.contextType === targetSong.contextType &&
        song.contextId === targetSong.contextId
      )
        continue

      const titleMatch = this.calculateTitleSimilarity(
        song.title,
        targetSong.title
      )
      const artistMatch =
        song.artist.toLowerCase() === targetSong.artist.toLowerCase()

      console.log('[SongLinkingService] Comparing with:', {
        targetTitle: targetSong.title,
        targetArtist: targetSong.artist,
        targetContext: targetSong.contextType,
        targetContextId: targetSong.contextId,
        titleMatch,
        artistMatch,
      })

      if (titleMatch === 'exact' && artistMatch) {
        suggestions.push({
          song,
          targetSong,
          confidence: 'high',
          reason: `Same song "${song.title}" by ${song.artist} in different context`,
          matchType: 'exact',
        })
      } else if (titleMatch === 'similar' && artistMatch) {
        suggestions.push({
          song,
          targetSong,
          confidence: 'medium',
          reason: `Similar title and same artist (${song.artist})`,
          matchType: 'similar_title',
        })
      } else if (titleMatch === 'exact' && !artistMatch) {
        suggestions.push({
          song,
          targetSong,
          confidence: 'low',
          reason: `Same title but different artist`,
          matchType: 'exact',
        })
      }
    }

    return suggestions.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 }
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence]
    })
  }

  /**
   * Calculate similarity between two song titles
   */
  private static calculateTitleSimilarity(
    title1: string,
    title2: string
  ): 'exact' | 'similar' | 'different' {
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')

    const norm1 = normalize(title1)
    const norm2 = normalize(title2)

    if (norm1 === norm2) return 'exact'

    // Check if one contains the other (e.g., "Wonderwall" vs "Wonderwall (Acoustic)")
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 'similar'

    // Check Levenshtein distance for minor differences
    const distance = this.levenshteinDistance(norm1, norm2)
    const maxLength = Math.max(norm1.length, norm2.length)
    const similarity = 1 - distance / maxLength

    if (similarity > 0.8) return 'similar'

    return 'different'
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Unlink a song from its group
   */
  static async unlinkSongFromGroup(songId: string): Promise<void> {
    const memberships = await db.songGroupMemberships
      .where('songId')
      .equals(songId)
      .toArray()

    // Delete all memberships for this song
    for (const membership of memberships) {
      await db.songGroupMemberships.delete(membership.id!)
    }

    // Remove songGroupId from the song
    await db.songs.update(songId, { songGroupId: undefined })
  }

  /**
   * Delete a song group (unlinks all songs but doesn't delete them)
   */
  static async deleteSongGroup(songGroupId: string): Promise<void> {
    // Get all memberships
    const memberships = await db.songGroupMemberships
      .where('songGroupId')
      .equals(songGroupId)
      .toArray()

    // Unlink all songs
    for (const membership of memberships) {
      await db.songs.update(membership.songId, { songGroupId: undefined })
      await db.songGroupMemberships.delete(membership.id!)
    }

    // Delete the group
    await db.songGroups.delete(songGroupId)
  }

  /**
   * Contribute a personal song to a band catalog
   * Creates a copy of the song in the band context and links them
   */
  static async contributePersonalSongToBand(
    personalSongId: string,
    bandId: string,
    userId: string
  ): Promise<{ bandSongId: string; groupId: string }> {
    const personalSong = await db.songs.get(personalSongId)
    if (!personalSong) {
      throw new Error('Personal song not found')
    }

    if (personalSong.contextType !== 'personal') {
      throw new Error('Song must be a personal song')
    }

    // Create a copy of the song in the band context
    const bandSongId = crypto.randomUUID()
    const bandSong: Song = {
      ...personalSong,
      id: bandSongId,
      contextType: 'band',
      contextId: bandId,
      createdBy: userId,
      linkedFromSongId: personalSongId,
      createdDate: new Date(),
    }

    await db.songs.add(bandSong)

    // Create or use existing song group
    let groupId: string
    if (personalSong.songGroupId) {
      // Use existing group
      groupId = personalSong.songGroupId
      await this.linkSongToGroup(
        bandSongId,
        groupId,
        userId,
        'variant',
        'Contributed from personal catalog'
      )
    } else {
      // Create new group with both songs
      groupId = await this.linkSongs(
        [personalSongId, bandSongId],
        personalSong.title,
        userId,
        `Personal and band versions of "${personalSong.title}"`
      )
    }

    return { bandSongId, groupId }
  }

  /**
   * Copy a band song to personal catalog
   * Creates a copy of the song in the personal context and links them
   */
  static async copyBandSongToPersonal(
    bandSongId: string,
    userId: string
  ): Promise<{ personalSongId: string; groupId: string }> {
    const bandSong = await db.songs.get(bandSongId)
    if (!bandSong) {
      throw new Error('Band song not found')
    }

    if (bandSong.contextType !== 'band') {
      throw new Error('Song must be a band song')
    }

    // Create a copy of the song in the personal context
    const personalSongId = crypto.randomUUID()
    const personalSong: Song = {
      ...bandSong,
      id: personalSongId,
      contextType: 'personal',
      contextId: userId,
      createdBy: userId,
      linkedFromSongId: bandSongId,
      createdDate: new Date(),
    }

    await db.songs.add(personalSong)

    // Create or use existing song group
    let groupId: string
    if (bandSong.songGroupId) {
      // Use existing group
      groupId = bandSong.songGroupId
      await this.linkSongToGroup(
        personalSongId,
        groupId,
        userId,
        'variant',
        'Personal practice version'
      )
    } else {
      // Create new group with both songs
      groupId = await this.linkSongs(
        [bandSongId, personalSongId],
        bandSong.title,
        userId,
        `Band and personal versions of "${bandSong.title}"`
      )
    }

    return { personalSongId, groupId }
  }
}
