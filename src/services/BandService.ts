import { db } from './database'
import { Band } from '../models/Band'
import { Member } from '../models/Member'
import { BandSettings, MemberRole } from '../types'

export interface CreateBandRequest {
  name: string
  description?: string
  settings?: Partial<BandSettings>
}

export interface UpdateBandRequest {
  name?: string
  description?: string
  settings?: Partial<BandSettings>
}

export interface CreateMemberRequest {
  name: string
  email: string
  phone?: string
  instruments: string[]
  primaryInstrument: string
  role?: MemberRole
}

export interface UpdateMemberRequest {
  name?: string
  email?: string
  phone?: string
  instruments?: string[]
  primaryInstrument?: string
  role?: MemberRole
  isActive?: boolean
}

export class BandService {
  static async getAllBands(): Promise<Band[]> {
    return await db.bands.orderBy('name').toArray()
  }

  static async createBand(bandData: CreateBandRequest): Promise<Band> {
    this.validateBandData(bandData)

    // Check for duplicate band name
    const existingBand = await db.bands
      .where('name')
      .equals(bandData.name)
      .first()

    if (existingBand) {
      throw new Error('Band name already exists')
    }

    const defaultSettings: BandSettings = {
      defaultPracticeTime: 120,
      reminderMinutes: [60, 30, 10],
      autoSaveInterval: 30
    }

    const newBand: Band = {
      id: crypto.randomUUID(),
      name: bandData.name,
      description: bandData.description,
      createdDate: new Date(),
      settings: { ...defaultSettings, ...bandData.settings },
      memberIds: []
    }

    await db.bands.add(newBand)
    return newBand
  }

  static async getBandById(bandId: string): Promise<Band | null> {
    const band = await db.bands.get(bandId)
    return band || null
  }

  static async updateBand(bandId: string, updateData: UpdateBandRequest): Promise<Band> {
    const existingBand = await this.getBandById(bandId)
    if (!existingBand) {
      throw new Error('Band not found')
    }

    if (updateData.name !== undefined) {
      this.validateBandName(updateData.name)

      // Check for duplicate name (excluding current band)
      const existingBandWithName = await db.bands
        .where('name')
        .equals(updateData.name)
        .first()

      if (existingBandWithName && existingBandWithName.id !== bandId) {
        throw new Error('Band name already exists')
      }
    }

    const updates: Partial<Band> = {}
    if (updateData.name !== undefined) updates.name = updateData.name
    if (updateData.description !== undefined) updates.description = updateData.description
    if (updateData.settings) {
      updates.settings = { ...existingBand.settings, ...updateData.settings }
    }

    await db.bands.update(bandId, updates)
    return await this.getBandById(bandId) as Band
  }

  static async deleteBand(bandId: string): Promise<void> {
    const band = await this.getBandById(bandId)
    if (!band) {
      throw new Error('Band not found')
    }

    // Check if band has any associated data
    const [songs, sessions, setlists] = await Promise.all([
      db.songs.where('bandId').equals(bandId).count(),
      db.practiceSessions.where('bandId').equals(bandId).count(),
      db.setlists.where('bandId').equals(bandId).count()
    ])

    if (songs > 0 || sessions > 0 || setlists > 0) {
      throw new Error('Cannot delete band: has associated songs, sessions, or setlists')
    }

    await db.bands.delete(bandId)
  }

  static async getBandMembers(bandId: string): Promise<Member[]> {
    const band = await this.getBandById(bandId)
    if (!band) {
      throw new Error('Band not found')
    }

    const members = await Promise.all(
      band.memberIds.map(id => db.members.get(id))
    )

    return members.filter(Boolean) as Member[]
  }

  static async addMemberToBand(bandId: string, memberData: CreateMemberRequest): Promise<Member> {
    const band = await this.getBandById(bandId)
    if (!band) {
      throw new Error('Band not found')
    }

    this.validateMemberData(memberData)

    // Check for duplicate email
    const existingMember = await db.members
      .where('email')
      .equals(memberData.email)
      .first()

    if (existingMember) {
      throw new Error('Member with this email already exists')
    }

    const newMember: Member = {
      id: crypto.randomUUID(),
      name: memberData.name,
      email: memberData.email,
      phone: memberData.phone,
      instruments: memberData.instruments,
      primaryInstrument: memberData.primaryInstrument,
      role: memberData.role || 'member',
      joinDate: new Date(),
      isActive: true
    }

    await db.members.add(newMember)

    // Add member to band
    const updatedMemberIds = [...band.memberIds, newMember.id]
    await db.bands.update(bandId, { memberIds: updatedMemberIds })

    return newMember
  }

  static async updateMember(memberId: string, updateData: UpdateMemberRequest): Promise<Member> {
    const existingMember = await db.members.get(memberId)
    if (!existingMember) {
      throw new Error('Member not found')
    }

    if (updateData.email !== undefined) {
      this.validateEmail(updateData.email)

      // Check for duplicate email (excluding current member)
      const existingMemberWithEmail = await db.members
        .where('email')
        .equals(updateData.email)
        .first()

      if (existingMemberWithEmail && existingMemberWithEmail.id !== memberId) {
        throw new Error('Member with this email already exists')
      }
    }

    if (updateData.instruments && updateData.primaryInstrument) {
      if (!updateData.instruments.includes(updateData.primaryInstrument)) {
        throw new Error('Primary instrument must be in instruments list')
      }
    }

    const updates: Partial<Member> = {}
    if (updateData.name !== undefined) updates.name = updateData.name
    if (updateData.email !== undefined) updates.email = updateData.email
    if (updateData.phone !== undefined) updates.phone = updateData.phone
    if (updateData.instruments) updates.instruments = updateData.instruments
    if (updateData.primaryInstrument) updates.primaryInstrument = updateData.primaryInstrument
    if (updateData.role) updates.role = updateData.role
    if (updateData.isActive !== undefined) updates.isActive = updateData.isActive

    await db.members.update(memberId, updates)
    return await db.members.get(memberId) as Member
  }

  static async removeMemberFromBand(bandId: string, memberId: string): Promise<void> {
    const band = await this.getBandById(bandId)
    if (!band) {
      throw new Error('Band not found')
    }

    if (!band.memberIds.includes(memberId)) {
      throw new Error('Member not in band')
    }

    // Don't allow removing the last admin
    const member = await db.members.get(memberId)
    if (member?.role === 'admin') {
      const adminMembers = await Promise.all(
        band.memberIds.map(id => db.members.get(id))
      )
      const activeAdmins = adminMembers.filter(m => m?.role === 'admin' && m?.isActive)

      if (activeAdmins.length <= 1) {
        throw new Error('Cannot remove the last active admin')
      }
    }

    const updatedMemberIds = band.memberIds.filter(id => id !== memberId)
    await db.bands.update(bandId, { memberIds: updatedMemberIds })

    // Optionally deactivate the member instead of removing completely
    await db.members.update(memberId, { isActive: false })
  }

  private static validateBandData(bandData: CreateBandRequest): void {
    this.validateBandName(bandData.name)

    if (bandData.description && bandData.description.length > 500) {
      throw new Error('Band description cannot exceed 500 characters')
    }
  }

  private static validateBandName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Band name is required')
    }
    if (name.length > 100) {
      throw new Error('Band name cannot exceed 100 characters')
    }
  }

  private static validateMemberData(memberData: CreateMemberRequest): void {
    if (!memberData.name || memberData.name.trim().length === 0) {
      throw new Error('Member name is required')
    }
    if (memberData.name.length > 50) {
      throw new Error('Member name cannot exceed 50 characters')
    }

    this.validateEmail(memberData.email)

    if (!memberData.instruments || memberData.instruments.length === 0) {
      throw new Error('At least one instrument is required')
    }

    if (!memberData.primaryInstrument) {
      throw new Error('Primary instrument is required')
    }

    if (!memberData.instruments.includes(memberData.primaryInstrument)) {
      throw new Error('Primary instrument must be in instruments list')
    }
  }

  private static validateEmail(email: string): void {
    if (!email || email.trim().length === 0) {
      throw new Error('Email is required')
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format')
    }
  }
}