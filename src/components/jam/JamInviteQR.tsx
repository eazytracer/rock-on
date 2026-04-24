import React, { Suspense, lazy } from 'react'

// Lazy-load QR code component to avoid adding to main bundle
const QRCodeSVG = lazy(() =>
  import('qrcode.react').then(mod => ({ default: mod.QRCodeSVG }))
)

interface JamInviteQRProps {
  url: string
  size?: number
  className?: string
}

/**
 * Renders a QR code for a jam session invite URL.
 * Lazy-loads qrcode.react to keep the main bundle small.
 */
export const JamInviteQR: React.FC<JamInviteQRProps> = ({
  url,
  size = 200,
  className,
}) => {
  return (
    <div
      data-testid="jam-invite-qr"
      className={`bg-white p-4 rounded-xl inline-block ${className ?? ''}`}
    >
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center bg-gray-200 rounded"
            style={{ width: size, height: size }}
          >
            <span className="text-gray-500 text-sm">Loading QR...</span>
          </div>
        }
      >
        <QRCodeSVG
          value={url}
          size={size}
          bgColor="#ffffff"
          fgColor="#000000"
          level="M"
        />
      </Suspense>
    </div>
  )
}
