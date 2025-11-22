export interface User {
  id: string
  email: string
  name: string
  createdDate: Date
  lastLogin?: Date
  authProvider: 'mock' | 'email' | 'google' | 'github'
}

export interface UserProfile {
  id: string
  userId: string
  displayName: string
  primaryInstrument?: string
  instruments: string[]
  avatarUrl?: string
  createdDate: Date
  updatedDate: Date
}

export const UserSchema = {
  '++id': '',
  email: '',
  name: '',
  createdDate: '',
  lastLogin: '',
  authProvider: '',
}

export const UserProfileSchema = {
  '++id': '',
  userId: '',
  displayName: '',
  primaryInstrument: '',
  '*instruments': '',
  avatarUrl: '',
  createdDate: '',
  updatedDate: '',
}
