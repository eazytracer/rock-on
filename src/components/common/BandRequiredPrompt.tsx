import { Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from './EmptyState'

interface BandRequiredPromptProps {
  /** The band-only feature name, e.g. "Setlists", "Shows", "Practices". */
  feature: string
  /** Testid for the page root so e2e can assert the band-less state. */
  testid?: string
}

/**
 * Shown on band-only pages (Setlists / Shows / Practices) when the user has no
 * current band. Band membership is a capability, not an auth gate (see the
 * band-less user flow) — so these pages stay reachable and simply explain that
 * this feature needs a band, with a path to create or join one.
 */
export function BandRequiredPrompt({
  feature,
  testid = 'band-required-prompt',
}: BandRequiredPromptProps) {
  const navigate = useNavigate()

  return (
    <div data-testid={testid} className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">{feature}</h1>
      <div className="mt-8 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-2">
        <EmptyState
          icon={Users}
          size="lg"
          title={`${feature} are a band feature`}
          description="Create a band or join one with an invite code to start using this. You can keep using your personal account in the meantime."
          action={{
            label: 'Create or join a band',
            onClick: () => navigate('/get-started'),
            icon: Users,
            'data-testid': 'band-required-cta',
          }}
        />
      </div>
    </div>
  )
}
