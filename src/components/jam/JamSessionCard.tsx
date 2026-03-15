import React, { useState, useEffect } from 'react'
import { Copy, QrCode, Clock, Check } from 'lucide-react'
import type { JamSession } from '../../models/JamSession'
import { JamInviteQR } from './JamInviteQR'

interface JamSessionCardProps {
  session: JamSession
  shareUrl: string
  onCopyLink?: () => void
}

/**
 * Session summary card showing the join code, QR code, and expiry countdown.
 */
export const JamSessionCard: React.FC<JamSessionCardProps> = ({
  session,
  shareUrl,
  onCopyLink,
}) => {
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState('')

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

  return (
    <div
      data-testid="jam-session-card"
      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5"
    >
      {/* Session name */}
      <h3 className="text-white font-semibold text-lg mb-1">
        {session.name || 'Jam Session'}
      </h3>

      {/* Short code */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[#707070] text-sm">Join code:</span>
        <span
          data-testid="jam-short-code"
          className="font-mono text-2xl font-bold text-amber-400 tracking-widest"
        >
          {session.shortCode}
        </span>
      </div>

      {/* Expiry */}
      <div className="flex items-center gap-2 text-[#707070] text-xs mb-5">
        <Clock size={12} />
        <span>
          {session.status === 'expired'
            ? 'Session expired'
            : session.status === 'saved'
              ? 'Session saved'
              : `Expires in ${timeLeft}`}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          data-testid="jam-copy-link-button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2a] text-white text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {copied ? (
            <>
              <Check size={15} className="text-green-400" />
              Copied!
            </>
          ) : (
            <>
              <Copy size={15} />
              Copy link
            </>
          )}
        </button>

        <button
          data-testid="jam-show-qr-button"
          onClick={() => setShowQR(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2a] text-white text-sm font-medium hover:bg-[#333] transition-colors"
        >
          <QrCode size={15} />
          {showQR ? 'Hide QR' : 'Show QR'}
        </button>
      </div>

      {/* QR code */}
      {showQR && (
        <div className="mt-4 flex justify-center">
          <JamInviteQR url={shareUrl} size={200} />
        </div>
      )}
    </div>
  )
}
