import React from 'react'
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
}) => {
  if (!isOpen) return null

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
      buttonColor: 'bg-[#f17827ff] hover:bg-[#d66920]',
    },
  }

  const config = variantConfig[variant]
  const Icon = config.icon

  const handleConfirm = async () => {
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
        className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200"
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
                className="text-white font-semibold text-lg mb-2"
                data-testid="confirm-dialog-title"
              >
                {title}
              </h3>
              <div
                className="text-[#a0a0a0] text-sm"
                data-testid="confirm-dialog-message"
              >
                {message}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors disabled:opacity-50"
              data-testid="confirm-dialog-cancel"
            >
              {cancelLabel}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${config.buttonColor}`}
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
