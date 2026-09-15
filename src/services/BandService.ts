import { repository } from './data/RepositoryFactory'
import { Band } from '../models/Band'
import { BandSettings } from '../types'

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

export class BandService {
  static async getAllBands(): Promise<Band[]> {
    const bands = await repository.getBands()
    // Client-side sorting by name (repository doesn't support orderBy yet)
    return bands.sort((a, b) => a.name.localeCompare(b.name))
  }

  static async createBand(bandData: CreateBandRequest): Promise<Band> {
    this.validateBandData(bandData)

    // Check for duplicate band name
    const allBands = await repository.getBands()
    const existingBand = allBands.find(b => b.name === bandData.name)

    if (existingBand) {
      throw new Error('Band name already exists')
    }

    const defaultSettings: BandSettings = {
      defaultPracticeTime: 120,
      reminderMinutes: [60, 30, 10],
      autoSaveInterval: 30,
    }

    const newBand: Band = {
      id: crypto.randomUUID(),
      name: bandData.name,
      description: bandData.description,
      createdDate: new Date(),
      settings: { ...defaultSettings, ...bandData.settings },
      memberIds: [],
    }

    return await repository.addBand(newBand)
  }

  static async getBandById(bandId: string): Promise<Band | null> {
    return await repository.getBand(bandId)
  }

  static async updateBand(
    bandId: string,
    updateData: UpdateBandRequest
  ): Promise<Band> {
    const existingBand = await this.getBandById(bandId)
    if (!existingBand) {
      throw new Error('Band not found')
    }

    if (updateData.name !== undefined) {
      this.validateBandName(updateData.name)

      // Check for duplicate name (excluding current band)
      const allBands = await repository.getBands()
      const existingBandWithName = allBands.find(
        b => b.name === updateData.name
      )

      if (existingBandWithName && existingBandWithName.id !== bandId) {
        throw new Error('Band name already exists')
      }
    }

    const updates: Partial<Band> = {}
    if (updateData.name !== undefined) updates.name = updateData.name
    if (updateData.description !== undefined)
      updates.description = updateData.description
    if (updateData.settings) {
      updates.settings = { ...existingBand.settings, ...updateData.settings }
    }

    await repository.updateBand(bandId, updates)
    return (await this.getBandById(bandId)) as Band
  }

  static async deleteBand(bandId: string): Promise<void> {
    const band = await this.getBandById(bandId)
    if (!band) {
      throw new Error('Band not found')
    }

    // Check if band has any associated data
    const [songs, sessions, setlists] = await Promise.all([
      repository.getSongs({ contextId: bandId }),
      repository.getPracticeSessions(bandId),
      repository.getSetlists(bandId),
    ])

    if (songs.length > 0 || sessions.length > 0 || setlists.length > 0) {
      throw new Error(
        'Cannot delete band: has associated songs, sessions, or setlists'
      )
    }

    await repository.deleteBand(bandId)
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
}
