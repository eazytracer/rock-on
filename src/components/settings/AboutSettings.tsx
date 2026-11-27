/**
 * About (Account and Settings 5; desktop `settings.about`): version, What's
 * new (the App updates tab of Notifications; the bell owns the seen logic),
 * Help & feedback, Terms and Privacy.
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { Group, ListRow } from '../ui'
import { useReleaseNotes } from '../../hooks/useNotifications'
import { BUILD_ID, VERSION_DISPLAY } from '../../config/buildInfo'

/** Placeholder until there is a real support inbox or help site. */
export const HELP_MAILTO =
  'mailto:support@rockon.band?subject=Rock%20On%20feedback'

export const AboutRows: React.FC = () => {
  const navigate = useNavigate()
  const latest = useReleaseNotes().data?.[0]
  return (
    <>
      <ListRow
        title="What's new"
        sub={
          latest
            ? `${latest.version} · ${latest.title}`
            : 'Release notes for every version'
        }
        trail={<ChevronRight size={18} />}
        onClick={() => navigate('/notifications?tab=updates')}
        data-testid="about-whats-new"
      />
      <a
        href={HELP_MAILTO}
        className="flex items-center gap-3 w-full min-h-14 py-2 pl-4 pr-2.5"
        data-testid="about-help"
      >
        <span className="flex-1 min-w-0">
          <b className="block text-[15px] font-semibold text-ink-1">
            Help &amp; feedback
          </b>
          <small className="block text-[12.5px] text-ink-3">
            Questions, ideas, a bug: email us
          </small>
        </span>
        <span className="grid place-items-center w-11 h-11 text-ink-4">
          <ExternalLink size={17} />
        </span>
      </a>
      <ListRow
        title="Terms"
        trail={<ChevronRight size={18} />}
        onClick={() => navigate('/terms')}
        data-testid="about-terms"
      />
      <ListRow
        title="Privacy"
        trail={<ChevronRight size={18} />}
        onClick={() => navigate('/privacy')}
        data-testid="about-privacy"
      />
      <ListRow
        title="Version"
        sub={
          <span>
            <span data-testid="version-info" className="font-mono">
              {VERSION_DISPLAY}
            </span>
            <span className="font-mono text-ink-4"> · build {BUILD_ID}</span>
          </span>
        }
      />
    </>
  )
}

export const AboutSettings: React.FC = () => (
  <div data-testid="settings-about">
    <Group>
      <AboutRows />
    </Group>
  </div>
)
