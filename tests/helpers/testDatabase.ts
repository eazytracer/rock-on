import { db } from '../../src/services/database'
import { seedMvpData } from '../../src/database/seedMvpData'

/**
 * Reset the test database by clearing all tables and reseeding with MVP data
 */
export async function resetTestDatabase() {
  // Clear all tables
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map(table => table.clear()))
  })

  // Reseed with MVP data
  await seedMvpData()
}

/**
 * Get counts of all major tables for verification
 */
export async function getTableCounts() {
  return {
    songs: await db.songs.count(),
    setlists: await db.setlists.count(),
    shows: await db.shows?.count() || 0, // Optional chaining in case shows table doesn't exist yet
    practices: await db.practiceSessions.count(),
    bands: await db.bands.count(),
    bandMemberships: await db.bandMemberships.count()
  }
}

/**
 * Clear a specific table
 */
export async function clearTable(tableName: string) {
  const table = (db as any)[tableName]
  if (table && typeof table === 'object' && 'clear' in table) {
    await table.clear()
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}
