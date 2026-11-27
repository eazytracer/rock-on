/**
 * `/j/:code`, shared by band invites and jams (decision 10): ask the server
 * what the code is (resolve_code), then show that preview. Codes are taken
 * with or without the hyphen, in any case, or as a pasted link.
 *
 *   band  signed in → the band preview (JoinBandPage); signed out → sign in
 *         and back here
 *   jam   signed in → the app join (preview → parts → jam songs);
 *         signed out → the web guest
 *   none  "That code isn't valid."
 *
 * A public route: signed-in visitors get the app layout here.
 */
import React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { ModernLayout } from '../../components/layout/ModernLayout'
import { BackCrumb } from '../../components/layout/MobileHeader'
import { resolveCode } from '../../services/api/jams'
import { parseInviteCode } from '../../domain/invites'
import { encodeReturnTo } from '../../utils/returnTo'
import { JoinPreview } from '../JoinBandPage'
import { AppJoin } from '../../components/jams/guest/AppJoin'
import { CodeRefusal } from '../../components/jams/guest/CodeRefusal'
import WebGuestPage from './WebGuestPage'

const Loading: React.FC = () => (
  <div
    className="flex items-center justify-center min-h-screen bg-bg-0"
    data-testid="join-code-loading"
  >
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
)

export const JoinCodePage: React.FC = () => {
  const { code: raw = '' } = useParams<{ code: string }>()
  const code = parseInviteCode(raw)
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const kind = useQuery({
    queryKey: ['jams', 'resolve', code],
    queryFn: () => resolveCode(code),
    enabled: !!code,
    retry: false,
    staleTime: 5 * 60_000,
  })

  if (loading || kind.isLoading) return <Loading />
  const signedIn = !!user

  if (kind.data === 'band') {
    if (!signedIn)
      return (
        <Navigate
          to={`/auth?returnTo=${encodeReturnTo(`/j/${code}`)}`}
          replace
        />
      )
    return (
      <ModernLayout>
        <JoinPreview code={code} />
      </ModernLayout>
    )
  }

  if (kind.data === 'jam') {
    return signedIn ? (
      <ModernLayout>
        <AppJoin code={code} />
      </ModernLayout>
    ) : (
      <WebGuestPage code={code} />
    )
  }

  const refusal = (
    <div data-testid="join-code-page" className="max-w-[420px] mx-auto">
      {signedIn && (
        <BackCrumb
          label="Back"
          onClick={() => navigate('/j')}
          className="mb-4"
          data-testid="join-code-back"
        />
      )}
      <CodeRefusal
        error={kind.error}
        onRetry={() => kind.refetch()}
        onEnterCode={signedIn ? () => navigate('/j') : undefined}
      />
    </div>
  )
  return signedIn ? (
    <ModernLayout>{refusal}</ModernLayout>
  ) : (
    <div className="min-h-screen bg-bg-0 px-4 pt-10">{refusal}</div>
  )
}

export default JoinCodePage
