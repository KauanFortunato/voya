import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, ExternalLink, ZoomIn, ZoomOut, X } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import './PdfViewer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

type PdfViewerProps = {
  source: string
  title: string
  onClose: () => void
}

export default function PdfViewer({ source, title, onClose }: PdfViewerProps) {
  const reduceMotion = useReducedMotion()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportWidth, setViewportWidth] = useState(360)
  const [numberOfPages, setNumberOfPages] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const updateWidth = () => setViewportWidth(element.clientWidth)
    const observer = new ResizeObserver(updateWidth)
    updateWidth()
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.section
      className="pdf-viewer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-viewer-title"
      initial={reduceMotion ? false : { opacity: 0, y: 8, filter: 'blur(2px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={reduceMotion ? undefined : { opacity: 0, y: 3, filter: 'blur(1px)' }}
      transition={{ type: 'spring', duration: 0.24, bounce: 0 }}
    >
      <header className="pdf-viewer__header">
        <div>
          <span>Documento</span>
          <h2 id="pdf-viewer-title">{title}</h2>
        </div>
        <div className="pdf-viewer__header-actions">
          <a href={source} target="_blank" rel="noreferrer" aria-label="Abrir PDF externamente">
            <ExternalLink size={18} aria-hidden="true" />
          </a>
          <button type="button" aria-label="Fechar visualizador" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="pdf-viewer__viewport" ref={viewportRef}>
        <Document
          file={source}
          onLoadProgress={({ loaded, total }) => setProgress(total ? Math.round((loaded / total) * 100) : 0)}
          onLoadSuccess={({ numPages }) => {
            setNumberOfPages(numPages)
            setProgress(100)
          }}
          loading={
            <div className="pdf-viewer__loading" role="status">
              <span className="pdf-viewer__skeleton" />
              <strong>A carregar documento… {progress ? `${progress}%` : ''}</strong>
            </div>
          }
          error={
            <div className="pdf-viewer__error" role="alert">
              <strong>Não foi possível mostrar este PDF.</strong>
              <a href={source} target="_blank" rel="noreferrer">Abrir externamente</a>
            </div>
          }
        >
          <Page
            pageNumber={page}
            width={Math.max(280, Math.min(viewportWidth - 24, 720))}
            scale={scale}
            renderAnnotationLayer
            renderTextLayer
          />
        </Document>
      </div>

      <footer className="pdf-viewer__toolbar" aria-label="Controles do documento">
        <div>
          <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <span>{numberOfPages ? `${page} / ${numberOfPages}` : '— / —'}</span>
          <button type="button" aria-label="Próxima página" disabled={!numberOfPages || page >= numberOfPages} onClick={() => setPage((current) => current + 1)}>
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </div>
        <div>
          <button type="button" aria-label="Diminuir zoom" disabled={scale <= 0.75} onClick={() => setScale((current) => Math.max(0.75, current - 0.25))}>
            <ZoomOut size={18} aria-hidden="true" />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button type="button" aria-label="Aumentar zoom" disabled={scale >= 1.75} onClick={() => setScale((current) => Math.min(1.75, current + 0.25))}>
            <ZoomIn size={18} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </motion.section>
  )
}
