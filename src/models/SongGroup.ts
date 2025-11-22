/**
 * SongGroup Model
 *
 * Represents a group of related song variants (e.g., personal version + band version of "Wonderwall")
 * Allows users to link different arrangements, contexts, or versions of the same song.
 */

export interface SongGroup {
  id?: string
  createdBy: string // User ID who created this group
  name: string // Display name for the group (typically the song title)
  description?: string // Optional description of what makes this a group
  createdDate: string // ISO 8601 date string
}

/**
 * SongGroupMembership Model
 *
 * Links individual songs to song groups, allowing multiple variants of the same song
 * to be tracked together while maintaining their separate contexts (personal/band).
 */
export interface SongGroupMembership {
  id?: string
  songId: string // Reference to Song.id
  songGroupId: string // Reference to SongGroup.id
  addedBy: string // User ID who added this song to the group
  addedDate: string // ISO 8601 date string
  relationship: 'original' | 'variant' | 'arrangement' | 'cover' // Type of relationship
  notes?: string // Optional notes about this variant (e.g., "Acoustic version", "Drop D tuning")
}

/**
 * Dexie Schema Definitions
 * Add these to your database schema:
 *
 * songGroups: '++id, createdBy, name, createdDate'
 * songGroupMemberships: '++id, songId, songGroupId, addedBy, addedDate'
 */
