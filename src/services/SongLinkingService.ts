/**
 * SongLinkingService
 *
 * Copies a band song into the caller's personal catalog (and vice-versa is
 * parked). The copy sets `linkedFromSongId` so the UI can show a "mirrored to
 * personal / linked to band" badge — that field is a real synced song column,
 * so the link survives refresh and other devices.
 *
 * NOTE (2026-09-14, Phase 2 data-layer simplification): the former
 * `song_groups`/`song_group_memberships` linking machinery + fuzzy suggestion
 * engine was removed. It was an incomplete, unreachable feature whose group
 * records only ever wrote to IndexedDB (never Supabase). The long-term
 * cross-catalog matching intent is parked in
 * `.claude/backlog/cross-catalog-song-matching/2026-09-14_parked-idea.md`.
 */

import { repository } from './data/RepositoryFactory'
import { Song } from '../models/Song'

export class SongLinkingService {
  /**
   * Copy a band song into the caller's personal catalog.
   * Creates a personal-context duplicate with `linkedFromSongId` pointing back
   * at the source band song, written through the repository so it persists to
   * Supabase.
   */
  static async copyBandSongToPersonal(
    bandSongId: string,
    userId: string
  ): Promise<{ personalSongId: string }> {
    const bandSong = await repository.getSong(bandSongId)
    if (!bandSong) {
      throw new Error('Band song not found')
    }

    if (bandSong.contextType !== 'band') {
      throw new Error('Song must be a band song')
    }

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

    await repository.addSong(personalSong)

    return { personalSongId }
  }
}
