/**
 * The band's invite (Band and Friends 1, 3, 8; decision 10): code, link, QR,
 * Copy, Share, the 24 h countdown, New code once expired, and Regenerate with
 * its warning. Owner / admins only (members can't read codes). `solo` is the
 * band-of-one card Create lands on.
 */
import React, { Suspense, lazy, useEffect, useState } from 'react'
import { Copy, QrCode, RefreshCw, Share2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { BandMark } from '../ui/BandMark'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../contexts/ToastContext'
import { useBandActions, useInviteCode } from '../../hooks/useBandAdmin'
import { errorText } from '../../services/api/errors'
import type { BandMarkValue } from '../ui/bandMarkPalette'
import { expiresIn, inviteLink } from '../../domain/invites'

const QRCodeSVG = lazy(() =>
  import('qrcode.react').then(mod => ({ default: mod.QRCodeSVG }))
)

const useNow = (everyMs: number) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(t)
  }, [everyMs])
  return now
}

export const InviteCard: React.FC<{
  bandId: string
  bandName: string
  mark: BandMarkValue | null
  solo?: boolean
}> = ({ bandId, bandName, mark, solo = false }) => {
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const { data: invite, isLoading } = useInviteCode(bandId, true)
  const { regenerate } = useBandActions(bandId)
  const [qr, setQr] = useState(false)
  const now = useNow(30_000)

  if (isLoading) {
    return (
      <div
        className="h-[148px] rounded-[20px] bg-bg-2 shadow-group animate-pulse"
        data-testid="invite-card-loading"
      />
    )
  }

  const code = invite?.code ?? null
  const expiry = invite ? expiresIn(invite.expires_at, now) : null
  const expired = !code || expiry === null
  const link = code ? inviteLink(code) : ''

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${what} copied`, 'success')
    } catch {
      showToast(`Couldn't copy. ${text}`, 'info')
    }
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${bandName} on Rock On`,
          text: `Join ${bandName} on Rock On. Code ${code}`,
          url: link,
        })
      } catch {
        // Cancelled: nothing to do.
      }
    } else {
      copy(link, 'Invite link')
    }
  }

  const newCode = async () => {
    try {
      await regenerate.mutateAsync()
      showToast('New invite code ready', 'success')
    } catch (err) {
      showToast(errorText(err), 'error')
    }
  }

  const askRegenerate = async () => {
    const ok = await confirm({
      title: 'Regenerate the invite code?',
      message: (
        <>
          The old code and link stop working straight away (
          <b className="font-mono text-ink-1">{code}</b>). Members who already
          joined stay; anyone holding the old link will need the new one.
        </>
      ),
      confirmLabel: 'Regenerate',
      cancelLabel: 'Keep this code',
      variant: 'warning',
    })
    if (ok) newCode()
  }

  return (
    <section
      data-testid="invite-card"
      className={`rounded-[20px] bg-bg-2 p-4 ${
        solo
          ? 'shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]'
          : 'shadow-group'
      }`}
    >
      {solo && (
        <div className="mb-3" data-testid="invite-card-solo">
          <b className="block text-[18px] text-ink-1">It's just you so far</b>
          <p className="text-[14px] text-ink-2 mt-1">
            Invite your bandmates to share songs, setlists and the calendar.
          </p>
        </div>
      )}
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3">
          Band code
        </span>
        <span
          className={`ml-auto font-mono text-[10.5px] tracking-[.08em] uppercase ${
            expired ? 'text-warn' : 'text-ink-3'
          }`}
          data-testid="invite-expiry"
        >
          {expired ? (code ? 'Expired' : 'No code') : expiry}
        </span>
      </div>
      <div
        className={`font-mono text-[28px] tracking-[.2em] mt-1 mb-3 ${
          expired ? 'text-ink-4 line-through' : 'text-ink-1'
        }`}
        data-testid="invite-code"
      >
        {code ?? '—'}
      </div>

      {expired ? (
        <div className="flex flex-col gap-2">
          <p className="text-[14px] text-ink-2">
            {code
              ? 'This code has expired. Codes last 24 hours.'
              : 'There is no invite code yet.'}
          </p>
          <Button
            variant="primary"
            icon={<RefreshCw size={17} />}
            onClick={newCode}
            disabled={regenerate.isPending}
            data-testid="invite-new-code"
          >
            New code
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 h-12 rounded-[14px] bg-bg-3 pl-3.5 pr-1.5 mb-2.5">
            <span
              className="flex-1 min-w-0 truncate font-mono text-[12px] text-ink-2"
              data-testid="invite-link"
            >
              {link.replace(/^https?:\/\//, '')}
            </span>
            <Button
              className="!h-9 !text-[13px]"
              icon={<Copy size={15} />}
              onClick={() => copy(link, 'Invite link')}
              data-testid="invite-copy-link"
            >
              Copy
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              icon={<Share2 size={17} />}
              onClick={share}
              data-testid="invite-share"
            >
              Share link
            </Button>
            <Button
              icon={<QrCode size={17} />}
              onClick={() => setQr(q => !q)}
              aria-pressed={qr}
              data-testid="invite-qr-toggle"
            >
              QR
            </Button>
            <Button
              icon={<Copy size={17} />}
              onClick={() => copy(code!, 'Code')}
              data-testid="invite-copy-code"
            >
              Code
            </Button>
          </div>
          {qr && (
            <div
              className="flex justify-center pt-5 pb-3"
              data-testid="invite-qr"
            >
              <div className="relative rounded-[10px] bg-white p-2.5">
                <Suspense
                  fallback={<div className="w-[170px] h-[170px]" aria-hidden />}
                >
                  <QRCodeSVG value={link} size={170} level="H" />
                </Suspense>
                <span className="absolute inset-0 grid place-items-center">
                  <span className="rounded-[13px] bg-white p-[3px]">
                    <BandMark name={bandName} mark={mark} size={40} />
                  </span>
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center mt-2.5">
            <p className="flex-1 text-[12.5px] text-ink-3">
              Anyone with the code sees the band first, then joins as a member.
            </p>
            <Button
              variant="text"
              className="!h-9 !text-[13px]"
              icon={<RefreshCw size={15} />}
              onClick={askRegenerate}
              disabled={regenerate.isPending}
              data-testid="invite-regenerate"
            >
              Regenerate…
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog {...dialogProps} />
    </section>
  )
}
