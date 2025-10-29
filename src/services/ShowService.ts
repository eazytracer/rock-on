import { Show, ShowContact, ShowStatus } from '../models/Show'
import { repository } from './data/RepositoryFactory'
import { SetlistService } from './SetlistService'

export interface ShowFilters {
  bandId: string
  status?: ShowStatus
  startDate?: Date
  endDate?: Date
}

export interface ShowListResponse {
  shows: Show[]
  total: number
}

export interface CreateShowRequest {
  name: string
  bandId: string
  scheduledDate: Date
  duration?: number
  venue?: string
  location?: string
  loadInTime?: string
  soundcheckTime?: string
  payment?: number
  contacts?: ShowContact[]
  setlistId?: string
  status?: ShowStatus
  notes?: string
}

export interface UpdateShowRequest {
  name?: string
  scheduledDate?: Date
  duration?: number
  venue?: string
  location?: string
  loadInTime?: string
  soundcheckTime?: string
  payment?: number
  contacts?: ShowContact[]
  setlistId?: string
  status?: ShowStatus
  notes?: string
}

export class ShowService {
  /**
   * Get all shows for a band with optional filters
   */
  static async getShows(filters: ShowFilters): Promise<ShowListResponse> {
    // Get all shows for the band from repository
    let shows = await repository.getShows(filters.bandId)

    // Apply status filter (client-side)
    if (filters.status) {
      shows = shows.filter(show => show.status === filters.status)
    }

    // Apply date range filter (client-side)
    if (filters.startDate || filters.endDate) {
      shows = shows.filter(show => {
        const showDate = show.scheduledDate
        if (filters.startDate && showDate < filters.startDate) {
          return false
        }
        if (filters.endDate && showDate > filters.endDate) {
          return false
        }
        return true
      })
    }

    // Sort by scheduled date (most recent first)
    shows.sort((a, b) => b.scheduledDate.getTime() - a.scheduledDate.getTime())

    const total = shows.length

    return {
      shows,
      total
    }
  }

  /**
   * Get a single show by ID
   */
  static async getShow(showId: string): Promise<Show | null> {
    return await repository.getShow(showId)
  }

  /**
   * Create a new show
   */
  static async createShow(showData: CreateShowRequest): Promise<Show> {
    this.validateShowData(showData)

    const newShow: Show = {
      id: crypto.randomUUID(),
      bandId: showData.bandId,
      name: showData.name,
      scheduledDate: showData.scheduledDate,
      duration: showData.duration || 120, // Default 2 hours
      venue: showData.venue,
      location: showData.location,
      loadInTime: showData.loadInTime,
      soundcheckTime: showData.soundcheckTime,
      payment: showData.payment,
      contacts: showData.contacts || [],
      setlistId: showData.setlistId,
      status: showData.status || 'scheduled',
      notes: showData.notes,
      createdDate: new Date(),
      updatedDate: new Date()
    }

    return await repository.addShow(newShow)
  }

  /**
   * Update an existing show
   */
  static async updateShow(showId: string, updateData: UpdateShowRequest): Promise<Show> {
    const existingShow = await this.getShow(showId)
    if (!existingShow) {
      throw new Error('Show not found')
    }

    // Validate any changed required fields
    if (updateData.name !== undefined || updateData.scheduledDate !== undefined) {
      this.validateShowData({
        ...existingShow,
        ...updateData
      } as CreateShowRequest)
    }

    const updates: Partial<Show> = {
      ...updateData,
      updatedDate: new Date()
    }

    return await repository.updateShow(showId, updates)
  }

  /**
   * Delete a show
   */
  static async deleteShow(showId: string): Promise<void> {
    const show = await this.getShow(showId)
    if (!show) {
      throw new Error('Show not found')
    }

    // Note: Associated setlist is NOT deleted, only the showId reference is cleared
    // This is handled by the database ON DELETE SET NULL constraint

    await repository.deleteShow(showId)
  }

  /**
   * Fork a setlist for a show
   * Creates a copy of the specified setlist linked to the show
   */
  static async forkSetlistForShow(
    showId: string,
    setlistId: string
  ): Promise<string> {
    const show = await this.getShow(showId)
    if (!show) {
      throw new Error('Show not found')
    }

    // Fork the setlist (creates a copy)
    const forkedSetlist = await SetlistService.forkSetlist(setlistId, show.name)

    // Update the show to reference the forked setlist
    await this.updateShow(showId, {
      setlistId: forkedSetlist.id
    })

    // Update the forked setlist to reference the show (bidirectional link)
    await SetlistService.updateSetlist(forkedSetlist.id, {
      showId: showId
    })

    return forkedSetlist.id
  }

  /**
   * Get upcoming shows (scheduled date >= today)
   */
  static async getUpcomingShows(bandId: string): Promise<Show[]> {
    const now = new Date()
    const response = await this.getShows({ bandId })

    return response.shows.filter(show =>
      show.scheduledDate >= now && show.status !== 'cancelled'
    )
  }

  /**
   * Get past shows (scheduled date < today or status = completed)
   */
  static async getPastShows(bandId: string): Promise<Show[]> {
    const now = new Date()
    const response = await this.getShows({ bandId })

    return response.shows.filter(show =>
      show.scheduledDate < now || show.status === 'completed'
    )
  }

  /**
   * Get the next upcoming show for a band
   */
  static async getNextShow(bandId: string): Promise<Show | null> {
    const upcomingShows = await this.getUpcomingShows(bandId)

    if (upcomingShows.length === 0) return null

    // Sort by date ascending and return first
    upcomingShows.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
    return upcomingShows[0]
  }

  /**
   * Add a contact to a show
   */
  static async addContact(showId: string, contact: ShowContact): Promise<Show> {
    const show = await this.getShow(showId)
    if (!show) {
      throw new Error('Show not found')
    }

    const contacts = show.contacts || []
    contacts.push({
      ...contact,
      id: contact.id || crypto.randomUUID()
    })

    return await this.updateShow(showId, { contacts })
  }

  /**
   * Update a contact on a show
   */
  static async updateContact(
    showId: string,
    contactId: string,
    updates: Partial<ShowContact>
  ): Promise<Show> {
    const show = await this.getShow(showId)
    if (!show) {
      throw new Error('Show not found')
    }

    const contacts = show.contacts || []
    const contactIndex = contacts.findIndex(c => c.id === contactId)

    if (contactIndex === -1) {
      throw new Error('Contact not found')
    }

    contacts[contactIndex] = {
      ...contacts[contactIndex],
      ...updates
    }

    return await this.updateShow(showId, { contacts })
  }

  /**
   * Remove a contact from a show
   */
  static async removeContact(showId: string, contactId: string): Promise<Show> {
    const show = await this.getShow(showId)
    if (!show) {
      throw new Error('Show not found')
    }

    const contacts = (show.contacts || []).filter(c => c.id !== contactId)

    return await this.updateShow(showId, { contacts })
  }

  /**
   * Validate show data
   */
  private static validateShowData(showData: CreateShowRequest | Partial<Show>): void {
    if (!showData.bandId) {
      throw new Error('Band ID is required')
    }

    if (!showData.name) {
      throw new Error('Show name is required')
    }

    if (!showData.scheduledDate) {
      throw new Error('Scheduled date is required')
    }

    if (showData.duration !== undefined && showData.duration <= 0) {
      throw new Error('Duration must be positive')
    }

    if (showData.payment !== undefined && showData.payment < 0) {
      throw new Error('Payment cannot be negative')
    }

    // Validate status if provided
    if (showData.status) {
      const validStatuses: ShowStatus[] = ['scheduled', 'confirmed', 'completed', 'cancelled']
      if (!validStatuses.includes(showData.status as ShowStatus)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`)
      }
    }
  }
}
