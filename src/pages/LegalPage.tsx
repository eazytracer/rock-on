/**
 * Terms (`/terms`) and Privacy (`/privacy`): public, plain-language pages in
 * the auth frame. Generic placeholder wording; have it reviewed before launch
 * (docs/redesign/LAUNCH-TODO.md).
 */
import React from 'react'
import { Link } from 'react-router-dom'
import { AuthFrame } from './auth/AuthFrame'
import { HELP_MAILTO } from '../components/settings/AboutSettings'

const UPDATED = 'November 19, 2026'

type Section = { heading: string; body: React.ReactNode[] }

const TERMS: Section[] = [
  {
    heading: 'Using Rock On',
    body: [
      'Rock On helps you and your bands keep songs, setlists, shows and practices in one place. By creating an account or using the app, you agree to these terms. If you don’t agree, please don’t use the app.',
      'You’re responsible for your account and for keeping your password to yourself. Tell us if you think someone else is using it.',
    ],
  },
  {
    heading: 'Your content',
    body: [
      'What you add (songs, charts, notes, setlists and so on) stays yours. You give us permission to store it, back it up and show it to you and to the people you share it with, such as the members of your band, only so we can run the app.',
      'Only add content you have the right to use. Chord charts and lyrics may be protected by copyright; keep them to your own practice and performance use.',
      'Content you add to a band belongs to that band’s shared space. If you leave the band or delete your account, the band keeps it.',
    ],
  },
  {
    heading: 'Fair use',
    body: [
      'Don’t use Rock On to break the law, to harass anyone, or to get into accounts or data that aren’t yours. Don’t try to disrupt the service or overload it.',
      'We may suspend or close accounts that do these things.',
    ],
  },
  {
    heading: 'The service',
    body: [
      'Rock On is provided as is and as available. We work to keep it running and your data safe, but we can’t promise it will always be available, error free, or that data can never be lost. Keep your own copies of anything important.',
      'We may change, add or remove features over time.',
      'To the extent the law allows, we aren’t liable for indirect or incidental losses from using the app, such as a missed cue or a lost setlist on show night.',
    ],
  },
  {
    heading: 'Ending',
    body: [
      'You can stop using Rock On at any time and delete your account in Settings.',
    ],
  },
  {
    heading: 'Changes',
    body: [
      'We may update these terms. When we make a meaningful change we’ll update the date above and, where it makes sense, let you know in the app. Using the app after a change means you accept the new terms.',
    ],
  },
]

const PRIVACY: Section[] = [
  {
    heading: 'What we collect',
    body: [
      'Your account details: name, email address, and your password (stored securely by our sign-in provider, never in plain text) or the Google account you sign in with.',
      'What you add: your profile (instruments, colour), songs, charts, notes, setlists, shows, practices, bands, friends and preferences.',
      'Basic technical information needed to run the app and fix problems, such as error reports and when you last used it.',
    ],
  },
  {
    heading: 'How we use it',
    body: [
      'To run Rock On: sign you in, store your things, sync them across your devices, and show them to the people you choose.',
      'To keep the app working and secure, and to improve it.',
      'We don’t sell your personal information, and we don’t use it for advertising.',
    ],
  },
  {
    heading: 'Who sees it',
    body: [
      'Your bandmates see what you add to the band and your name, instruments and colour. Your email is shown only to the band’s owner and admins.',
      'Friends and people who find you see what your privacy settings allow (Settings and Friends).',
      'We use trusted service providers to host the app and handle sign-in. They process data only to provide that service to us.',
      'We may share information if the law requires it.',
    ],
  },
  {
    heading: 'Your choices',
    body: [
      'You can change your profile, privacy and notification settings at any time.',
      'You can delete your account in Settings. Your personal songs, setlists, notes and friends are deleted; what you added to a band stays with the band, credited to “Former member”.',
      'For a copy of your data or any other request, email us.',
    ],
  },
  {
    heading: 'Children',
    body: [
      'Rock On isn’t meant for children under 13, and we don’t knowingly collect their information.',
    ],
  },
  {
    heading: 'Changes',
    body: [
      'We may update this policy. When we do, we’ll update the date above and, for meaningful changes, let you know in the app.',
    ],
  },
]

const LegalPage: React.FC<{ kind: 'terms' | 'privacy' }> = ({ kind }) => {
  const terms = kind === 'terms'
  const sections = terms ? TERMS : PRIVACY
  return (
    <AuthFrame
      data-testid={`${kind}-page`}
      back={{ label: 'Back', to: '/' }}
      title={terms ? 'Terms' : 'Privacy'}
      lede={`Last updated ${UPDATED}`}
      wide
    >
      <div className="flex flex-col gap-6 mt-2 text-[15px] leading-relaxed text-ink-2">
        {sections.map(s => (
          <section key={s.heading}>
            <h2 className="text-[17px] font-bold text-ink-1 mb-2">
              {s.heading}
            </h2>
            <div className="flex flex-col gap-2.5">
              {s.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
        <section>
          <h2 className="text-[17px] font-bold text-ink-1 mb-2">Contact</h2>
          <p>
            Questions?{' '}
            <a
              href={HELP_MAILTO}
              className="font-bold text-accent-ink"
              data-testid={`${kind}-contact-link`}
            >
              Email us
            </a>
            . See also the{' '}
            <Link
              to={terms ? '/privacy' : '/terms'}
              className="font-bold text-accent-ink"
              data-testid={`${kind}-other-link`}
            >
              {terms ? 'Privacy policy' : 'Terms'}
            </Link>
            .
          </p>
        </section>
      </div>
    </AuthFrame>
  )
}

export const TermsPage: React.FC = () => <LegalPage kind="terms" />
export const PrivacyPage: React.FC = () => <LegalPage kind="privacy" />
export default LegalPage
