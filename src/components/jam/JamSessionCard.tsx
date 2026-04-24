import React, { useState, useEffect, useRef } from 'react'
import { Copy, QrCode, Clock, Check, Share2 } from 'lucide-react'
import type { JamSession } from '../../models/JamSession'
import { JamInviteQR } from './JamInviteQR'

interface JamSessionCardProps {
  session: JamSession
  shareUrl: string
  onCopyLink?: () => void
}

/**
 * Compact session card.
 *
 * Previous version stacked the session name, "Join code:" label, large
 * monospaced code, expiry, and inline Copy + QR buttons — ~150px tall on
 * mobile and dominated the visual hierarchy. This version puts the
 * essentials on a single row (name + code + expiry) with Copy and QR
 * tucked behind a single Share menu, so the card fits in ~50-60px and
 * the setlist underneath is what catches the eye.
 */
export const JamSessionCard: React.FC<JamSessionCardProps> = ({
  session,
  shareUrl,
  onCopyLink,
}) => {
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  // Expiry countdown
  useEffect(() => {
    const update = () => {
      const ms = new Date(session.expiresAt).getTime() - Date.now()
      if (ms <= 0) {
        setTimeLeft('Expired')
        return
      }
      const hours = Math.floor(ms / 3600000)
      const minutes = Math.floor((ms % 3600000) / 60000)
      setTimeLeft(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [session.expiresAt])

  // Close share popover on outside click / Escape
  useEffect(() => {
    if (!isShareOpen) return
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node))
        setIsShareOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsShareOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [isShareOpen])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      onCopyLink?.()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for environments without clipboard API
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const expiryLabel =
    session.status === 'expired'
      ? 'Expired'
      : session.status === 'saved'
        ? 'Saved'
        : timeLeft

  return (
    <div
      data-testid="jam-session-card"
      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3"
    >
      <div className="flex items-center gap-3">
        {/* Code + name. Code is the visually anchoring piece — host
            tells participants the 6-char code verbally, so it stays
            prominent even in the compact layout. Session name is
            secondary. */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3">
            <span
              data-testid="jam-short-code"
              className="font-mono text-xl font-bold text-primary tracking-[0.18em]"
            >
              {session.shortCode}
            </span>
            <span className="text-white text-sm font-medium truncate">
              {session.name || 'Jam Session'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[#707070] text-xs mt-0.5">
            <Clock size={10} />
            <span>
              {session.status === 'active'
                ? `Expires in ${expiryLabel}`
                : expiryLabel}
            </span>
          </div>
        </div>

        {/* Share popover. Combines the previous separate Copy + QR
            buttons. One affordance, less visual chrome on the card. */}
        <div ref={popoverRef} className="relative flex-shrink-0">
          <button
            data-testid="jam-share-button"
            onClick={() => setIsShareOpen(v => !v)}
            disabled={!shareUrl}
            title={
              shareUrl
                ? undefined
                : 'Share link unavailable on this device — recreate the session from this device to share'
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a2a2a] text-white text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-expanded={isShareOpen}
            aria-haspopup="menu"
          >
            <Share2 size={14} />
            Share
          </button>

          {isShareOpen && (
            <div
              data-testid="jam-share-popover"
              className="absolute right-0 top-full mt-1 z-40 w-56 bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg shadow-xl p-2"
              role="menu"
            >
              <button
                data-testid="jam-copy-link-button"
                onClick={() => {
                  void handleCopy()
                }}
                disabled={!shareUrl}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left rounded-md text-[#e0e0e0] hover:bg-[#2a2a2a] disabled:opacity-40"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-green-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy link
                  </>
                )}
              </button>
              <button
                data-testid="jam-show-qr-button"
                onClick={() => setShowQR(v => !v)}
                disabled={!shareUrl}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left rounded-md text-[#e0e0e0] hover:bg-[#2a2a2a] disabled:opacity-40"
              >
                <QrCode size={14} />
                {showQR ? 'Hide QR code' : 'Show QR code'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* QR code — rendered below the row when visible. Stays inside the
          card so the popover can close while the QR remains on screen
          (some flows want to keep it up while a guest scans). */}
      {showQR && (
        <div className="mt-3 pt-3 border-t border-[#2a2a2a] flex justify-center">
          <JamInviteQR url={shareUrl} size={180} />
        </div>
      )}
    </div>
  )
}
