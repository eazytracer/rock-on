/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Sync Queue Viewer Tab
 *
 * Displays pending sync operations from the audit_log table.
 * Shows operations that are queued but not yet synced to cloud.
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../../../services/supabase/client'
import { useAuth } from '../../../contexts/AuthContext'

interface QueuedOperation {
  id: string
  operation: string
  tableName: string
  recordId: string
  timestamp: Date
  changeData: any
  retryCount?: number
}

export const SyncQueueViewer: React.FC = () => {
  const { user } = useAuth()
  const [queuedOps, setQueuedOps] = useState<QueuedOperation[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchQueue = async () => {
    if (!user) {
      setQueuedOps([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Get audit_log entries from Supabase (cloud-only)
      // In audit-first architecture, audit_log only exists in Supabase
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data: auditLog, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const operations: QueuedOperation[] = (auditLog || []).map(
        (entry: any) => ({
          id: entry.id,
          operation: entry.action,
          tableName: entry.table_name,
          recordId: entry.record_id,
          timestamp: new Date(entry.changed_at),
          changeData: entry.new_values || entry.old_values || {},
          retryCount: 0,
        })
      )

      setQueuedOps(operations)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Failed to fetch audit log:', err)
      setQueuedOps([])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchQueue()
  }, [user])

  const getOperationBadge = (operation: string) => {
    switch (operation.toUpperCase()) {
      case 'INSERT':
        return 'bg-success/10 text-success'
      case 'UPDATE':
        return 'bg-warning/10 text-warning'
      case 'DELETE':
        return 'bg-error/10 text-error'
      default:
        return 'bg-muted/10 text-muted'
    }
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text mb-2">Sync Queue Viewer</h2>
        <p className="text-sm text-muted mb-4">
          View recent audit log entries representing sync operations.
        </p>

        {/* Status Summary */}
        <div className="flex gap-4 mb-4">
          <div className="px-4 py-2 rounded-lg bg-primary/10 text-primary">
            <div className="text-2xl font-bold">{queuedOps.length}</div>
            <div className="text-xs">Recent Operations</div>
          </div>
          <div className="px-4 py-2 rounded-lg bg-success/10 text-success">
            <div className="text-2xl font-bold">
              {
                queuedOps.filter(op => op.operation.toUpperCase() === 'INSERT')
                  .length
              }
            </div>
            <div className="text-xs">Creates</div>
          </div>
          <div className="px-4 py-2 rounded-lg bg-warning/10 text-warning">
            <div className="text-2xl font-bold">
              {
                queuedOps.filter(op => op.operation.toUpperCase() === 'UPDATE')
                  .length
              }
            </div>
            <div className="text-xs">Updates</div>
          </div>
          <div className="px-4 py-2 rounded-lg bg-error/10 text-error">
            <div className="text-2xl font-bold">
              {
                queuedOps.filter(op => op.operation.toUpperCase() === 'DELETE')
                  .length
              }
            </div>
            <div className="text-xs">Deletes</div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={fetchQueue}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh Queue'}
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
          <div className="text-sm">Please log in to view sync queue.</div>
        </div>
      )}

      {/* Queue List */}
      {user && (
        <div className="bg-white rounded-lg border border-divider overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-muted">
              Loading queue...
            </div>
          ) : queuedOps.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="text-muted mb-2">✅ Queue is empty</div>
              <div className="text-xs text-muted">
                All operations have been synced.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {queuedOps.map(op => (
                <div
                  key={op.id}
                  className="p-4 hover:bg-surface/50 transition-colors"
                >
                  {/* Operation Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getOperationBadge(op.operation)}`}
                      >
                        {op.operation.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-text">
                        {op.tableName}
                      </span>
                      <span className="text-xs text-muted">
                        ID: {op.recordId.slice(0, 8)}...
                      </span>
                    </div>
                    <span className="text-xs text-muted">
                      {op.timestamp.toLocaleString()}
                    </span>
                  </div>

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === op.id ? null : op.id)
                    }
                    className="text-xs text-primary hover:underline"
                  >
                    {expandedId === op.id
                      ? '▼ Hide Details'
                      : '▶ Show Details'}
                  </button>

                  {/* Expanded Details */}
                  {expandedId === op.id && (
                    <div className="mt-3 p-3 bg-surface rounded border border-divider">
                      <div className="text-xs font-medium text-text mb-2">
                        Change Data:
                      </div>
                      <pre className="text-xs text-muted bg-white p-2 rounded border border-divider overflow-x-auto">
                        {JSON.stringify(op.changeData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 p-4 bg-surface rounded-lg border border-divider">
        <h3 className="text-sm font-medium text-text mb-2">
          💡 About the Sync Queue
        </h3>
        <ul className="text-xs text-muted space-y-1">
          <li>• Shows recent entries from the audit_log table (last 100)</li>
          <li>
            • In audit-first architecture, audit_log acts as the sync queue
          </li>
          <li>
            • Operations are immediately synced when online via RealtimeManager
          </li>
          <li>
            • When offline, operations accumulate and sync when connection
            returns
          </li>
        </ul>
      </div>
    </div>
  )
}
