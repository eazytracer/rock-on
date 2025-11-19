/**
 * Developer Dashboard
 *
 * Dev-only tools for validating sync, debugging issues, and manual testing.
 * NOT included in production builds.
 */

import React, { useState } from 'react'
import { DatabaseInspector } from './tabs/DatabaseInspector'
import { SyncQueueViewer } from './tabs/SyncQueueViewer'
import { NetworkInspector } from './tabs/NetworkInspector'
import { DevTools } from './tabs/DevTools'
import { Documentation } from './tabs/Documentation'

type TabId = 'database' | 'sync-queue' | 'network' | 'tools' | 'docs'

interface Tab {
  id: TabId
  label: string
  icon: string
}

const tabs: Tab[] = [
  { id: 'database', label: 'Database', icon: '🗄️' },
  { id: 'sync-queue', label: 'Sync Queue', icon: '⏳' },
  { id: 'network', label: 'Network', icon: '🌐' },
  { id: 'tools', label: 'Dev Tools', icon: '🛠️' },
  { id: 'docs', label: 'Documentation', icon: '📚' },
]

export const DevDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('database')

  // Environment guard - only show in development
  if (import.meta.env.PROD) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-error mb-2">Access Denied</h1>
          <p className="text-muted">Developer Dashboard is not available in production.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-primary text-white px-6 py-4 border-b border-primary-light">
        <h1 className="text-2xl font-bold">🔧 Developer Dashboard</h1>
        <p className="text-sm text-primary-light mt-1">
          Debug tools for sync validation and testing
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-divider">
        <div className="flex px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text hover:border-divider'
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className={activeTab === 'docs' ? '' : 'p-6'}>
        {activeTab === 'database' && <DatabaseInspector />}
        {activeTab === 'sync-queue' && <SyncQueueViewer />}
        {activeTab === 'network' && <NetworkInspector />}
        {activeTab === 'tools' && <DevTools />}
        {activeTab === 'docs' && <Documentation />}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-divider px-6 py-3 text-xs text-muted">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span>Dev Dashboard v1.0 • {import.meta.env.MODE} mode</span>
            <span className="text-primary font-medium">
              🗄️ Database: {
                import.meta.env.VITE_SUPABASE_URL?.includes('127.0.0.1') ||
                import.meta.env.VITE_SUPABASE_URL?.includes('localhost')
                  ? 'Local Supabase'
                  : import.meta.env.VITE_SUPABASE_URL?.includes('supabase.co')
                  ? `Production (${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]})`
                  : import.meta.env.VITE_MOCK_AUTH === 'true'
                  ? 'Mock/IndexedDB Only'
                  : 'Unknown'
              }
            </span>
          </div>
          <span className="text-warning">⚠️ Development Only - Not in Production</span>
        </div>
      </div>
    </div>
  )
}
