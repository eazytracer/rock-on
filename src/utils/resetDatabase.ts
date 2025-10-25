/**
 * Database Reset Utility
 *
 * Use this during development to completely reset the database and reseed with MVP data.
 *
 * USAGE IN BROWSER CONSOLE:
 *
 * import { resetDatabase } from './src/utils/resetDatabase'
 * resetDatabase()
 *
 * OR add this to window in dev mode for easy access:
 * window.resetDB = resetDatabase
 */

import { db } from '../services/database'
import { seedMvpData } from '../database/seedMvpData'

export async function resetDatabase() {
  try {
    console.log('🗑️  Deleting all data...')

    // Delete all data from all tables
    await db.users.clear()
    await db.userProfiles.clear()
    await db.bands.clear()
    await db.bandMemberships.clear()
    await db.inviteCodes.clear()
    await db.songs.clear()
    await db.setlists.clear()
    await db.practiceSessions.clear()

    console.log('✅ Database cleared!')

    // Clear localStorage
    localStorage.removeItem('currentUserId')
    localStorage.removeItem('currentBandId')

    console.log('✅ LocalStorage cleared!')

    // Reseed the database
    console.log('🌱 Reseeding database...')
    await seedMvpData()

    console.log('✅ Database reset complete!')
    console.log('')
    console.log('Test users available:')
    console.log('  - eric@ipodshuffle.com (Guitar, Vocals) - Owner')
    console.log('  - mike@ipodshuffle.com (Bass, Harmonica) - Member')
    console.log('  - sarah@ipodshuffle.com (Drums) - Member')
    console.log('')
    console.log('Refresh the page to see changes.')

    return true
  } catch (error) {
    console.error('❌ Error resetting database:', error)
    return false
  }
}

// Make it available globally in development
if (import.meta.env.DEV) {
  (window as any).resetDB = resetDatabase
}
