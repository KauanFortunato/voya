import { motion, useReducedMotion } from 'motion/react'
import { FileText, X } from 'lucide-react'

import { bottomSheetMotion, dialogBackdropMotion } from '../motion/dialogMotion'
import './DocumentDetailsDialog.css'

export type DialogDocument = {
  title: string
  category: string
  bookingCode: string | null
  originalFilename?: string
  status?: 'draft' | 'confirmed' | 'attention' | 'expired'
}

export default function DocumentDetailsDialog({
  document,
  onClose,
  onOpenFile,
}: {
  document: DialogDocument
  onClose: () => void
  onOpenFile: () => void
}) {
  const reduceMotion = useReducedMotion()
  const statusLabel = document.status === 'confirmed'
    ? 'Confirmado'
    : document.status === 'attention' || document.status === 'expired'
      ? 'Atenção'
      : document.status === 'draft'
        ? 'Rascunho'
        : null

  return (
    <div className="document-dialog-layer" role="presentation">
      <motion.button
        className="document-dialog-backdrop"
        type="button"
        aria-label="Fechar documento"
        onClick={onClose}
        {...dialogBackdropMotion(reduceMotion)}
      />
      <motion.section
        className="document-dialog-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-dialog-title"
        {...bottomSheetMotion(reduceMotion)}
      >
        <span className="document-dialog-sheet__handle" aria-hidden="true" />
        <button className="document-dialog-sheet__close" type="button" aria-label="Fechar" onClick={onClose}>
          <X size={19} aria-hidden="true" />
        </button>
        <span className="document-dialog-sheet__eyebrow">{document.category}</span>
        <h2 id="document-dialog-title">{document.title}</h2>
        {(statusLabel || document.bookingCode || document.originalFilename) && (
          <dl className="document-dialog-details">
            {statusLabel && <div><dt>Estado</dt><dd>{statusLabel}</dd></div>}
            {document.bookingCode && <div><dt>Código</dt><dd><code>{document.bookingCode}</code></dd></div>}
            {document.originalFilename && <div><dt>Ficheiro</dt><dd>{document.originalFilename}</dd></div>}
          </dl>
        )}
        <button className="document-dialog-sheet__open" type="button" onClick={onOpenFile}>
          <FileText size={17} aria-hidden="true" />Abrir documento
        </button>
      </motion.section>
    </div>
  )
}
