/**
 * Casting Service
 *
 * Manages role assignments for songs in different contexts (setlists, sessions, templates).
 * Provides comprehensive casting management with multi-role support.
 */

import { db } from './database'
import {
  SongCasting,
  SongAssignment,
  AssignmentRole,
  RoleType,
  CastingStats
} from '../models/SongCasting'

export class CastingService {
  /**
   * Create a new casting for a song in a specific context
   */
  async createCasting(casting: Omit<SongCasting, 'id'>): Promise<number> {
    const castingId = await db.songCastings.add({
      ...casting,
      createdDate: new Date()
    })
    return castingId as number
  }

  /**
   * Get casting for a song in a specific context
   */
  async getCasting(contextType: string, contextId: string, songId: number): Promise<SongCasting | undefined> {
    return await db.songCastings
      .where('[contextType+contextId+songId]')
      .equals([contextType, contextId, songId])
      .first()
  }

  /**
   * Get all castings for a context (e.g., all songs in a setlist)
   */
  async getCastingsForContext(contextType: string, contextId: string): Promise<SongCasting[]> {
    return await db.songCastings
      .where({ contextType, contextId })
      .toArray()
  }

  /**
   * Delete a casting and all its assignments
   */
  async deleteCasting(castingId: number): Promise<void> {
    // Get all assignments for this casting
    const assignments = await db.songAssignments
      .where({ songCastingId: castingId })
      .toArray()

    // Delete all assignment roles
    for (const assignment of assignments) {
      if (assignment.id) {
        await db.assignmentRoles
          .where({ assignmentId: assignment.id })
          .delete()
      }
    }

    // Delete all assignments
    await db.songAssignments.where({ songCastingId: castingId }).delete()

    // Delete the casting
    await db.songCastings.delete(castingId)
  }

  /**
   * Assign a member to a song with specific roles
   */
  async assignMember(
    songCastingId: number,
    memberId: string,
    roles: Omit<AssignmentRole, 'id' | 'assignmentId'>[],
    isPrimary: boolean = true,
    confidence: number = 3,
    notes?: string,
    addedBy?: string
  ): Promise<number> {
    // Create the assignment
    const assignmentId = await db.songAssignments.add({
      songCastingId,
      memberId,
      isPrimary,
      confidence,
      notes,
      addedBy: addedBy || memberId,
      addedDate: new Date()
    })

    // Add all roles to the assignment
    const assignmentIdNum = assignmentId as number
    for (const role of roles) {
      await db.assignmentRoles.add({
        assignmentId: assignmentIdNum,
        ...role
      })
    }

    return assignmentIdNum
  }

  /**
   * Update an assignment's confidence or notes
   */
  async updateAssignment(
    assignmentId: number,
    updates: {
      confidence?: number
      notes?: string
      isPrimary?: boolean
    }
  ): Promise<void> {
    await db.songAssignments.update(assignmentId, {
      ...updates,
      updatedDate: new Date()
    })
  }

  /**
   * Add a role to an existing assignment
   */
  async addRoleToAssignment(
    assignmentId: number,
    role: Omit<AssignmentRole, 'id' | 'assignmentId'>
  ): Promise<number> {
    const roleId = await db.assignmentRoles.add({
      assignmentId,
      ...role
    })
    return roleId as number
  }

  /**
   * Remove a role from an assignment
   */
  async removeRoleFromAssignment(roleId: number): Promise<void> {
    await db.assignmentRoles.delete(roleId)
  }

  /**
   * Get all assignments for a casting
   */
  async getAssignments(songCastingId: number): Promise<SongAssignment[]> {
    return await db.songAssignments
      .where({ songCastingId })
      .toArray()
  }

  /**
   * Get all roles for an assignment
   */
  async getRoles(assignmentId: number): Promise<AssignmentRole[]> {
    return await db.assignmentRoles
      .where({ assignmentId })
      .toArray()
  }

  /**
   * Get complete casting details including assignments and roles
   */
  async getCompleteCasting(castingId: number) {
    const casting = await db.songCastings.get(castingId)
    if (!casting) return null

    const assignments = await this.getAssignments(castingId)

    const assignmentsWithRoles = await Promise.all(
      assignments.map(async (assignment) => ({
        ...assignment,
        roles: assignment.id ? await this.getRoles(assignment.id) : []
      }))
    )

    return {
      ...casting,
      assignments: assignmentsWithRoles
    }
  }

  /**
   * Get all assignments for a member in a context
   */
  async getMemberAssignments(memberId: string, contextType: string, contextId: string) {
    const castings = await this.getCastingsForContext(contextType, contextId)
    const castingIds = castings.map(c => c.id).filter((id): id is number => id !== undefined)

    const assignments = await db.songAssignments
      .where('songCastingId')
      .anyOf(castingIds)
      .and(a => a.memberId === memberId)
      .toArray()

    const assignmentsWithRoles = await Promise.all(
      assignments.map(async (assignment) => {
        const roles = assignment.id ? await this.getRoles(assignment.id) : []
        const casting = await db.songCastings.get(assignment.songCastingId)
        const song = casting ? await db.songs.get(casting.songId) : null

        return {
          ...assignment,
          roles,
          casting,
          song
        }
      })
    )

    return assignmentsWithRoles
  }

  /**
   * Remove a member from a casting
   */
  async unassignMember(songCastingId: number, memberId: string): Promise<void> {
    const assignments = await db.songAssignments
      .where({ songCastingId, memberId })
      .toArray()

    for (const assignment of assignments) {
      if (assignment.id) {
        // Delete all roles for this assignment
        await db.assignmentRoles
          .where({ assignmentId: assignment.id })
          .delete()

        // Delete the assignment
        await db.songAssignments.delete(assignment.id)
      }
    }
  }

  /**
   * Copy casting from one context to another
   */
  async copyCasting(
    sourceContextType: 'setlist' | 'session' | 'template',
    sourceContextId: string,
    targetContextType: 'setlist' | 'session' | 'template',
    targetContextId: string,
    createdBy: string
  ): Promise<void> {
    const sourceCastings = await this.getCastingsForContext(sourceContextType, sourceContextId)

    for (const sourceCasting of sourceCastings) {
      // Create new casting in target context
      const newCastingId = await this.createCasting({
        contextType: targetContextType,
        contextId: targetContextId,
        songId: sourceCasting.songId,
        createdBy,
        createdDate: new Date(),
        notes: sourceCasting.notes
      })

      // Copy all assignments
      if (sourceCasting.id) {
        const assignments = await this.getAssignments(sourceCasting.id)

        for (const assignment of assignments) {
          const roles = assignment.id ? await this.getRoles(assignment.id) : []

          await this.assignMember(
            newCastingId,
            assignment.memberId,
            roles,
            assignment.isPrimary,
            assignment.confidence,
            assignment.notes,
            createdBy
          )
        }
      }
    }
  }

  /**
   * Get casting statistics for a member
   */
  async getMemberStats(memberId: string, bandId: string): Promise<CastingStats> {
    const memberships = await db.bandMemberships
      .where({ userId: memberId, bandId })
      .toArray()

    if (memberships.length === 0) {
      return {
        memberId,
        totalAssignments: 0,
        primaryAssignments: 0,
        roleBreakdown: {} as Record<RoleType, number>,
        averageConfidence: 0,
        mostCommonRole: 'other' as RoleType
      }
    }

    // Get all assignments for this member
    const assignments = await db.songAssignments
      .where({ memberId })
      .toArray()

    const totalAssignments = assignments.length
    const primaryAssignments = assignments.filter(a => a.isPrimary).length
    const averageConfidence = totalAssignments > 0
      ? assignments.reduce((sum, a) => sum + a.confidence, 0) / totalAssignments
      : 0

    // Get role breakdown
    const roleBreakdown: Record<RoleType, number> = {} as Record<RoleType, number>
    for (const assignment of assignments) {
      if (assignment.id) {
        const roles = await this.getRoles(assignment.id)
        for (const role of roles) {
          roleBreakdown[role.type] = (roleBreakdown[role.type] || 0) + 1
        }
      }
    }

    // Find most common role
    let mostCommonRole: RoleType = 'other'
    let maxCount = 0
    for (const [role, count] of Object.entries(roleBreakdown)) {
      if (count > maxCount) {
        maxCount = count
        mostCommonRole = role as RoleType
      }
    }

    return {
      memberId,
      totalAssignments,
      primaryAssignments,
      roleBreakdown,
      averageConfidence,
      mostCommonRole
    }
  }

  /**
   * Bulk assign roles to multiple members for a song
   */
  async bulkAssign(
    castingId: number,
    assignments: {
      memberId: string
      roles: Omit<AssignmentRole, 'id' | 'assignmentId'>[]
      isPrimary?: boolean
      confidence?: number
      notes?: string
    }[],
    addedBy: string
  ): Promise<void> {
    for (const assignment of assignments) {
      await this.assignMember(
        castingId,
        assignment.memberId,
        assignment.roles,
        assignment.isPrimary ?? true,
        assignment.confidence ?? 3,
        assignment.notes,
        addedBy
      )
    }
  }

  /**
   * Check if a member is assigned to a song in a context
   */
  async isMemberAssigned(
    songCastingId: number,
    memberId: string
  ): Promise<boolean> {
    const count = await db.songAssignments
      .where({ songCastingId, memberId })
      .count()
    return count > 0
  }

  /**
   * Get all unassigned songs in a context
   */
  async getUnassignedSongs(
    contextType: string,
    contextId: string,
    allSongIds: number[]
  ): Promise<number[]> {
    const castings = await this.getCastingsForContext(contextType, contextId)
    const assignedSongIds = castings.map(c => c.songId)

    return allSongIds.filter(id => !assignedSongIds.includes(id))
  }
}

export const castingService = new CastingService()
