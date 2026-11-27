import { Suspense, lazy, useState } from 'react'
import { Copy, QrCode } from 'lucide-react'
import { IconButton } from '../ui'
import { useToast } from '../../contexts/ToastContext'
import { copyText, friendCodeLink } from './share'

// Lazy so qrcode.react stays out of the main bundle.
const QRCodeSVG = lazy(() =>
  import('qrcode.react').then(mod => ({ default: mod.QRCodeSVG }))
)

const QR = ({ code, size }: { code: string; size: number }) => (
  <Suspense
    fallback={
      <div
        className="animate-pulse rounded-xl bg-bg-3"
        style={{ width: size + 16, height: size + 16 }}
      />
    }
  >
    <div className="rounded-xl bg-white p-2 shrink-0">
      <QRCodeSVG value={friendCodeLink(code)} size={size} level="M" />
    </div>
  </Suspense>
)

/**
 * Your friend code with copy and QR. Phone: the QR rolls open from its button.
 * Desktop: the QR shows beside the code.
 */
export function FriendCodeCard({
  code,
  loading,
  desktop,
}: {
  code: string
  loading: boolean
  desktop: boolean
}) {
  const { showToast } = useToast()
  const [showQR, setShowQR] = useState(false)

  const copy = async () => {
    if (!code) return
    const ok = await copyText(code)
    showToast(
      ok ? 'Friend code copied' : "Couldn't copy. Select the code instead.",
      ok ? 'success' : 'error'
    )
  }

  const value = (
    <span
      className="block font-mono text-[22px] tracking-[.16em] text-ink-1 mt-0.5 select-all"
      data-testid="friends-code-value"
    >
      {loading ? '········' : code || '––––––––'}
    </span>
  )
  const label = (
    <span className="block font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3">
      Your friend code
    </span>
  )
  const copyButton = (
    <IconButton
      aria-label="Copy friend code"
      onClick={() => void copy()}
      disabled={!code}
      data-testid="friends-copy-code"
    >
      <Copy size={18} />
    </IconButton>
  )

  if (desktop)
    return (
      <div
        className="flex items-center gap-4 px-4 py-4"
        data-testid="friends-my-code"
      >
        {code ? (
          <QR code={code} size={88} />
        ) : (
          <div className="w-[104px] h-[104px] rounded-xl bg-bg-3 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          {value}
          <div className="mt-2.5">{copyButton}</div>
        </div>
      </div>
    )

  return (
    <div data-testid="friends-my-code">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex-1 min-w-0">
          {label}
          {value}
        </div>
        <IconButton
          aria-label={showQR ? 'Hide QR code' : 'Show QR code'}
          aria-pressed={showQR}
          onClick={() => setShowQR(v => !v)}
          disabled={!code}
          className={showQR ? '!text-accent' : ''}
          data-testid="friends-qr-toggle"
        >
          <QrCode size={18} />
        </IconButton>
        {copyButton}
      </div>
      {showQR && code && (
        <div
          className="flex flex-col items-center gap-2 pb-4"
          data-testid="friends-qr"
        >
          <QR code={code} size={168} />
          <span className="text-xs text-ink-3">Scan to add {code}</span>
        </div>
      )}
    </div>
  )
}
