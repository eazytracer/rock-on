/**
 * A QR code on a white tile (lazy: qrcode.react stays out of the main bundle).
 */
import React, { Suspense, lazy } from 'react'

const QRCodeSVG = lazy(() =>
  import('qrcode.react').then(m => ({ default: m.QRCodeSVG }))
)

export const CodeQr: React.FC<{
  value: string
  size: number
  className?: string
  'data-testid'?: string
}> = ({ value, size, className = '', 'data-testid': testId }) => (
  <div
    data-testid={testId}
    data-value={value}
    className={`inline-block bg-white rounded-2xl p-3 ${className}`}
  >
    <Suspense fallback={<div style={{ width: size, height: size }} />}>
      <QRCodeSVG value={value} size={size} level="M" />
    </Suspense>
  </div>
)
