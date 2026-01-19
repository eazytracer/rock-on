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
    console.log('🔄 Starting database reset...')

    // Ensure database is open
    if (!db.isOpen()) {
      console.log('📂 Reopening database...')
      await db.open()
    }

    // Clear localStorage
    localStorage.removeItem('currentUserId')
    localStorage.removeItem('currentBandId')
    console.log('✅ LocalStorage cleared!')

    // Clear all data and re-seed
    console.log('🧹 Clearing database tables...')
    await db.songs.clear()
    await db.bands.clear()
    await db.users.clear()
    await db.setlists.clear()
    await db.practiceSessions.clear()
    await db.shows.clear()
    await db.bandMemberships.clear()

    console.log('🌱 Re-seeding database...')
    await seedMvpData()

    console.log('✅ Database reset complete!')
    console.log('')
    console.log('📊 New seed data includes:')
    console.log('  - 3 test users (Eric, Mike, Sarah)')
    console.log('  - 1 band: Demo Band')
    console.log('  - 45 songs (from your CSV + existing)')
    console.log('  - 4 setlists with songs/breaks/sections')
    console.log('  - 5 shows (3 upcoming, 2 past)')
    console.log('  - 5 practice sessions (2 upcoming, 3 past)')
    console.log('')
    console.log('Test users available:')
    console.log('  - eric@testband.demo')
    console.log('  - mike@testband.demo')
    console.log('  - sarah@testband.demo')
    console.log('')
    console.log('✅ Done! Please refresh manually if needed.')

    // DON'T auto-reload - let user do it manually to avoid loops
    // setTimeout(() => window.location.reload(), 1000)

    return true
  } catch (error) {
    console.error('❌ Error resetting database:', error)
    throw error // Re-throw to see the actual error
  }
}

/**
 * Nuclear option - completely delete and recreate the database
 * Useful if database schema is corrupted or you want a completely fresh start
 *
 * NOTE: This will reload the page automatically. Use resetDB() if you don't want auto-reload.
 */
export async function nukeDatabase() {
  try {
    console.log('💣 NUKING database...')
    console.log('⚠️  This will delete EVERYTHING')

    // Set a flag to prevent infinite loops
    const reloadCount = parseInt(
      sessionStorage.getItem('nukeReloadCount') || '0'
    )
    if (reloadCount > 3) {
      console.error('🛑 Too many reloads detected. Breaking loop.')
      sessionStorage.removeItem('nukeReloadCount')
      return false
    }

    // Delete the entire database (this will auto-close it first)
    await db.delete()

    // Also clear localStorage
    localStorage.clear()

    console.log('✅ Database deleted!')
    console.log('🔄 Reloading page in 500ms...')

    // Increment reload counter
    sessionStorage.setItem('nukeReloadCount', String(reloadCount + 1))

    // Reload after a short delay
    setTimeout(() => {
      window.location.reload()
    }, 500)

    return true
  } catch (error) {
    console.error('❌ Error nuking database:', error)
    sessionStorage.removeItem('nukeReloadCount')
    return false
  }
}

/**
 * Clear only Supabase sync metadata (useful if you want to force a full re-sync)
 */
export async function clearSyncMetadata() {
  try {
    console.log('🗑️ Clearing sync metadata...')

    await db.syncMetadata.clear()
    await db.syncQueue.clear()
    await db.syncConflicts.clear()

    console.log('✅ Sync metadata cleared!')
    console.log('💡 Next sync will be a full sync from Supabase')

    return true
  } catch (error) {
    console.error('❌ Error clearing sync metadata:', error)
    return false
  }
}

// NOTE: These utilities are NOT auto-loaded anymore to avoid issues.
// To use them, manually import in console:
// import('/src/utils/resetDatabase.ts').then(m => m.resetDatabase())
