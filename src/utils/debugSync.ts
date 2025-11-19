import { db } from '../services/database'
import { config } from '../config/appMode'

/**
 * Debug utility to check sync status
 * Call from browser console: debugSync()
 */
export async function debugSync() {
  console.log('🔍 Sync Debug Information')
  console.log('========================\n')

  // 1. Config
  console.log('📋 Configuration:')
  console.log('  Mode:', config.mode)
  console.log('  Is Production:', config.isProduction)
  console.log('  Enable Supabase Auth:', config.enableSupabaseAuth)
  console.log('  Supabase URL:', config.supabaseUrl)
  console.log('')

  // 2. Check sync queue
  console.log('📦 Sync Queue:')
  let queue: any[] = []
  try {
    queue = await db.syncQueue.toArray()
    console.log(`  Total items: ${queue.length}`)

    if (queue.length > 0) {
      const pending = queue.filter(q => q.status === 'pending')
      const syncing = queue.filter(q => q.status === 'syncing')
      const failed = queue.filter(q => q.status === 'failed')

      console.log(`  Pending: ${pending.length}`)
      console.log(`  Syncing: ${syncing.length}`)
      console.log(`  Failed: ${failed.length}`)
      console.log('')
      console.log('  Queue items:')
      queue.forEach((item, i) => {
        console.log(`    ${i + 1}. ${item.operation} ${item.table} - Status: ${item.status}`)
        if (item.lastError) {
          console.log(`       Error: ${item.lastError}`)
        }
      })
    } else {
      console.log('  ✅ Queue is empty')
    }
  } catch (error) {
    console.error('  ❌ Error reading sync queue:', error)
  }
  console.log('')

  // 3. Check last sync time
  console.log('⏰ Last Sync:')
  try {
    const syncMeta = await db.syncMetadata.toArray()
    if (syncMeta.length > 0) {
      syncMeta.forEach(meta => {
        // SyncMetadata stores value as Date, id contains the entity name
        const lastSync = meta.value ? new Date(meta.value).toLocaleString() : 'Never'
        console.log(`  ${meta.id}: ${lastSync}`)
      })
    } else {
      console.log('  No sync metadata found')
    }
  } catch (error) {
    console.error('  ❌ Error reading sync metadata:', error)
  }
  console.log('')

  // 4. Check local data
  console.log('💾 Local Data:')
  try {
    const songs = await db.songs.count()
    const bands = await db.bands.count()
    const users = await db.users.count()
    console.log(`  Songs: ${songs}`)
    console.log(`  Bands: ${bands}`)
    console.log(`  Users: ${users}`)
  } catch (error) {
    console.error('  ❌ Error reading local data:', error)
  }
  console.log('')

  // 5. Check online status
  console.log('🌐 Network:')
  console.log('  Online:', navigator.onLine)
  console.log('')

  // 6. Instructions
  console.log('💡 Next Steps:')
  if (queue.length > 0) {
    console.log('  - You have pending sync items')
    console.log('  - They should sync automatically')
    console.log('  - Check for errors above')
  } else {
    console.log('  - No items in sync queue')
    console.log('  - Try creating some data')
    console.log('  - Check if items appear in queue')
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  (window as any).debugSync = debugSync
}
