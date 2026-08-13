import { useEffect, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { createPortal } from 'react-dom'

type ModalPortalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export default function ModalPortal({ open, onClose, children }: ModalPortalProps) {
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, open])

  return createPortal(
    <AnimatePresence>{open ? children : null}</AnimatePresence>,
    document.body,
  )
}
