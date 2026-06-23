'use client'
import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { fade, scaleFade } from '@/lib/motion'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
          />
          {/* Panel — scale+fade from centre */}
          <motion.div
            className={`relative bg-white rounded-2xl shadow-xl w-full ${maxWidth} z-10 overflow-hidden`}
            variants={scaleFade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
