/**
 * Casting Suggestion Service
 *
 * Provides intelligent role assignment suggestions based on:
 * - Member capabilities and proficiency levels
 * - Historical assignment patterns
 * - Song requirements and context (acoustic vs electric)
 * - Member availability and workload balance
 */

import { db } from '../database'
import { memberCapabilityService } from '../MemberCapabilityService'
import { CastingSuggestion, RoleType } from '../../models/SongCasting'
import { Song } from '../../models/Song'

export class CastingSuggestionService {
  /**
   * Get suggested role assignments for a song
   */
  async getSuggestionsForSong(
    songId: number,
    bandId: string,
    contextType: 'acoustic' | 'electric' | 'practice' | 'custom' = 'electric'
  ): Promise<CastingSuggestion[]> {
    const song = await db.songs.get(songId)
    if (!song) return []

    // Get all band members
    const memberships = await db.bandMemberships
      .where({ bandId, status: 'active' })
      .toArray()

    const suggestions: CastingSuggestion[] = []

    // Determine required roles based on song and context
    const requiredRoles = this.determineRequiredRoles(song, contextType)

    for (const role of requiredRoles) {
      const roleSuggestions = await this.getSuggestionsForRole(
        role,
        memberships.map(m => m.userId),
        bandId,
        songId
      )

      suggestions.push(...roleSuggestions)
    }

    return suggestions
  }

  /**
   * Get suggested members for a specific role
   */
  private async getSuggestionsForRole(
    roleType: RoleType,
    memberIds: string[],
    bandId: string,
    songId: number
  ): Promise<CastingSuggestion[]> {
    const suggestions: CastingSuggestion[] = []

    for (const memberId of memberIds) {
      const capability = await memberCapabilityService.getCapability(
        memberId,
        bandId,
        roleType
      )

      if (capability) {
        // Calculate confidence score based on multiple factors
        const confidence = await this.calculateConfidence(
          memberId,
          roleType,
          bandId,
          songId,
          capability.proficiencyLevel
        )

        const reason = this.generateReason(capability, roleType)

        suggestions.push({
          songId,
          memberId,
          roleType,
          confidence,
          reason,
          isPrimary: capability.isPrimary,
        })
      }
    }

    // Sort by confidence (highest first)
    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Calculate confidence score for a member/role combination
   */
  private async calculateConfidence(
    memberId: string,
    roleType: RoleType,
    bandId: string,
    _songId: number,
    proficiencyLevel: number
  ): Promise<number> {
    let score = 0

    // Factor 1: Proficiency level (0-0.5 points)
    score += (proficiencyLevel / 5) * 0.5

    // Factor 2: Historical performance (0-0.3 points)
    const historyScore = await this.getHistoryScore(memberId, roleType)
    score += historyScore * 0.3

    // Factor 3: Primary role bonus (0-0.2 points)
    const primaryRole = await memberCapabilityService.getPrimaryRole(
      memberId,
      bandId
    )
    if (primaryRole && primaryRole.roleType === roleType) {
      score += 0.2
    }

    return Math.min(1, score)
  }

  /**
   * Get historical performance score from past assignments
   */
  private async getHistoryScore(
    memberId: string,
    roleType: RoleType
  ): Promise<number> {
    const assignments = await db.songAssignments.where({ memberId }).toArray()

    let roleCount = 0
    let totalConfidence = 0

    for (const assignment of assignments) {
      if (assignment.id) {
        const roles = await db.assignmentRoles
          .where({ assignmentId: assignment.id, type: roleType })
          .toArray()

        if (roles.length > 0) {
          roleCount++
          totalConfidence += assignment.confidence
        }
      }
    }

    if (roleCount === 0) return 0

    const avgConfidence = totalConfidence / roleCount
    return avgConfidence / 5 // Normalize to 0-1
  }

  /**
   * Generate human-readable reason for suggestion
   */
  private generateReason(capability: any, _roleType: RoleType): string {
    const proficiencyLabels = [
      'Beginner',
      'Novice',
      'Intermediate',
      'Advanced',
      'Expert',
    ]
    const proficiency = proficiencyLabels[capability.proficiencyLevel - 1]

    if (capability.isPrimary) {
      return `Primary role - ${proficiency} level`
    }

    if (capability.yearsExperience) {
      return `${proficiency} - ${capability.yearsExperience}+ years experience`
    }

    return `${proficiency} proficiency`
  }

  /**
   * Determine required roles based on song and context
   */
  private determineRequiredRoles(song: Song, contextType: string): RoleType[] {
    const baseRoles: RoleType[] = []

    // Always need lead vocals (unless instrumental)
    if (!song.notes?.toLowerCase().includes('instrumental')) {
      baseRoles.push('vocals_lead')
    }

    // Context-specific roles
    if (contextType === 'acoustic') {
      baseRoles.push('guitar_acoustic')
      // Acoustic sets often have simpler arrangements
      if (song.notes?.toLowerCase().includes('harmony')) {
        baseRoles.push('vocals_harmony')
      }
    } else {
      // Electric/full band
      baseRoles.push('guitar_lead', 'guitar_rhythm', 'bass', 'drums')

      // Add backing vocals for full band
      baseRoles.push('vocals_backing')

      // Check for keyboard parts
      if (
        song.notes?.toLowerCase().includes('piano') ||
        song.notes?.toLowerCase().includes('keys')
      ) {
        baseRoles.push('keys_piano')
      }
    }

    return baseRoles
  }

  /**
   * Get alternative suggestions for a role
   */
  async getAlternatives(
    songId: number,
    roleType: RoleType,
    bandId: string,
    excludeMemberId?: string
  ): Promise<CastingSuggestion[]> {
    const memberships = await db.bandMemberships
      .where({ bandId, status: 'active' })
      .toArray()

    const memberIds = memberships
      .map(m => m.userId)
      .filter(id => id !== excludeMemberId)

    const suggestions = await this.getSuggestionsForRole(
      roleType,
      memberIds,
      bandId,
      songId
    )

    return suggestions.slice(0, 3) // Return top 3 alternatives
  }

  /**
   * Suggest complete casting for a setlist
   */
  async suggestSetlistCasting(
    setlistId: string,
    bandId: string,
    contextType: 'acoustic' | 'electric' | 'practice' | 'custom' = 'electric'
  ) {
    const setlist = await db.setlists.where({ id: setlistId }).first()

    if (!setlist || !setlist.songs) return []

    const suggestions = []

    for (const setlistSong of setlist.songs) {
      const songId = parseInt(setlistSong.songId)
      const songSuggestions = await this.getSuggestionsForSong(
        songId,
        bandId,
        contextType
      )
      suggestions.push({
        songId,
        suggestions: songSuggestions,
      })
    }

    return suggestions
  }

  /**
   * Balance workload across setlist
   */
  async balanceSetlistWorkload(
    setlistId: string,
    bandId: string,
    contextType: 'acoustic' | 'electric' | 'practice' | 'custom' = 'electric'
  ) {
    const suggestions = await this.suggestSetlistCasting(
      setlistId,
      bandId,
      contextType
    )

    // Count assignments per member
    const workload: Record<string, number> = {}

    for (const songSug of suggestions) {
      // Get top suggestion for each role
      const assignedRoles = new Set<RoleType>()

      for (const sug of songSug.suggestions) {
        if (!assignedRoles.has(sug.roleType)) {
          workload[sug.memberId] = (workload[sug.memberId] || 0) + 1
          assignedRoles.add(sug.roleType)
        }
      }
    }

    return workload
  }

  /**
   * Detect conflicts in casting (one member assigned to multiple roles they can't handle)
   */
  async detectConflicts(
    _songId: number,
    assignments: CastingSuggestion[]
  ): Promise<string[]> {
    const conflicts: string[] = []

    // Check if same member assigned to conflicting roles
    const memberRoles: Record<string, RoleType[]> = {}

    for (const assignment of assignments) {
      if (!memberRoles[assignment.memberId]) {
        memberRoles[assignment.memberId] = []
      }
      memberRoles[assignment.memberId].push(assignment.roleType)
    }

    // Drums + any other physical instrument is usually a conflict
    for (const [memberId, roles] of Object.entries(memberRoles)) {
      if (
        roles.includes('drums') &&
        roles.some(
          r => r.startsWith('guitar') || r === 'bass' || r.startsWith('keys')
        )
      ) {
        conflicts.push(
          `Member ${memberId} assigned to drums and another physical instrument`
        )
      }
    }

    return conflicts
  }
}

export const castingSuggestionService = new CastingSuggestionService()
