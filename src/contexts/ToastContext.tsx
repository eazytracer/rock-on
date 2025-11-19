import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = crypto.randomUUID()
    const newToast: Toast = { id, message, type }

    setToasts(prev => [...prev, newToast])

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-slide-in-right bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden min-w-[300px] max-w-[400px]"
          >
            <div className="flex items-start gap-3 p-4">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {toast.type === 'success' && (
                  <CheckCircle size={20} className="text-green-500" />
                )}
                {toast.type === 'error' && (
                  <AlertCircle size={20} className="text-red-500" />
                )}
                {toast.type === 'info' && (
                  <Info size={20} className="text-blue-500" />
                )}
              </div>

              {/* Message */}
              <div className="flex-1 text-sm text-white">
                {toast.message}
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 p-1 text-[#707070] hover:text-white transition-colors rounded hover:bg-[#2a2a2a]"
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-[#2a2a2a]">
              <div
                className={`h-full animate-toast-progress ${
                  toast.type === 'success' ? 'bg-green-500' :
                  toast.type === 'error' ? 'bg-red-500' :
                  'bg-blue-500'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
