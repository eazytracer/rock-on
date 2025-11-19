/**
 * Song Casting Models
 *
 * Enables dynamic role assignments for different performance contexts.
 * Supports multi-instrumentalist assignments and context-specific casting.
 */

/**
 * Song Casting
 *
 * Represents a casting configuration for a song in a specific context
 * (e.g., acoustic setlist, electric setlist, practice session).
 */
export interface SongCasting {
  id?: number;
  contextType: 'setlist' | 'session' | 'template';
  contextId: string;  // ID of the setlist, session, or template
  songId: number;     // ID of the song being cast
  createdBy: string;  // User ID who created the casting
  createdDate: Date;
  updatedDate?: Date;
  notes?: string;     // General casting notes
}

/**
 * Song Assignment
 *
 * Individual role assignment within a song casting.
 * A song can have multiple assignments (one per member).
 */
export interface SongAssignment {
  id?: number;
  songCastingId: number;  // References SongCasting
  memberId: string;       // User ID of assigned member
  isPrimary: boolean;     // Primary vs backup assignment
  confidence: number;     // 1-5 rating of member's confidence
  notes?: string;         // Assignment-specific notes
  addedBy: string;        // User ID who made the assignment
  addedDate: Date;
  updatedDate?: Date;
}

/**
 * Assignment Role
 *
 * Individual role within an assignment (supports multi-role per member).
 * A member can have multiple roles for the same song (e.g., guitar + vocals).
 */
export interface AssignmentRole {
  id?: number;
  assignmentId: number;   // References SongAssignment
  type: RoleType;
  name: string;           // e.g., "Lead Guitar", "Backup Vocals"
  arrangement?: string;   // Specific arrangement notes (e.g., "Drop D tuning")
  isPrimary: boolean;     // Primary role vs secondary role
}

/**
 * Role Types
 *
 * Standard musical roles that can be assigned to band members.
 */
export type RoleType =
  | 'vocals_lead'
  | 'vocals_backing'
  | 'vocals_harmony'
  | 'guitar_lead'
  | 'guitar_rhythm'
  | 'guitar_acoustic'
  | 'bass'
  | 'drums'
  | 'percussion'
  | 'keys_piano'
  | 'keys_synth'
  | 'keys_organ'
  | 'other';

/**
 * Role Display Names
 *
 * Human-readable names for role types.
 */
export const RoleDisplayNames: Record<RoleType, string> = {
  vocals_lead: 'Lead Vocals',
  vocals_backing: 'Backing Vocals',
  vocals_harmony: 'Harmony Vocals',
  guitar_lead: 'Lead Guitar',
  guitar_rhythm: 'Rhythm Guitar',
  guitar_acoustic: 'Acoustic Guitar',
  bass: 'Bass',
  drums: 'Drums',
  percussion: 'Percussion',
  keys_piano: 'Piano',
  keys_synth: 'Synthesizer',
  keys_organ: 'Organ',
  other: 'Other'
};

/**
 * Casting Template
 *
 * Reusable casting configuration that can be applied to multiple setlists.
 */
export interface CastingTemplate {
  id?: number;
  bandId: string;
  name: string;
  description?: string;
  contextType: 'acoustic' | 'electric' | 'practice' | 'custom';
  createdBy: string;
  createdDate: Date;
  updatedDate?: Date;
}

/**
 * Member Capability
 *
 * Tracks a member's skills and experience levels for different roles.
 */
export interface MemberCapability {
  id?: number;
  userId: string;
  bandId: string;
  roleType: RoleType;
  proficiencyLevel: 1 | 2 | 3 | 4 | 5;  // 1=Beginner, 5=Expert
  isPrimary: boolean;                    // Is this their primary role?
  yearsExperience?: number;
  notes?: string;
  updatedDate: Date;
}

/**
 * Casting Suggestion
 *
 * AI-generated suggestion for role assignments based on member capabilities.
 */
export interface CastingSuggestion {
  songId: number;
  memberId: string;
  roleType: RoleType;
  confidence: number;       // 0-1 confidence score
  reason: string;           // Why this suggestion was made
  isPrimary: boolean;
  alternativeMembers?: {    // Alternative suggestions
    memberId: string;
    confidence: number;
    reason: string;
  }[];
}

/**
 * Casting Statistics
 *
 * Analytics for casting assignments per member.
 */
export interface CastingStats {
  memberId: string;
  totalAssignments: number;
  primaryAssignments: number;
  roleBreakdown: Record<RoleType, number>;
  averageConfidence: number;
  mostCommonRole: RoleType;
}
