/**
 * useUnsavedChanges — unified unsaved-changes guard.
 *
 * Registers a `beforeunload` handler while a form is dirty (catches tab
 * close, refresh, navigation to external URL) and provides a promise-based
 * `requestClose()` API for in-app close/cancel flows. The returned
 * `dialogProps` are spread into `<UnsavedChangesDialog />`.
 *
 * Usage:
 *
 *   const { dialogProps, requestClose, markClean } = useUnsavedChanges({
 *     isDirty,
 *     onSave: async () => { await saveToServer() },
 *   })
 *
 *   const handleClose = async () => {
 *     const proceed = await requestClose()
 *     if (proceed) closeModal()
 *   }
 *
 *   return (<>
 *     ...
 *     <UnsavedChangesDialog {...dialogProps} />
 *   </>)
 *
 * The promise returned from `requestClose()` resolves `true` when the user
 * chose **Discard** or **Save**, and `false` when they chose **Keep
 * editing**. If `onSave` rejects, the promise resolves `false` (dialog
 * stays open, save error is the caller's responsibility to surface).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { UnsavedChangesDialogProps } from '../components/common/UnsavedChangesDialog'

export interface UseUnsavedChangesOptions {
  /** Whether the form currently has unsaved changes. */
  isDirty: boolean
  /**
   * Save handler called when the user picks "Save" from the dialog.
   * Must resolve or reject once save completes. Omit to hide the Save
   * button (only Keep / Discard available).
   */
  onSave?: () => void | Promise<void>
  /** Dialog title override. */
  title?: string
  /** Dialog message override. */
  message?: string
}

type DialogState =
  | { isOpen: false }
  | {
      isOpen: true
      resolver: (proceed: boolean) => void
    }

type DialogSubset = Pick<
  UnsavedChangesDialogProps,
  | 'isOpen'
  | 'title'
  | 'message'
  | 'onKeepEditing'
  | 'onDiscard'
  | 'onSaveAndClose'
>

export interface UseUnsavedChangesReturn {
  /** Spread into <UnsavedChangesDialog {...dialogProps} />. */
  dialogProps: DialogSubset
  /**
   * Call when the user attempts to close / cancel. Returns a promise that
   * resolves `true` if close should proceed (clean, discarded, or saved)
   * or `false` if the user chose to keep editing.
   */
  requestClose: () => Promise<boolean>
}

export function useUnsavedChanges(
  options: UseUnsavedChangesOptions
): UseUnsavedChangesReturn {
  const { isDirty, onSave, title, message } = options
  const [dialog, setDialog] = useState<DialogState>({ isOpen: false })
  const isDirtyRef = useRef(isDirty)

  // Keep ref in sync so the beforeunload handler sees the current value
  // without re-registering.
  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  // Warn on tab close / refresh while dirty.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return
      e.preventDefault()
      // Chrome requires returnValue to be set.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  const requestClose = useCallback((): Promise<boolean> => {
    if (!isDirtyRef.current) return Promise.resolve(true)
    return new Promise<boolean>(resolve => {
      setDialog({ isOpen: true, resolver: resolve })
    })
  }, [])

  const resolveAndClose = useCallback((proceed: boolean) => {
    setDialog(prev => {
      if (prev.isOpen) prev.resolver(proceed)
      return { isOpen: false }
    })
  }, [])

  const onKeepEditing = useCallback(() => {
    resolveAndClose(false)
  }, [resolveAndClose])

  const onDiscard = useCallback(() => {
    resolveAndClose(true)
  }, [resolveAndClose])

  const onSaveAndClose = useCallback(async () => {
    if (!onSave) {
      // No save handler — treat as discard to avoid leaving the user stuck.
      resolveAndClose(true)
      return
    }
    try {
      await onSave()
      resolveAndClose(true)
    } catch {
      // Save failed; keep the dialog open so the user can retry or discard.
      // (Error surfacing is the caller's responsibility.)
    }
  }, [onSave, resolveAndClose])

  const dialogProps: DialogSubset = {
    isOpen: dialog.isOpen,
    title,
    message,
    onKeepEditing,
    onDiscard,
    onSaveAndClose: onSave ? onSaveAndClose : undefined,
  }

  return { dialogProps, requestClose }
}
