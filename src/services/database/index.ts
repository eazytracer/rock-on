import Dexie, { Table } from 'dexie'
import { Band } from '../../models/Band'
import { Member } from '../../models/Member'
import { Song } from '../../models/Song'
import { PracticeSession } from '../../models/PracticeSession'
import { Setlist } from '../../models/Setlist'
import { User, UserProfile } from '../../models/User'
import { BandMembership, InviteCode } from '../../models/BandMembership'
import { SongGroup, SongGroupMembership } from '../../models/SongGroup'
import {
  SongCasting,
  SongAssignment,
  AssignmentRole,
  CastingTemplate,
  MemberCapability
} from '../../models/SongCasting'

export class RockOnDB extends Dexie {
  bands!: Table<Band>
  members!: Table<Member>
  songs!: Table<Song>
  practiceSessions!: Table<PracticeSession>
  setlists!: Table<Setlist>
  users!: Table<User>
  userProfiles!: Table<UserProfile>
  bandMemberships!: Table<BandMembership>
  inviteCodes!: Table<InviteCode>
  songGroups!: Table<SongGroup>
  songGroupMemberships!: Table<SongGroupMembership>
  songCastings!: Table<SongCasting>
  songAssignments!: Table<SongAssignment>
  assignmentRoles!: Table<AssignmentRole>
  castingTemplates!: Table<CastingTemplate>
  memberCapabilities!: Table<MemberCapability>

  constructor() {
    super('RockOnDB')

    // Version 1: Original schema
    this.version(1).stores({
      bands: '++id, name, createdDate',
      members: '++id, name, email, isActive',
      songs: '++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel',
      practiceSessions: '++id, bandId, scheduledDate, type, status',
      setlists: '++id, name, bandId, showDate, status, createdDate, lastModified'
    })

    // Version 2: Multi-user support
    this.version(2).stores({
      bands: '++id, name, createdDate',
      members: '++id, name, email, isActive',
      songs: '++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel, contextType, contextId, createdBy, visibility, songGroupId',
      practiceSessions: '++id, bandId, scheduledDate, type, status',
      setlists: '++id, name, bandId, showDate, status, createdDate, lastModified',
      users: '++id, email, name, createdDate, lastLogin, authProvider',
      userProfiles: '++id, userId, displayName, primaryInstrument, *instruments',
      bandMemberships: '++id, userId, bandId, role, joinedDate, status, *permissions',
      inviteCodes: '++id, bandId, code, createdBy, expiresAt, currentUses'
    })

    // Version 3: Song variant linking system
    this.version(3).stores({
      bands: '++id, name, createdDate',
      members: '++id, name, email, isActive',
      songs: '++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel, contextType, contextId, createdBy, visibility, songGroupId',
      practiceSessions: '++id, bandId, scheduledDate, type, status',
      setlists: '++id, name, bandId, showDate, status, createdDate, lastModified',
      users: '++id, email, name, createdDate, lastLogin, authProvider',
      userProfiles: '++id, userId, displayName, primaryInstrument, *instruments',
      bandMemberships: '++id, userId, bandId, role, joinedDate, status, *permissions',
      inviteCodes: '++id, bandId, code, createdBy, expiresAt, currentUses',
      songGroups: '++id, createdBy, name, createdDate',
      songGroupMemberships: '++id, songId, songGroupId, addedBy, addedDate'
    })

    // Version 4: Context-specific casting system
    this.version(4).stores({
      bands: '++id, name, createdDate',
      members: '++id, name, email, isActive',
      songs: '++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel, contextType, contextId, createdBy, visibility, songGroupId',
      practiceSessions: '++id, bandId, scheduledDate, type, status',
      setlists: '++id, name, bandId, showDate, status, createdDate, lastModified',
      users: '++id, email, name, createdDate, lastLogin, authProvider',
      userProfiles: '++id, userId, displayName, primaryInstrument, *instruments',
      bandMemberships: '++id, userId, bandId, role, joinedDate, status, *permissions',
      inviteCodes: '++id, bandId, code, createdBy, expiresAt, currentUses',
      songGroups: '++id, createdBy, name, createdDate',
      songGroupMemberships: '++id, songId, songGroupId, addedBy, addedDate',
      songCastings: '++id, contextType, contextId, songId, createdBy, createdDate',
      songAssignments: '++id, songCastingId, memberId, isPrimary, confidence, addedBy, addedDate',
      assignmentRoles: '++id, assignmentId, type, name, isPrimary',
      castingTemplates: '++id, bandId, name, contextType, createdBy, createdDate',
      memberCapabilities: '++id, userId, bandId, roleType, proficiencyLevel, isPrimary, updatedDate'
    })

    // Version 5: MVP Enhancements - setlists items (songs/breaks/sections) + show metadata
    this.version(5).stores({
      bands: '++id, name, createdDate',
      members: '++id, name, email, isActive',
      songs: '++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel, contextType, contextId, createdBy, visibility, songGroupId',
      practiceSessions: '++id, bandId, scheduledDate, type, status, setlistId',  // Added setlistId index
      setlists: '++id, name, bandId, showId, status, createdDate, lastModified',  // Changed showDate to showId
      users: '++id, email, name, createdDate, lastLogin, authProvider',
      userProfiles: '++id, userId, displayName, primaryInstrument, *instruments',
      bandMemberships: '++id, userId, bandId, role, joinedDate, status, *permissions',
      inviteCodes: '++id, bandId, code, createdBy, expiresAt, currentUses',
      songGroups: '++id, createdBy, name, createdDate',
      songGroupMemberships: '++id, songId, songGroupId, addedBy, addedDate',
      songCastings: '++id, contextType, contextId, songId, createdBy, createdDate',
      songAssignments: '++id, songCastingId, memberId, isPrimary, confidence, addedBy, addedDate',
      assignmentRoles: '++id, assignmentId, type, name, isPrimary',
      castingTemplates: '++id, bandId, name, contextType, createdBy, createdDate',
      memberCapabilities: '++id, userId, bandId, roleType, proficiencyLevel, isPrimary, updatedDate'
    })

    // Add hooks for automatic timestamps
    this.bands.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date()
    })

    this.songs.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date()
      obj.confidenceLevel = obj.confidenceLevel || 1
    })

    this.setlists.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date()
      obj.lastModified = new Date()
    })

    this.setlists.hook('updating', function(modifications, _primKey, _obj, _trans) {
      (modifications as any).lastModified = new Date()
    })

    this.members.hook('creating', function(_primKey, obj, _trans) {
      obj.joinDate = new Date()
      obj.isActive = obj.isActive !== false
    })

    this.users.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date()
      obj.lastLogin = new Date()
    })

    this.userProfiles.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date()
      obj.updatedDate = new Date()
    })

    this.userProfiles.hook('updating', function(modifications, _primKey, _obj, _trans) {
      (modifications as any).updatedDate = new Date()
    })

    this.bandMemberships.hook('creating', function(_primKey, obj, _trans) {
      obj.joinedDate = new Date()
      obj.status = obj.status || 'active'
      obj.permissions = obj.permissions || ['member']
    })

    this.inviteCodes.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date()
      obj.currentUses = 0
    })

    this.songGroups.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date().toISOString()
    })

    this.songGroupMemberships.hook('creating', function(_primKey, obj, _trans) {
      obj.addedDate = new Date().toISOString()
    })

    // Phase 3: Casting system hooks
    this.songCastings.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date()
    })

    this.songCastings.hook('updating', function(modifications, _primKey, _obj, _trans) {
      (modifications as any).updatedDate = new Date()
    })

    this.songAssignments.hook('creating', function(_primKey, obj, _trans) {
      obj.addedDate = new Date()
    })

    this.songAssignments.hook('updating', function(modifications, _primKey, _obj, _trans) {
      (modifications as any).updatedDate = new Date()
    })

    this.castingTemplates.hook('creating', function(_primKey, obj, _trans) {
      obj.createdDate = new Date()
    })

    this.castingTemplates.hook('updating', function(modifications, _primKey, _obj, _trans) {
      (modifications as any).updatedDate = new Date()
    })

    this.memberCapabilities.hook('creating', function(_primKey, obj, _trans) {
      obj.updatedDate = new Date()
    })

    this.memberCapabilities.hook('updating', function(modifications, _primKey, _obj, _trans) {
      (modifications as any).updatedDate = new Date()
    })
  }
}

export const db = new RockOnDB()

// Helper functions for common operations
export const initializeDefaultBand = async () => {
  const existingBands = await db.bands.count()
  if (existingBands === 0) {
    const bandId = await db.bands.add({
      id: crypto.randomUUID(),
      name: 'My Band',
      description: 'Your awesome band',
      createdDate: new Date(),
      settings: {
        defaultPracticeTime: 120,
        reminderMinutes: [60, 30, 10],
        autoSaveInterval: 30
      },
      memberIds: []
    })

    // Create default member
    const memberId = await db.members.add({
      id: crypto.randomUUID(),
      name: 'You',
      email: 'user@example.com',
      instruments: ['Guitar'],
      primaryInstrument: 'Guitar',
      role: 'admin',
      joinDate: new Date(),
      isActive: true
    })

    // Add member to band
    await db.bands.update(bandId, {
      memberIds: [memberId.toString()]
    })

    return { bandId, memberId }
  }
}

export default db