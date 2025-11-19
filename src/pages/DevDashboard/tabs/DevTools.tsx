/**
 * Dev Tools Tab
 *
 * Provides utility functions for development and testing:
 * - Clear local database
 * - Force sync operations
 * - Reset test data
 * - Database diagnostics
 */

import React, { useState } from 'react'
import { db } from '../../../services/database'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../services/supabase/client'

export const DevTools: React.FC = () => {
  const { user } = useAuth()
  const [isClearing, setIsClearing] = useState(false)
  const [isForcing, setIsForcing] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)

  const clearLocalDatabase = async () => {
    if (!confirm('⚠️ Are you sure you want to clear the local database?\n\nThis will delete all data from IndexedDB. You will need to re-sync from Supabase.')) {
      return
    }

    setIsClearing(true)
    try {
      await db.delete()
      await db.open()
      setLastAction('✅ Local database cleared successfully')
    } catch (err) {
      setLastAction(`❌ Error clearing database: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setIsClearing(false)
  }

  const clearSupabaseData = async () => {
    if (!user) {
      alert('You must be logged in to clear Supabase data')
      return
    }

    if (!confirm('⚠️⚠️⚠️ DANGER ⚠️⚠️⚠️\n\nAre you sure you want to DELETE ALL DATA from Supabase?\n\nThis will permanently delete:\n- All songs\n- All setlists\n- All shows\n- All practice sessions\n- All audit logs\n\nThis action CANNOT be undone!')) {
      return
    }

    const confirmText = prompt('Type "DELETE ALL DATA" to confirm:')
    if (confirmText !== 'DELETE ALL DATA') {
      alert('Confirmation text did not match. Operation cancelled.')
      return
    }

    setIsClearing(true)
    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      // Delete from all tables
      const tables = ['audit_log', 'setlists', 'shows', 'practice_sessions', 'songs', 'band_memberships']

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (using impossible condition)

        if (error) throw error
      }

      setLastAction('✅ All Supabase data cleared successfully')
    } catch (err) {
      setLastAction(`❌ Error clearing Supabase: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setIsClearing(false)
  }

  const forceSync = async () => {
    setIsForcing(true)
    try {
      // TODO: Implement actual force sync
      // This would trigger SyncEngine to process all pending operations
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate
      setLastAction('✅ Force sync completed (not yet implemented)')
    } catch (err) {
      setLastAction(`❌ Error during force sync: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setIsForcing(false)
  }

  const seedTestData = async () => {
    if (!user) {
      alert('You must be logged in to seed test data')
      return
    }

    if (!confirm('Seed test data?\n\nThis will add sample songs, setlists, and practices to your database.')) {
      return
    }

    try {
      // TODO: Import and run seed data
      setLastAction('✅ Test data seeded (not yet implemented)')
    } catch (err) {
      setLastAction(`❌ Error seeding data: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const exportDatabaseJSON = async () => {
    try {
      const data = {
        songs: await db.table('songs').toArray(),
        setlists: await db.table('setlists').toArray(),
        shows: await db.table('shows').toArray(),
        practice_sessions: await db.table('practice_sessions').toArray(),
        bands: await db.table('bands').toArray(),
        band_memberships: await db.table('band_memberships').toArray(),
        audit_log: await db.table('audit_log').toArray()
      }

      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rock-on-db-${new Date().toISOString()}.json`
      a.click()
      URL.revokeObjectURL(url)

      setLastAction('✅ Database exported to JSON file')
    } catch (err) {
      setLastAction(`❌ Error exporting database: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text mb-2">Dev Tools</h2>
        <p className="text-sm text-muted mb-4">
          Utility functions for development and testing.
        </p>
      </div>

      {/* Last Action Result */}
      {lastAction && (
        <div className="mb-6 p-4 bg-surface rounded-lg border border-divider">
          <div className="text-sm text-text">{lastAction}</div>
        </div>
      )}

      {/* Auth Warning */}
      {!user && (
        <div className="bg-warning/10 border border-warning text-warning px-4 py-3 rounded-lg mb-6">
          <div className="font-medium mb-1">⚠️ Not Authenticated</div>
          <div className="text-sm">Some tools require authentication.</div>
        </div>
      )}

      {/* Database Tools */}
      <div className="bg-white rounded-lg border border-divider p-6 mb-6">
        <h3 className="text-lg font-medium text-text mb-4">Database Tools</h3>

        <div className="space-y-4">
          {/* Clear Local Database */}
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div>
              <div className="text-sm font-medium text-text">Clear Local Database</div>
              <div className="text-xs text-muted mt-1">
                Delete all data from IndexedDB (re-sync from Supabase required)
              </div>
            </div>
            <button
              onClick={clearLocalDatabase}
              disabled={isClearing}
              className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isClearing ? 'Clearing...' : 'Clear Local DB'}
            </button>
          </div>

          {/* Clear Supabase Data */}
          <div className="flex items-center justify-between p-4 bg-error/5 border-2 border-error rounded-lg">
            <div>
              <div className="text-sm font-medium text-error">⚠️ Clear Supabase Data</div>
              <div className="text-xs text-error mt-1">
                DANGER: Permanently delete ALL data from cloud (CANNOT be undone!)
              </div>
            </div>
            <button
              onClick={clearSupabaseData}
              disabled={isClearing || !user}
              className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold"
            >
              {isClearing ? 'Deleting...' : 'DELETE ALL'}
            </button>
          </div>

          {/* Export Database */}
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div>
              <div className="text-sm font-medium text-text">Export Database to JSON</div>
              <div className="text-xs text-muted mt-1">
                Download all IndexedDB data as a JSON file for inspection
              </div>
            </div>
            <button
              onClick={exportDatabaseJSON}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Sync Tools */}
      <div className="bg-white rounded-lg border border-divider p-6 mb-6">
        <h3 className="text-lg font-medium text-text mb-4">Sync Tools</h3>

        <div className="space-y-4">
          {/* Force Sync */}
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div>
              <div className="text-sm font-medium text-text">Force Sync Now</div>
              <div className="text-xs text-muted mt-1">
                Trigger immediate sync of all pending operations
              </div>
            </div>
            <button
              onClick={forceSync}
              disabled={isForcing || !user}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isForcing ? 'Syncing...' : 'Force Sync'}
            </button>
          </div>

          {/* Seed Test Data */}
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div>
              <div className="text-sm font-medium text-text">Seed Test Data</div>
              <div className="text-xs text-muted mt-1">
                Add sample songs, setlists, and practices for testing
              </div>
            </div>
            <button
              onClick={seedTestData}
              disabled={!user}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Seed Data
            </button>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="p-4 bg-surface rounded-lg border border-divider">
        <h3 className="text-sm font-medium text-text mb-2">💡 Tool Usage Tips</h3>
        <ul className="text-xs text-muted space-y-1">
          <li>• <strong>Clear Local DB:</strong> Useful when testing initial sync from cloud</li>
          <li>• <strong>Force Sync:</strong> Use when sync seems stuck or to test sync logic</li>
          <li>• <strong>Export JSON:</strong> Inspect database contents or backup data</li>
          <li>• <strong>Seed Data:</strong> Quickly populate database with test content</li>
          <li>• <strong className="text-error">CLEAR SUPABASE:</strong> Only use in development! Deletes everything!</li>
        </ul>
      </div>
    </div>
  )
}
