import { db } from '../services/database'
import { Song } from '../models/Song'
import { Member } from '../models/Member'
import { PracticeSession } from '../models/PracticeSession'
import { Setlist } from '../models/Setlist'

// Song services
export const songService = {
  async getAll(): Promise<Song[]> {
    return await db.songs.toArray()
  },

  async getById(id: string): Promise<Song | undefined> {
    return await db.songs.get(id)
  },

  async add(song: Omit<Song, 'id' | 'createdDate' | 'lastPracticed' | 'confidenceLevel'>): Promise<string> {
    const id = await db.songs.add({
      ...song,
      id: crypto.randomUUID(),
      createdDate: new Date(),
      confidenceLevel: 0
    } as Song)
    return id.toString()
  },

  async update(id: string, updates: Partial<Song>): Promise<void> {
    await db.songs.update(id, updates)
  },

  async delete(id: string): Promise<void> {
    await db.songs.delete(id)
  },

  async updateLastPracticed(id: string, date: Date = new Date()): Promise<void> {
    await db.songs.update(id, { lastPracticed: date })
  }
}

// Member services
export const memberService = {
  async getAll(): Promise<Member[]> {
    return await db.members.toArray()
  },

  async getById(id: string): Promise<Member | undefined> {
    return await db.members.get(id)
  },

  async add(member: Omit<Member, 'id'>): Promise<string> {
    const id = await db.members.add({
      ...member,
      id: crypto.randomUUID(),
      joinDate: new Date(),
      isActive: true
    } as Member)
    return id.toString()
  },

  async update(id: string, updates: Partial<Member>): Promise<void> {
    await db.members.update(id, updates)
  },

  async delete(id: string): Promise<void> {
    await db.members.update(id, { isActive: false })
  },

  async getActive(): Promise<Member[]> {
    return await db.members.where('isActive').equals(1).toArray()
  }
}

// Practice Session services
export const sessionService = {
  async getAll(): Promise<PracticeSession[]> {
    return await db.practiceSessions.toArray()
  },

  async getById(id: string): Promise<PracticeSession | undefined> {
    return await db.practiceSessions.get(id)
  },

  async add(session: Omit<PracticeSession, 'id'>): Promise<string> {
    const id = await db.practiceSessions.add({
      ...session,
      id: crypto.randomUUID()
    } as PracticeSession)
    return id.toString()
  },

  async update(id: string, updates: Partial<PracticeSession>): Promise<void> {
    await db.practiceSessions.update(id, updates)
  },

  async delete(id: string): Promise<void> {
    await db.practiceSessions.delete(id)
  },

  async getUpcoming(): Promise<PracticeSession[]> {
    const now = new Date()
    return await db.practiceSessions
      .where('scheduledDate')
      .above(now)
      .and(session => session.status !== 'cancelled')
      .sortBy('scheduledDate')
  },

  async getRecent(limit: number = 10): Promise<PracticeSession[]> {
    return await db.practiceSessions
      .orderBy('scheduledDate')
      .reverse()
      .limit(limit)
      .toArray()
  }
}

// Setlist services
export const setlistService = {
  async getAll(): Promise<Setlist[]> {
    return await db.setlists.toArray()
  },

  async getById(id: string): Promise<Setlist | undefined> {
    return await db.setlists.get(id)
  },

  async add(setlist: Omit<Setlist, 'id' | 'createdDate' | 'lastModified'>): Promise<string> {
    const now = new Date()
    const id = await db.setlists.add({
      ...setlist,
      id: crypto.randomUUID(),
      createdDate: now,
      lastModified: now
    } as Setlist)
    return id.toString()
  },

  async update(id: string, updates: Partial<Setlist>): Promise<void> {
    await db.setlists.update(id, {
      ...updates,
      lastModified: new Date()
    })
  },

  async delete(id: string): Promise<void> {
    await db.setlists.delete(id)
  },

  async getByStatus(status: Setlist['status']): Promise<Setlist[]> {
    return await db.setlists.where('status').equals(status).toArray()
  }
}