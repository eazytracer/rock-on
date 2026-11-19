import React, { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string | React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  isLoading?: boolean
  /**
   * Typed confirm (delete band, delete account): Confirm stays off until the
   * user types this (trimmed, case-insensitive).
   */
  typedConfirm?: string
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
  typedConfirm,
}) => {
  const [typed, setTyped] = useState('')
  useEffect(() => {
    if (!isOpen) setTyped('')
  }, [isOpen])
  if (!isOpen) return null
  const typedOk =
    !typedConfirm ||
    typed.trim().toLowerCase() === typedConfirm.trim().toLowerCase()

  const variantConfig = {
    danger: {
      icon: AlertCircle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
      buttonColor: 'bg-red-500 hover:bg-red-600',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
      buttonColor: 'bg-amber-500 hover:bg-amber-600',
    },
    default: {
      icon: null,
      iconColor: '',
      iconBg: '',
      buttonColor: 'bg-accent hover:bg-accent-deep',
    },
  }

  const config = variantConfig[variant]
  const Icon = config.icon

  const handleConfirm = async () => {
    if (!typedOk) return
    await onConfirm()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      data-testid="confirm-dialog-backdrop"
    >
      <div
        className="bg-bg-2 rounded-xl border border-border-1 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
        data-testid="confirm-dialog"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            {Icon && (
              <div
                className={`flex-shrink-0 p-2 rounded-full ${config.iconBg}`}
              >
                <Icon size={20} className={config.iconColor} />
              </div>
            )}
            <div className="flex-1">
              <h3
                className="text-ink-1 font-semibold text-lg mb-2"
                data-testid="confirm-dialog-title"
              >
                {title}
              </h3>
              <div
                className="text-ink-3 text-sm"
                data-testid="confirm-dialog-message"
              >
                {message}
              </div>
              {typedConfirm && (
                <div className="mt-4">
                  <label
                    htmlFor="confirm-dialog-typed"
                    className="block font-mono text-[10.5px] tracking-[.1em] uppercase text-ink-3 mb-1.5"
                  >
                    Type {typedConfirm} to confirm
                  </label>
                  <input
                    id="confirm-dialog-typed"
                    name="confirmTyped"
                    data-testid="confirm-dialog-typed-input"
                    autoFocus
                    autoComplete="off"
                    value={typed}
                    onChange={e => setTyped(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                    placeholder={typedConfirm}
                    className="w-full h-11 px-3.5 rounded-xl bg-bg-3 text-ink-1 font-mono text-[15px] outline-none focus:shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-ink-3 text-sm font-medium hover:text-ink-1 transition-colors disabled:opacity-50"
              data-testid="confirm-dialog-cancel"
            >
              {cancelLabel}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || !typedOk}
              className={`flex items-center gap-2 px-4 py-2 text-ink-1 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${config.buttonColor}`}
              data-testid="confirm-dialog-confirm"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
