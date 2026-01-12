import { useState, useCallback } from 'react'

export interface ConfirmOptions {
  title: string
  message: string | React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
}

export interface ConfirmDialogState extends ConfirmOptions {
  isOpen: boolean
  onConfirm: () => void
  onClose: () => void
  isLoading: boolean
}

/**
 * Hook for showing themed confirmation dialogs.
 *
 * Usage:
 * ```tsx
 * const { confirm, dialogProps } = useConfirm()
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: 'Delete Item',
 *     message: 'Are you sure you want to delete this item?',
 *     variant: 'danger',
 *     confirmLabel: 'Delete',
 *   })
 *
 *   if (confirmed) {
 *     // perform delete
 *   }
 * }
 *
 * return (
 *   <>
 *     <button onClick={handleDelete}>Delete</button>
 *     <ConfirmDialog {...dialogProps} />
 *   </>
 * )
 * ```
 */
export const useConfirm = () => {
  const [dialogState, setDialogState] = useState<ConfirmDialogState | null>(
    null
  )

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setDialogState({
        ...options,
        isOpen: true,
        isLoading: false,
        onConfirm: () => {
          resolve(true)
          setDialogState(null)
        },
        onClose: () => {
          resolve(false)
          setDialogState(null)
        },
      })
    })
  }, [])

  const dialogProps = dialogState
    ? {
        isOpen: dialogState.isOpen,
        onClose: dialogState.onClose,
        onConfirm: dialogState.onConfirm,
        title: dialogState.title,
        message: dialogState.message,
        confirmLabel: dialogState.confirmLabel,
        cancelLabel: dialogState.cancelLabel,
        variant: dialogState.variant,
        isLoading: dialogState.isLoading,
      }
    : {
        isOpen: false,
        onClose: () => {},
        onConfirm: () => {},
        title: '',
        message: '',
      }

  return { confirm, dialogProps }
}
