/**
 * Settings (docs/redesign/13 · 6e; Account and Settings 5–9, 11; desktop
 * `settings`). `/settings/:section`.
 *
 * Phone: `/settings` is the list (profile row, Appearance inline, Account,
 * Music, Notifications, About, Delete account… alone at the bottom); each row
 * opens its section as a sub-screen with "‹ Settings" in the app bar.
 * Desktop: tabs (Profile · Appearance · Music · Notifications · Account ·
 * About); `/settings` shows Profile. Password and Delete account live under
 * the Account tab. Developer (dev mode only) stays.
 */
import React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Database } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useTheme } from '../contexts/ThemeContext'
import { useConfirm } from '../hooks/useConfirm'
import { useMediaQuery } from '../hooks/useResponsive'
import {
  useMetronomePrefs,
  useMyProfile,
  usePushPrefs,
  useSignInMethods,
} from '../hooks/useAccount'
import { useTunings } from '../hooks/useTunings'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { Avatar } from '../components/common/Avatar'
import { BackCrumb } from '../components/layout/MobileHeader'
import { Group, ListRow, PageTitle, Segmented } from '../components/ui'
import { ProfileSettings } from '../components/settings/ProfileSettings'
import { MusicSettings } from '../components/settings/MusicSettings'
import { NotificationSettings } from '../components/settings/NotificationSettings'
import { AccountSettings } from '../components/settings/AccountSettings'
import { CLICK_LABELS, methodsText } from '../components/settings/labels'
import { AboutRows, AboutSettings } from '../components/settings/AboutSettings'
import { DeleteAccount } from '../components/settings/DeleteAccount'
import { isDev } from '../config/environment'
import { queryClient } from '../services/queryClient'
import { createLogger } from '../utils/logger'

const log = createLogger('SettingsPage')

type Section =
  | 'profile'
  | 'appearance'
  | 'music'
  | 'notifications'
  | 'account'
  | 'password'
  | 'about'
  | 'delete'
  | 'developer'

const TITLES: Record<Section, string> = {
  profile: 'Profile',
  appearance: 'Appearance',
  music: 'Music',
  notifications: 'Notifications',
  account: 'Account',
  password: 'Account',
  about: 'About',
  delete: 'Delete account',
  developer: 'Developer',
}

const TABS: Section[] = [
  'profile',
  'appearance',
  'music',
  'notifications',
  'account',
  'about',
  ...(isDev ? (['developer'] as Section[]) : []),
]

const isSection = (s: string | undefined): s is Section =>
  !!s && s in TITLES && (s !== 'developer' || isDev)

const ThemeControl: React.FC = () => {
  const { theme, setTheme } = useTheme()
  return (
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
  )
}

const AppearanceSettings: React.FC = () => (
  <div data-testid="appearance-section">
    <Group>
      <div className="p-4">
        <ThemeControl />
      </div>
    </Group>
    <p className="px-6 text-[13px] text-ink-3">
      System follows your device. Stage screens stay easy to read either way.
    </p>
  </div>
)

const DeveloperSettings: React.FC = () => {
  const { signOut } = useAuth()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const clear = async () => {
    const ok = await confirm({
      title: 'Clear local data',
      message: 'Clear the cached data in this browser? This signs you out.',
      variant: 'danger',
      confirmLabel: 'Clear data',
    })
    if (!ok) return
    try {
      queryClient.clear()
      showToast('Local data cleared', 'success')
      await signOut()
    } catch (error) {
      log.error('Failed to clear local data:', error)
      showToast('Failed to clear local data', 'error')
    }
  }
  return (
    <div data-testid="dev-section">
      <Group label="Developer · dev mode">
        <ListRow
          lead={<Database size={20} className="text-ink-3 shrink-0" />}
          title="Clear local data"
          sub="Clears this browser's cache and signs you out"
          onClick={() => void clear()}
          data-testid="clear-local-data-button"
        />
      </Group>
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

const SectionBody: React.FC<{ section: Section; desktop: boolean }> = ({
  section,
  desktop,
}) => {
  switch (section) {
    case 'profile':
      return <ProfileSettings />
    case 'appearance':
      return <AppearanceSettings />
    case 'music':
      return <MusicSettings />
    case 'notifications':
      return <NotificationSettings />
    case 'account':
    case 'password':
      return (
        <AccountSettings
          key={section}
          passwordOpen={section === 'password'}
          showDelete={desktop}
        />
      )
    case 'about':
      return <AboutSettings />
    case 'delete':
      return <DeleteAccount />
    case 'developer':
      return <DeveloperSettings />
  }
}

/** Phone `/settings`: the list. */
const SettingsList: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useMyProfile()
  const { data: providers } = useSignInMethods()
  const { prefs: metro } = useMetronomePrefs()
  const { prefs: push } = usePushPrefs()
  const { customs } = useTunings()
  const go = (s: Section) => () => navigate(`/settings/${s}`)
  const chev = <ChevronRight size={18} />
  const name = profile?.name || user?.name || ''

  return (
    <div data-testid="settings-list">
      <Group>
        <ListRow
          lead={
            <Avatar
              label={name || '?'}
              color={profile?.personalColor ?? undefined}
            />
          }
          title={name || 'Your profile'}
          sub={
            profile?.instruments.length
              ? `Profile · ${profile.instruments.join(', ')}`
              : 'Profile · name, instruments, colour'
          }
          trail={chev}
          onClick={go('profile')}
          data-testid="settings-row-profile"
        />
      </Group>
      <Group label="Appearance" data-testid="appearance-section">
        <div className="p-3">
          <ThemeControl />
        </div>
      </Group>
      <Group label="Account">
        <ListRow
          title="Email"
          sub={<span data-testid="account-email">{user?.email}</span>}
          trail={chev}
          onClick={go('account')}
          data-testid="settings-row-account"
        />
        <ListRow
          title="Sign-in methods"
          sub={providers ? methodsText(providers) : '…'}
          trail={chev}
          onClick={go('account')}
        />
        {(providers ?? []).includes('email') && (
          <ListRow
            title="Change password"
            trail={chev}
            onClick={go('password')}
            data-testid="settings-row-password"
          />
        )}
      </Group>
      <Group label="Music">
        <ListRow
          title="Click sound"
          sub={CLICK_LABELS[metro.click].title}
          trail={chev}
          onClick={go('music')}
          data-testid="settings-row-music"
        />
        <ListRow
          title="Tunings"
          sub={customs.length ? `${customs.length} custom` : 'Built in only'}
          trail={chev}
          onClick={go('music')}
        />
      </Group>
      <Group label="Notifications">
        <ListRow
          title="Push notifications"
          sub={push.enabled ? 'Reminders, changes, invites' : 'Off'}
          trail={chev}
          onClick={go('notifications')}
          data-testid="settings-row-notifications"
        />
      </Group>
      <Group label="About" data-testid="app-info-section">
        <AboutRows />
      </Group>
      {isDev && <DeveloperSettings />}
      <div className="pt-3">
        <Group>
          <ListRow
            title={<span className="text-danger">Delete account…</span>}
            onClick={go('delete')}
            data-testid="delete-account-button"
          />
        </Group>
      </div>
    </div>
  )
}

export const SettingsPage: React.FC = () => {
  const { section: param } = useParams()
  const desktop = useMediaQuery('(min-width: 768px)')
  const navigate = useNavigate()
  const { user } = useAuth()

  if (!user)
    return (
      <div data-testid="settings-page" className="py-12 text-center">
        <p className="text-ink-3">Please sign in to view settings</p>
      </div>
    )
  if (param !== undefined && !isSection(param))
    return <Navigate to="/settings" replace />

  if (!desktop) {
    if (!param)
      return (
        <div data-testid="settings-page" className="-mx-3 pb-8">
          <BackCrumb to="/more" label="More" data-testid="settings-back" />
          <div className="px-3">
            <PageTitle title="Settings" />
          </div>
          <SettingsList />
        </div>
      )
    return (
      <div
        data-testid="settings-page"
        data-section={param}
        className="-mx-3 pb-8"
      >
        <BackCrumb
          to="/settings"
          label="Settings"
          data-testid="settings-back"
        />
        <div className="px-3">
          <PageTitle title={TITLES[param]} />
        </div>
        <SectionBody section={param} desktop={false} />
      </div>
    )
  }

  const section: Section = param ?? 'profile'
  const tab: Section =
    section === 'password' || section === 'delete' ? 'account' : section

  return (
    <div
      data-testid="settings-page"
      data-section={section}
      className="max-w-5xl"
    >
      <PageTitle title="Settings" eyebrow="You" />
      <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-8">
        <nav aria-label="Settings sections" data-testid="settings-nav">
          <div className="sticky top-4 flex flex-col gap-1">
            {TABS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => navigate(`/settings/${s}`)}
                aria-current={tab === s ? 'page' : undefined}
                data-testid={`settings-tab-${s}`}
                className={`h-10 rounded-xl px-3 text-left text-sm font-semibold transition-colors ${
                  tab === s
                    ? 'bg-bg-3 text-ink-1'
                    : 'text-ink-2 hover:bg-bg-2 hover:text-ink-1'
                }`}
              >
                {TITLES[s]}
              </button>
            ))}
          </div>
        </nav>
        <div className="min-w-0 max-w-[640px] -mx-3">
          {section === 'delete' && (
            <BackCrumb
              to="/settings/account"
              label="Account"
              className="px-3 mb-3"
              data-testid="settings-delete-back"
            />
          )}
          <h2
            className="px-3 mb-4 font-display font-extrabold uppercase text-[32px] leading-none text-ink-1"
            data-testid="settings-section-title"
          >
            {TITLES[section]}
          </h2>
          <SectionBody section={section} desktop />
        </div>
      </div>
    </div>
  )
}
