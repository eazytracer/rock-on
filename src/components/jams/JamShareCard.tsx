/**
 * A code jam's way in (Access): the code `ABCD-EFGH`, the `/j/CODE` link with
 * Copy and Share, and the QR. Shown only in "Anyone with the code" mode.
 */
import React, { Suspense, lazy } from 'react'
import { Copy, Share2 } from 'lucide-react'
import { Button } from '../ui'
import { useToast } from '../../contexts/ToastContext'
import { copyText } from '../friends/share'
import { formatCode } from '../../hooks/useJam'
import { jamLink } from './parts'

const QRCodeSVG = lazy(() =>
  import('qrcode.react').then(mod => ({ default: mod.QRCodeSVG }))
)

export const JamShareCard: React.FC<{ code: string; name: string }> = ({
  code,
  name,
}) => {
  const { showToast } = useToast()
  const link = jamLink(code)
  const copy = async () => {
    const ok = await copyText(link)
    showToast(
      ok ? 'Link copied' : `Couldn't copy. ${link}`,
      ok ? 'success' : 'info'
    )
  }
  const share = async () => {
    if (!navigator.share) return copy()
    try {
      await navigator.share({
        title: name,
        text: `Join ${name} on Rock On`,
        url: link,
      })
    } catch {
      // Cancelled.
    }
  }
  return (
    <section
      className="rounded-[20px] bg-bg-2 shadow-group p-4 flex gap-4 items-center"
      data-testid="jam-share-card"
    >
      <div
        className="rounded-[10px] bg-white p-2 shrink-0"
        data-testid="jam-share-qr"
      >
        <Suspense
          fallback={<div className="w-[112px] h-[112px]" aria-hidden />}
        >
          <QRCodeSVG value={link} size={112} level="M" />
        </Suspense>
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3">
          Jam code
        </span>
        <b
          className="block font-mono text-[21px] tracking-[.1em] whitespace-nowrap text-ink-1"
          data-testid="jam-share-code"
        >
          {formatCode(code)}
        </b>
        <span
          className="block truncate font-mono text-[12px] text-ink-3 mb-2.5"
          data-testid="jam-share-link"
        >
          {link.replace(/^https?:\/\//, '')}
        </span>
        <div className="flex gap-2 flex-wrap">
          <Button
            className="!h-9 !text-[13px]"
            icon={<Copy size={15} />}
            onClick={() => void copy()}
            data-testid="jam-share-copy"
          >
            Copy link
          </Button>
          <Button
            className="!h-9 !text-[13px]"
            icon={<Share2 size={15} />}
            onClick={() => void share()}
            data-testid="jam-share-share"
          >
            Share
          </Button>
        </div>
      </div>
    </section>
  )
}
