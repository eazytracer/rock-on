/**
 * Member Capability Service
 *
 * Tracks member skills, experience levels, and proficiency for different roles.
 * Used by CastingSuggestionService to provide intelligent role assignments.
 */

import { db } from './database'
import { MemberCapability, RoleType } from '../models/SongCasting'

export class MemberCapabilityService {
  /**
   * Add or update a member's capability for a role
   */
  async setCapability(
    capability: Omit<MemberCapability, 'id'>
  ): Promise<number> {
    // Check if capability already exists
    const existing = await db.memberCapabilities
      .where({
        userId: capability.userId,
        bandId: capability.bandId,
        roleType: capability.roleType,
      })
      .first()

    if (existing && existing.id) {
      // Update existing
      await db.memberCapabilities.update(existing.id, {
        ...capability,
        updatedDate: new Date(),
      })
      return existing.id
    } else {
      // Create new
      const id = await db.memberCapabilities.add({
        ...capability,
        updatedDate: new Date(),
      })
      return id as number
    }
  }

  /**
   * Get all capabilities for a member in a band
   */
  async getMemberCapabilities(
    userId: string,
    bandId: string
  ): Promise<MemberCapability[]> {
    return await db.memberCapabilities.where({ userId, bandId }).toArray()
  }

  /**
   * Get a specific capability
   */
  async getCapability(
    userId: string,
    bandId: string,
    roleType: RoleType
  ): Promise<MemberCapability | undefined> {
    return await db.memberCapabilities
      .where({ userId, bandId, roleType })
      .first()
  }

  /**
   * Get all members who can perform a specific role
   */
  async getMembersForRole(
    bandId: string,
    roleType: RoleType,
    minProficiency: number = 1
  ): Promise<MemberCapability[]> {
    return await db.memberCapabilities
      .where({ bandId, roleType })
      .and(c => c.proficiencyLevel >= minProficiency)
      .toArray()
  }

  /**
   * Get member's primary role
   */
  async getPrimaryRole(
    userId: string,
    bandId: string
  ): Promise<MemberCapability | undefined> {
    const capabilities = await this.getMemberCapabilities(userId, bandId)
    return capabilities.find(c => c.isPrimary)
  }

  /**
   * Set a role as the member's primary role
   */
  async setPrimaryRole(
    userId: string,
    bandId: string,
    roleType: RoleType
  ): Promise<void> {
    // Clear all current primary flags
    const capabilities = await this.getMemberCapabilities(userId, bandId)
    for (const cap of capabilities) {
      if (cap.id && cap.isPrimary) {
        await db.memberCapabilities.update(cap.id, { isPrimary: false })
      }
    }

    // Set new primary role
    const newPrimary = capabilities.find(c => c.roleType === roleType)
    if (newPrimary && newPrimary.id) {
      await db.memberCapabilities.update(newPrimary.id, { isPrimary: true })
    }
  }

  /**
   * Remove a capability
   */
  async removeCapability(capabilityId: number): Promise<void> {
    await db.memberCapabilities.delete(capabilityId)
  }

  /**
   * Auto-initialize capabilities from user profile
   */
  async initializeFromProfile(userId: string, bandId: string): Promise<void> {
    const profile = await db.userProfiles.where({ userId }).first()
    if (!profile) return

    const instruments = profile.instruments || []

    // Map instruments to role types
    const instrumentToRoleMap: Record<string, RoleType[]> = {
      Guitar: ['guitar_rhythm', 'guitar_lead'],
      'Lead Guitar': ['guitar_lead', 'guitar_rhythm'],
      'Rhythm Guitar': ['guitar_rhythm'],
      'Acoustic Guitar': ['guitar_acoustic'],
      Bass: ['bass'],
      Drums: ['drums'],
      Percussion: ['percussion'],
      Vocals: ['vocals_lead', 'vocals_backing'],
      'Lead Vocals': ['vocals_lead'],
      'Backing Vocals': ['vocals_backing'],
      Keyboards: ['keys_piano', 'keys_synth'],
      Piano: ['keys_piano'],
      Synthesizer: ['keys_synth'],
      Organ: ['keys_organ'],
    }

    // Create capabilities for each instrument
    for (const instrument of instruments) {
      const roles = instrumentToRoleMap[instrument] || []

      for (let i = 0; i < roles.length; i++) {
        const role = roles[i]
        const isPrimary = instrument === profile.primaryInstrument && i === 0

        await this.setCapability({
          userId,
          bandId,
          roleType: role,
          proficiencyLevel: 3, // Default to intermediate
          isPrimary,
          updatedDate: new Date(),
        })
      }
    }
  }

  /**
   * Bulk update capabilities for a member
   */
  async bulkUpdateCapabilities(
    userId: string,
    bandId: string,
    capabilities: {
      roleType: RoleType
      proficiencyLevel: 1 | 2 | 3 | 4 | 5
      isPrimary?: boolean
      yearsExperience?: number
      notes?: string
    }[]
  ): Promise<void> {
    for (const cap of capabilities) {
      await this.setCapability({
        userId,
        bandId,
        ...cap,
        isPrimary: cap.isPrimary || false,
        updatedDate: new Date(),
      })
    }
  }

  /**
   * Get suggested roles for a member based on their capabilities
   */
  async getSuggestedRoles(userId: string, bandId: string): Promise<RoleType[]> {
    const capabilities = await this.getMemberCapabilities(userId, bandId)

    // Sort by proficiency level (highest first) and primary flag
    return capabilities
      .sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1
        if (!a.isPrimary && b.isPrimary) return 1
        return b.proficiencyLevel - a.proficiencyLevel
      })
      .map(c => c.roleType)
  }

  /**
   * Get capability statistics for a band
   */
  async getBandCapabilityStats(bandId: string) {
    const capabilities = await db.memberCapabilities.where({ bandId }).toArray()

    const roleDistribution: Record<RoleType, number> = {} as Record<
      RoleType,
      number
    >
    const avgProficiency: Record<RoleType, number> = {} as Record<
      RoleType,
      number
    >
    const roleCounts: Record<RoleType, number> = {} as Record<RoleType, number>

    for (const cap of capabilities) {
      roleDistribution[cap.roleType] = (roleDistribution[cap.roleType] || 0) + 1
      avgProficiency[cap.roleType] =
        (avgProficiency[cap.roleType] || 0) + cap.proficiencyLevel
      roleCounts[cap.roleType] = (roleCounts[cap.roleType] || 0) + 1
    }

    // Calculate averages
    for (const role of Object.keys(avgProficiency) as RoleType[]) {
      avgProficiency[role] = avgProficiency[role] / roleCounts[role]
    }

    return {
      roleDistribution,
      avgProficiency,
      totalCapabilities: capabilities.length,
      uniqueMembers: new Set(capabilities.map(c => c.userId)).size,
    }
  }

  /**
   * Find gaps in band capabilities (roles with few or no members)
   */
  async findCapabilityGaps(
    bandId: string,
    threshold: number = 1
  ): Promise<RoleType[]> {
    const stats = await this.getBandCapabilityStats(bandId)

    const allRoles: RoleType[] = [
      'vocals_lead',
      'vocals_backing',
      'vocals_harmony',
      'guitar_lead',
      'guitar_rhythm',
      'guitar_acoustic',
      'bass',
      'drums',
      'percussion',
      'keys_piano',
      'keys_synth',
      'keys_organ',
      'other',
    ]

    return allRoles.filter(
      role => (stats.roleDistribution[role] || 0) <= threshold
    )
  }

  /**
   * Auto-detect capabilities from assignment history
   */
  async detectCapabilitiesFromHistory(
    userId: string,
    bandId: string
  ): Promise<void> {
    // Get all assignments for this member
    const assignments = await db.songAssignments
      .where({ memberId: userId })
      .toArray()

    const roleFrequency: Record<
      RoleType,
      { count: number; totalConfidence: number }
    > = {} as Record<RoleType, { count: number; totalConfidence: number }>

    for (const assignment of assignments) {
      if (assignment.id) {
        const roles = await db.assignmentRoles
          .where({ assignmentId: assignment.id })
          .toArray()

        for (const role of roles) {
          if (!roleFrequency[role.type]) {
            roleFrequency[role.type] = { count: 0, totalConfidence: 0 }
          }
          roleFrequency[role.type].count++
          roleFrequency[role.type].totalConfidence += assignment.confidence
        }
      }
    }

    // Create or update capabilities based on frequency
    for (const [roleType, freq] of Object.entries(roleFrequency)) {
      const avgConfidence = freq.totalConfidence / freq.count
      const proficiencyLevel = Math.min(
        5,
        Math.max(1, Math.round(avgConfidence))
      ) as 1 | 2 | 3 | 4 | 5

      await this.setCapability({
        userId,
        bandId,
        roleType: roleType as RoleType,
        proficiencyLevel,
        isPrimary: false, // Don't auto-set as primary
        notes: `Auto-detected from ${freq.count} assignments`,
        updatedDate: new Date(),
      })
    }
  }
}

export const memberCapabilityService = new MemberCapabilityService()
