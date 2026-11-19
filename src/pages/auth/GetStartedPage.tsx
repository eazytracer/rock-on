/**
 * Get started (`/get-started`): four paths, Create a band the primary one.
 * Account and Settings 4; desktop-more.js V.getstarted.
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, PartyPopper, Plus, User, Users } from 'lucide-react'
import { AuthFrame } from './AuthFrame'

const ROWS = [
  {
    id: 'create-band',
    icon: Plus,
    title: 'Create a band',
    sub: 'Just a name. Invite people after.',
    to: '/band/new',
    primary: true,
  },
  {
    id: 'join-band',
    icon: Users,
    title: 'Join a band',
    sub: "Use a code or link. You'll see the band first.",
    to: '/j',
  },
  {
    id: 'jam-code',
    icon: PartyPopper,
    title: 'Got a jam code?',
    sub: 'Jump straight into a jam or event.',
    to: '/get-started/jam',
  },
  {
    id: 'solo',
    icon: User,
    title: 'Continue solo',
    sub: 'Your own songs and setlists.',
    to: '/',
    // Kept from the old screen; e2e specs use it.
    testId: 'personal-account-button',
  },
] as const

export const GetStartedPage: React.FC = () => {
  const navigate = useNavigate()
  return (
    <AuthFrame
      data-testid="get-started-page"
      wide
      title={
        <>
          Get <br className="md:hidden" />
          started
        </>
      }
      lede={
        <>
          Pick one. You can do the others later from the{' '}
          <span className="md:hidden">header or More.</span>
          <span className="hidden md:inline">sidebar.</span>
        </>
      }
    >
      <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2">
        {ROWS.map(row => {
          const Icon = row.icon
          const primary = 'primary' in row && row.primary
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => navigate(row.to)}
              data-testid={
                'testId' in row ? row.testId : `get-started-${row.id}`
              }
              className="flex items-center gap-3.5 min-h-[76px] md:min-h-[92px] px-4 md:px-[18px] rounded-[20px] bg-bg-2 shadow-group text-left transition-transform duration-100 ease-rock active:scale-[.98] md:hover:shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]"
            >
              <span
                className={`w-11 h-11 md:w-[46px] md:h-[46px] rounded-full grid place-items-center shrink-0 ${
                  primary
                    ? 'bg-accent text-on-accent'
                    : 'bg-bg-4 text-ink-1 [[data-theme=light]_&]:bg-bg-3'
                }`}
              >
                <Icon size={22} />
              </span>
              <span className="flex-1 min-w-0">
                <b className="block text-[17px] font-bold text-ink-1">
                  {row.title}
                </b>
                <small className="block text-[13px] text-ink-3">
                  {row.sub}
                </small>
              </span>
              <ChevronRight
                size={18}
                className="text-ink-4 shrink-0 md:hidden"
              />
            </button>
          )
        })}
      </div>
    </AuthFrame>
  )
}

export default GetStartedPage
