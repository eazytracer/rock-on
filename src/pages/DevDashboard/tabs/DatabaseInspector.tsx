/* eslint-disable react-hooks/exhaustive-deps */
/**
 * Database Inspector Tab
 *
 * Compares IndexedDB vs Supabase record counts to verify sync consistency.
 * Provides data validation and mismatch detection.
 */

import React, { useState, useEffect } from 'react'
import { db } from '../../../services/database'
import { supabase } from '../../../services/supabase/client'
import { useAuth } from '../../../contexts/AuthContext'

interface TableStats {
  tableName: string
  indexedDBCount: number | null
  supabaseCount: number | null
  match: boolean
  error?: string
}

export const DatabaseInspector: React.FC = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState<TableStats[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchStats = async () => {
    if (!user) {
      setStats([])
      setLoading(false)
      return
    }

    setLoading(true)

    // Table name mapping: Supabase (snake_case) -> IndexedDB (camelCase)
    const tableMapping: Record<string, string> = {
      songs: 'songs',
      setlists: 'setlists',
      shows: 'shows',
      practice_sessions: 'practiceSessions',
      bands: 'bands',
      band_memberships: 'bandMemberships',
    }

    const tables = Object.keys(tableMapping)
    const results: TableStats[] = []

    for (const tableName of tables) {
      try {
        // Get IndexedDB count (using camelCase name)
        let indexedDBCount: number | null = null
        try {
          const indexedDBTableName = tableMapping[tableName]
          const localTable = db.table(indexedDBTableName)
          indexedDBCount = await localTable.count()
        } catch (err) {
          console.warn(`IndexedDB error for ${tableName}:`, err)
        }

        // Get Supabase count
        let supabaseCount: number | null = null
        try {
          if (!supabase) {
            throw new Error('Supabase client not initialized')
          }
          const { count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true })

          if (error) throw error
          supabaseCount = count
        } catch (err) {
          console.warn(`Supabase error for ${tableName}:`, err)
        }

        results.push({
          tableName,
          indexedDBCount,
          supabaseCount,
          match: indexedDBCount === supabaseCount && indexedDBCount !== null,
          error:
            indexedDBCount === null || supabaseCount === null
              ? 'Failed to fetch'
              : undefined,
        })
      } catch (err) {
        results.push({
          tableName,
          indexedDBCount: null,
          supabaseCount: null,
          match: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    setStats(results)
    setLastRefresh(new Date())
    setLoading(false)
  }

  useEffect(() => {
    fetchStats()
  }, [user])

  const totalMismatches = stats.filter(s => !s.match && !s.error).length
  const totalErrors = stats.filter(s => s.error).length

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text mb-2">Database Inspector</h2>
        <p className="text-sm text-muted mb-4">
          Compare IndexedDB (local) vs Supabase (cloud) record counts to verify
          sync consistency.
        </p>

        {/* Status Summary */}
        <div className="flex gap-4 mb-4">
          <div
            className={`px-4 py-2 rounded-lg ${totalMismatches === 0 && totalErrors === 0 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}
          >
            <div className="text-2xl font-bold">{totalMismatches}</div>
            <div className="text-xs">Mismatches</div>
          </div>
          <div
            className={`px-4 py-2 rounded-lg ${totalErrors === 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}
          >
            <div className="text-2xl font-bold">{totalErrors}</div>
            <div className="text-xs">Errors</div>
          </div>
          <div className="px-4 py-2 rounded-lg bg-primary/10 text-primary">
            <div className="text-2xl font-bold">{stats.length}</div>
            <div className="text-xs">Tables</div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh Stats'}
          </button>
          {lastRefresh && (
            <span className="text-xs text-muted">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Auth Warning */}
      {!user && (
        <div className="bg-warning/10 border border-warning text-warning px-4 py-3 rounded-lg mb-6">
          <div className="font-medium mb-1">⚠️ Not Authenticated</div>
          <div className="text-sm">
            Please log in to view database statistics.
          </div>
        </div>
      )}

      {/* Stats Table */}
      {user && (
        <div className="bg-white rounded-lg border border-divider overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-text">
                  Table
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text">
                  IndexedDB
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text">
                  Supabase
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-text">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    Loading statistics...
                  </td>
                </tr>
              ) : stats.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No data available
                  </td>
                </tr>
              ) : (
                stats.map(stat => (
                  <tr
                    key={stat.tableName}
                    className="hover:bg-surface/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-text">
                      {stat.tableName}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-text">
                      {stat.indexedDBCount !== null
                        ? stat.indexedDBCount.toLocaleString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-text">
                      {stat.supabaseCount !== null
                        ? stat.supabaseCount.toLocaleString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {stat.error ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-error/10 text-error">
                          ❌ Error
                        </span>
                      ) : stat.match ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-success/10 text-success">
                          ✅ Match
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-warning/10 text-warning">
                          ⚠️ Mismatch
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 p-4 bg-surface rounded-lg border border-divider">
        <h3 className="text-sm font-medium text-text mb-2">
          💡 Understanding Mismatches
        </h3>
        <ul className="text-xs text-muted space-y-1">
          <li>
            • <strong>Match:</strong> Local and cloud data are in sync
          </li>
          <li>
            • <strong>Mismatch:</strong> Data counts differ - may indicate
            pending sync operations
          </li>
          <li>
            • <strong>Error:</strong> Failed to fetch data from one or both
            sources
          </li>
        </ul>
        <p className="text-xs text-muted mt-3">
          <strong>Note:</strong> Temporary mismatches are normal during sync
          operations. If mismatches persist, check the Sync Queue tab for
          pending operations.
        </p>
      </div>
    </div>
  )
}
