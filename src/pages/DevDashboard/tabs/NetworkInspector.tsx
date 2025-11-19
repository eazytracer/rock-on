/**
 * Network Inspector Tab
 *
 * Displays WebSocket connection status and provides controls to simulate
 * network conditions (offline mode, slow network, etc.)
 */

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useSyncStatus } from '../../../hooks/useSyncStatus'

interface ConnectionStatus {
  websocketConnected: boolean
  lastHeartbeat: Date | null
  connectionErrors: string[]
  uptime: number // seconds
}

export const NetworkInspector: React.FC = () => {
  const { user } = useAuth()
  const { isSyncing, isOnline, lastSyncTime } = useSyncStatus()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    websocketConnected: false,
    lastHeartbeat: null,
    connectionErrors: [],
    uptime: 0
  })
  const [isSimulatingOffline, setIsSimulatingOffline] = useState(false)

  // TODO: Hook into actual WebSocket connection status
  // For now, infer from sync status
  useEffect(() => {
    setConnectionStatus({
      websocketConnected: isOnline && !isSyncing,
      lastHeartbeat: lastSyncTime || null,
      connectionErrors: [],
      uptime: 0
    })
  }, [isOnline, isSyncing, lastSyncTime])

  const simulateOffline = () => {
    // TODO: Implement actual offline simulation
    // This would disconnect WebSocket and prevent HTTP requests
    setIsSimulatingOffline(!isSimulatingOffline)
    alert('Offline simulation not yet implemented. This will disconnect WebSocket and queue operations.')
  }

  const forceReconnect = () => {
    // TODO: Implement WebSocket reconnection
    alert('Force reconnect not yet implemented. This will close and reopen the WebSocket connection.')
  }

  const clearConnectionErrors = () => {
    setConnectionStatus(prev => ({
      ...prev,
      connectionErrors: []
    }))
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text mb-2">Network Inspector</h2>
        <p className="text-sm text-muted mb-4">
          Monitor WebSocket connection status and simulate network conditions.
        </p>
      </div>

      {/* Auth Warning */}
      {!user && (
        <div className="bg-warning/10 border border-warning text-warning px-4 py-3 rounded-lg mb-6">
          <div className="font-medium mb-1">⚠️ Not Authenticated</div>
          <div className="text-sm">Please log in to view network status.</div>
        </div>
      )}

      {user && (
        <>
          {/* Connection Status */}
          <div className="bg-white rounded-lg border border-divider p-6 mb-6">
            <h3 className="text-lg font-medium text-text mb-4">Connection Status</h3>

            <div className="grid grid-cols-2 gap-6">
              {/* WebSocket Status */}
              <div>
                <div className="text-sm text-muted mb-2">WebSocket</div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${connectionStatus.websocketConnected ? 'bg-success animate-pulse' : 'bg-error'}`} />
                  <span className={`text-lg font-medium ${connectionStatus.websocketConnected ? 'text-success' : 'text-error'}`}>
                    {connectionStatus.websocketConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              {/* Sync Status */}
              <div>
                <div className="text-sm text-muted mb-2">Sync Status</div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-text capitalize">
                    {isSyncing ? 'Syncing' : isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Last Heartbeat */}
              <div>
                <div className="text-sm text-muted mb-2">Last Heartbeat</div>
                <div className="text-sm text-text">
                  {connectionStatus.lastHeartbeat
                    ? connectionStatus.lastHeartbeat.toLocaleTimeString()
                    : 'Never'}
                </div>
              </div>

              {/* Last Sync */}
              <div>
                <div className="text-sm text-muted mb-2">Last Sync</div>
                <div className="text-sm text-text">
                  {lastSyncTime
                    ? new Date(lastSyncTime).toLocaleTimeString()
                    : 'Never'}
                </div>
              </div>
            </div>

            {/* Connection Errors */}
            {connectionStatus.connectionErrors.length > 0 && (
              <div className="mt-4 p-3 bg-error/10 border border-error rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-error">Connection Errors</span>
                  <button
                    onClick={clearConnectionErrors}
                    className="text-xs text-error hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <ul className="text-xs text-error space-y-1">
                  {connectionStatus.connectionErrors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Network Controls */}
          <div className="bg-white rounded-lg border border-divider p-6 mb-6">
            <h3 className="text-lg font-medium text-text mb-4">Network Controls</h3>

            <div className="space-y-4">
              {/* Simulate Offline */}
              <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
                <div>
                  <div className="text-sm font-medium text-text">Simulate Offline Mode</div>
                  <div className="text-xs text-muted mt-1">
                    Disconnect WebSocket and queue all operations locally
                  </div>
                </div>
                <button
                  onClick={simulateOffline}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isSimulatingOffline
                      ? 'bg-success text-white hover:bg-success/80'
                      : 'bg-error text-white hover:bg-error/80'
                  }`}
                >
                  {isSimulatingOffline ? 'Go Online' : 'Go Offline'}
                </button>
              </div>

              {/* Force Reconnect */}
              <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
                <div>
                  <div className="text-sm font-medium text-text">Force Reconnect</div>
                  <div className="text-xs text-muted mt-1">
                    Close and reopen WebSocket connection
                  </div>
                </div>
                <button
                  onClick={forceReconnect}
                  disabled={!connectionStatus.websocketConnected}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Reconnect
                </button>
              </div>

              {/* Simulate Slow Network (TODO) */}
              <div className="flex items-center justify-between p-4 bg-surface rounded-lg opacity-50">
                <div>
                  <div className="text-sm font-medium text-text">Simulate Slow Network</div>
                  <div className="text-xs text-muted mt-1">
                    Add artificial latency to sync operations (Coming Soon)
                  </div>
                </div>
                <button
                  disabled
                  className="px-4 py-2 bg-muted text-white rounded-lg cursor-not-allowed"
                >
                  Not Implemented
                </button>
              </div>
            </div>
          </div>

          {/* WebSocket Events Log (TODO) */}
          <div className="bg-white rounded-lg border border-divider p-6">
            <h3 className="text-lg font-medium text-text mb-4">WebSocket Events</h3>
            <div className="text-center py-8">
              <div className="text-muted mb-2">📡 Event logging coming soon</div>
              <div className="text-xs text-muted">
                Will show real-time WebSocket events (connect, disconnect, messages, errors)
              </div>
            </div>
          </div>
        </>
      )}

      {/* Help Text */}
      <div className="mt-6 p-4 bg-surface rounded-lg border border-divider">
        <h3 className="text-sm font-medium text-text mb-2">💡 Network Controls Usage</h3>
        <ul className="text-xs text-muted space-y-1">
          <li>• <strong>Simulate Offline:</strong> Test how the app behaves without network connectivity</li>
          <li>• <strong>Force Reconnect:</strong> Useful for debugging WebSocket connection issues</li>
          <li>• <strong>WebSocket Events:</strong> Monitor real-time sync events (coming soon)</li>
        </ul>
      </div>
    </div>
  )
}
