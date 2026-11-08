import React, { useState, useEffect, useRef } from 'react'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { TuningsSection } from '../components/tunings/TuningsSection'
import { Segmented } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import {
  User,
  Mail,
  Key,
  AlertTriangle,
  Trash2,
  X,
  Code,
  Database,
  Info,
  SunMoon,
} from 'lucide-react'
import { isDev } from '../config/environment'
import { queryClient } from '../services/queryClient'
import { logger } from '../utils/logger'
import { VERSION_DISPLAY, BUILD_ID } from '../config/buildInfo'

/**
 * Settings Page
 *
 * Features:
 * - Account information (read-only)
 * - Delete account functionality
 * - Developer section (dev-mode only)
 *
 * Test IDs:
 * - settings-page
 * - account-section
 * - account-email
 * - account-name
 * - account-user-id
 * - delete-account-button
 * - delete-account-modal
 * - delete-account-confirm-button
 * - delete-account-cancel-button
 * - dev-section
 * - clear-local-data-button
 * - version-info
 */
export const SettingsPage: React.FC = () => {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      showToast('Please type DELETE to confirm', 'error')
      return
    }

    setIsDeleting(true)
    try {
      logger.info('User requested account deletion:', user?.id)

      // For now, just clear local data and sign out
      // TODO: Implement proper account deletion via Supabase RPC function
      // This requires creating a database function that properly cascades deletion
      logger.warn(
        'Account deletion not yet implemented - clearing local data only'
      )

      // Clear the in-memory query cache (no local IndexedDB mirror anymore)
      queryClient.clear()

      showToast('Local data cleared. Account deletion coming soon.', 'info')

      // Sign out (will redirect to login)
      await signOut()
    } catch (error) {
      logger.error('Failed to delete account:', error)
      showToast('Failed to delete account. Please contact support.', 'error')
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
      setDeleteConfirmation('')
    }
  }

  const handleClearLocalData = async () => {
    const confirmed = await confirm({
      title: 'Clear Local Data',
      message: 'Clear all local data? This will log you out.',
      variant: 'danger',
      confirmLabel: 'Clear Data',
    })
    if (!confirmed) {
      return
    }

    try {
      logger.info('Clearing in-memory query cache')
      queryClient.clear()
      showToast('Local data cleared', 'success')

      // Sign out to force fresh sync on next login
      await signOut()
    } catch (error) {
      logger.error('Failed to clear local data:', error)
      showToast('Failed to clear local data', 'error')
    }
  }

  // Desktop left-nav sections (scroll-spy jump list). Mobile stacks them all.
  const navSections = [
    { id: 'settings-account', label: 'Account' },
    { id: 'settings-appearance', label: 'Appearance' },
    { id: 'settings-tunings', label: 'Tunings' },
    { id: 'settings-privacy', label: 'Data & Privacy' },
    { id: 'settings-app-info', label: 'App Info' },
    ...(isDev ? [{ id: 'settings-developer', label: 'Developer' }] : []),
  ]
  const [activeSection, setActiveSection] = useState(navSections[0].id)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const els = navSections
      .map(s => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length === 0) return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0]
        if (visible) setActiveSection(visible.target.id)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
    // navSections is derived from isDev only; re-run when dev-mode set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDev])

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  if (!user) {
    return (
      <ContentLoadingSpinner isLoading={false}>
        <div data-testid="settings-page" className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <p className="text-ink-3">Please sign in to view settings</p>
          </div>
        </div>
      </ContentLoadingSpinner>
    )
  }

  return (
    <ContentLoadingSpinner isLoading={false}>
      <div data-testid="settings-page" className="max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="font-display font-extrabold uppercase leading-[.9] text-[46px] md:text-[50px] text-ink-1 mb-2">
            Settings
          </h1>
          <p className="text-ink-3">
            Manage your account and application preferences
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
          {/* Desktop left-nav (scroll-spy); mobile stacks all sections */}
          <nav
            className="hidden lg:block"
            aria-label="Settings sections"
            data-testid="settings-nav"
          >
            <div className="sticky top-4 flex flex-col gap-1">
              {navSections.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  data-testid={`settings-nav-${s.id}`}
                  aria-current={activeSection === s.id ? 'true' : undefined}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    activeSection === s.id
                      ? 'bg-accent-soft text-accent'
                      : 'text-ink-3 hover:bg-bg-2 hover:text-ink-1'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content column */}
          <div ref={contentRef} className="min-w-0 space-y-6">
            {/* Account Section */}
            <section
              id="settings-account"
              className="scroll-mt-4 bg-surface-elevated rounded-lg border border-border-1 p-6"
              data-testid="account-section"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-info/10 rounded-lg">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-ink-1">Account</h2>
              </div>

              <div className="space-y-4">
                {/* Email */}
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-ink-3 mt-0.5" />
                  <div className="flex-1">
                    <label className="text-sm text-ink-3 block mb-1">
                      Email
                    </label>
                    <p
                      className="text-ink-1 font-medium"
                      data-testid="account-email"
                    >
                      {user.email}
                    </p>
                  </div>
                </div>

                {/* Name */}
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-ink-3 mt-0.5" />
                  <div className="flex-1">
                    <label className="text-sm text-ink-3 block mb-1">
                      Name
                    </label>
                    <p
                      className="text-ink-1 font-medium"
                      data-testid="account-name"
                    >
                      {user.name}
                    </p>
                  </div>
                </div>

                {/* User ID */}
                <div className="flex items-start gap-3">
                  <Key className="w-5 h-5 text-ink-3 mt-0.5" />
                  <div className="flex-1">
                    <label className="text-sm text-ink-3 block mb-1">
                      User ID
                    </label>
                    <p
                      className="text-ink-3 text-sm font-mono"
                      data-testid="account-user-id"
                    >
                      {user.id}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Appearance */}
            <section
              id="settings-appearance"
              className="scroll-mt-4 bg-surface-elevated rounded-lg border border-border-1 p-6"
              data-testid="appearance-section"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <SunMoon className="w-5 h-5 text-accent-ink" />
                </div>
                <h2 className="text-xl font-semibold text-ink-1">Appearance</h2>
              </div>
              <Segmented
                label="Theme"
                data-testid="theme-segmented"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
              <p className="mt-3 text-sm text-ink-3">
                System follows your device. Stage screens stay easy to read
                either way.
              </p>
            </section>

            {/* Tunings Section (fork #2) */}
            <div id="settings-tunings" className="scroll-mt-4">
              <TuningsSection />
            </div>

            {/* Data & Privacy Section */}
            <section
              id="settings-privacy"
              className="scroll-mt-4 bg-surface-elevated rounded-lg border border-border-1 p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-ink-1">
                  Data &amp; Privacy
                </h2>
              </div>

              <div className="space-y-4">
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-ink-1 font-semibold mb-1">
                        Delete Account
                      </h3>
                      <p className="text-sm text-ink-3 mb-4">
                        Permanently delete your account and all associated data.
                        This action cannot be undone.
                      </p>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                        data-testid="delete-account-button"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* App Info Section - Always visible */}
            <section
              id="settings-app-info"
              className="scroll-mt-4 bg-surface-elevated rounded-lg border border-border-1 p-6"
              data-testid="app-info-section"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-info/10 rounded-lg">
                  <Info className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-ink-1">App Info</h2>
              </div>

              <div className="space-y-4">
                {/* Version Info */}
                <div className="flex items-start gap-3">
                  <Code className="w-5 h-5 text-ink-3 mt-0.5" />
                  <div className="flex-1">
                    <label className="text-sm text-ink-3 block mb-1">
                      Version
                    </label>
                    <p
                      className="text-ink-1 font-mono text-sm"
                      data-testid="version-info"
                    >
                      {VERSION_DISPLAY}
                    </p>
                    <p className="text-xs text-ink-4 mt-1">Build: {BUILD_ID}</p>
                    <p className="text-xs text-ink-4 mt-1">
                      If your app is outdated, try refreshing or clearing
                      browser cache.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Developer Section (Dev Mode Only) */}
            {isDev && (
              <section
                id="settings-developer"
                className="scroll-mt-4 bg-surface-elevated rounded-lg border border-green-500/20 p-6"
                data-testid="dev-section"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Code className="w-5 h-5 text-green-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-ink-1">
                    Developer
                  </h2>
                  <span className="ml-auto px-2 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded">
                    DEV MODE
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Clear Local Data */}
                  <div className="flex items-start gap-3">
                    <Database className="w-5 h-5 text-ink-3 mt-0.5" />
                    <div className="flex-1">
                      <label className="text-sm text-ink-3 block mb-1">
                        Local Database
                      </label>
                      <p className="text-sm text-ink-3 mb-3">
                        Clear cached data from this browser. This will log you
                        out; your data is reloaded from the cloud on next login.
                      </p>
                      <button
                        onClick={handleClearLocalData}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-ink-1 rounded-lg font-medium transition-colors flex items-center gap-2"
                        data-testid="clear-local-data-button"
                      >
                        <Database className="w-4 h-4" />
                        Clear Local Data
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          data-testid="delete-account-modal"
        >
          <div className="bg-surface-elevated border border-white/10 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-ink-1">Delete Account</h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmation('')
                }}
                className="text-ink-3 hover:text-ink-1 transition-colors"
                disabled={isDeleting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-start gap-3 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-300">
                  <p className="font-semibold text-ink-1 mb-1">Warning</p>
                  <p>
                    This will permanently delete your account and all associated
                    data:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-ink-3">
                    <li>All bands you created</li>
                    <li>All songs, setlists, and practices</li>
                    <li>All band memberships</li>
                  </ul>
                  <p className="mt-2 font-semibold text-red-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <label className="block text-sm text-ink-3 mb-2">
                Type <span className="font-mono text-ink-1">DELETE</span> to
                confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={e => setDeleteConfirmation(e.target.value)}
                className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-ink-1 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="DELETE"
                disabled={isDeleting}
                autoFocus
                data-testid="delete-account-confirmation-input"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmation('')
                }}
                className="flex-1 px-4 py-2 bg-surface border border-white/10 text-ink-1 rounded-lg font-medium hover:bg-surface-elevated transition-colors"
                disabled={isDeleting}
                data-testid="delete-account-cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                data-testid="delete-account-confirm-button"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </ContentLoadingSpinner>
  )
}
