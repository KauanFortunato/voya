import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useAnimationControls,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from 'motion/react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, ZoomIn, ZoomOut, X } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { bottomSheetMotion, dialogBackdropMotion } from '../motion/dialogMotion'
import './PdfViewer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

type PdfViewerProps = {
  source: string
  title: string
  mimeType?: string
  onClose: () => void
}

export default function PdfViewer({ source, title, mimeType, onClose }: PdfViewerProps) {
  const reduceMotion = useReducedMotion()
  const animationControls = useAnimationControls()
  const dragControls = useDragControls()
  const didDrag = useRef(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [screenHeight, setScreenHeight] = useState(() => window.innerHeight)
  const [expanded, setExpanded] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(360)
  const [numberOfPages, setNumberOfPages] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1)
  const [progress, setProgress] = useState(0)
  const pinch = useRef({ initialDistance: 0, initialScale: 1, ratio: 1 })
  const pinchPage = useRef<HTMLElement | null>(null)
  const pinchFrame = useRef<number | null>(null)
  const collapsedY = Math.round(screenHeight * 0.53)
  const isImage = mimeType?.startsWith('image/') ?? false

  const snapTo = (nextExpanded: boolean) => {
    setExpanded(nextExpanded)
    void animationControls.start({
      y: nextExpanded ? 0 : collapsedY,
      opacity: 1,
      transition: reduceMotion
        ? { duration: 0 }
        : { type: 'spring', duration: 0.34, bounce: 0 },
    })
  }

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const updateWidth = () => setViewportWidth(element.clientWidth)
    const observer = new ResizeObserver(updateWidth)
    updateWidth()
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const distanceBetweenTouches = (touches: TouchList) => {
      const [first, second] = [touches[0], touches[1]]
      return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
    }
    const previewPage = () => {
      const pageElement = pinchPage.current
      if (!pageElement) return
      if (pinchFrame.current !== null) return
      pinchFrame.current = window.requestAnimationFrame(() => {
        pinchFrame.current = null
        pageElement.style.transform = `scale(${pinch.current.ratio})`
      })
    }
    const clearPreview = () => {
      if (pinchFrame.current !== null) {
        window.cancelAnimationFrame(pinchFrame.current)
        pinchFrame.current = null
      }
      const pageElement = pinchPage.current
      if (!pageElement) return
      pageElement.style.transform = ''
      pageElement.style.transformOrigin = ''
      pageElement.style.willChange = ''
      pinchPage.current = null
    }
    const startPinch = (event: TouchEvent) => {
      if (event.touches.length !== 2) return
      event.preventDefault()
      pinchPage.current = element.querySelector<HTMLElement>('.pdf-viewer__page-content')
      if (pinchPage.current) {
        pinchPage.current.style.transformOrigin = 'center top'
        pinchPage.current.style.willChange = 'transform'
      }
      pinch.current = {
        initialDistance: distanceBetweenTouches(event.touches),
        initialScale: scale,
        ratio: 1,
      }
    }
    const movePinch = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinch.current.initialDistance) return
      event.preventDefault()
      const rawScale = pinch.current.initialScale * (distanceBetweenTouches(event.touches) / pinch.current.initialDistance)
      const nextScale = Math.min(2.5, Math.max(0.75, rawScale))
      pinch.current.ratio = nextScale / pinch.current.initialScale
      previewPage()
    }
    const finishPinch = () => {
      if (!pinch.current.initialDistance) return
      const nextScale = Math.min(2.5, Math.max(0.75, pinch.current.initialScale * pinch.current.ratio))
      pinch.current.initialDistance = 0
      clearPreview()
      setScale(nextScale)
    }
    const preventNativeGesture = (event: Event) => event.preventDefault()

    element.addEventListener('touchstart', startPinch, { passive: false })
    element.addEventListener('touchmove', movePinch, { passive: false })
    element.addEventListener('touchend', finishPinch, { passive: false })
    element.addEventListener('touchcancel', finishPinch, { passive: false })
    element.addEventListener('gesturestart', preventNativeGesture, { passive: false })
    element.addEventListener('gesturechange', preventNativeGesture, { passive: false })
    element.addEventListener('gestureend', preventNativeGesture, { passive: false })
    return () => {
      clearPreview()
      element.removeEventListener('touchstart', startPinch)
      element.removeEventListener('touchmove', movePinch)
      element.removeEventListener('touchend', finishPinch)
      element.removeEventListener('touchcancel', finishPinch)
      element.removeEventListener('gesturestart', preventNativeGesture)
      element.removeEventListener('gesturechange', preventNativeGesture)
      element.removeEventListener('gestureend', preventNativeGesture)
    }
  }, [scale])

  useEffect(() => {
    const updateHeight = () => setScreenHeight(window.innerHeight)
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  useEffect(() => {
    void animationControls.start({
      y: expanded ? 0 : collapsedY,
      opacity: 1,
      transition: reduceMotion ? { duration: 0 } : { type: 'spring', duration: 0.3, bounce: 0 },
    })
  }, [animationControls, collapsedY, expanded, reduceMotion])

  const settleAfterDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const nextExpanded = info.velocity.y < -350 || info.offset.y < -80
      ? true
      : info.velocity.y > 350 || info.offset.y > 80
        ? false
        : expanded
    snapTo(nextExpanded)
  }

  return (
    <div className="pdf-viewer-layer" role="presentation">
      <motion.button
        className="pdf-viewer__backdrop"
        type="button"
        aria-label="Fechar documento"
        onClick={onClose}
        initial={dialogBackdropMotion(reduceMotion).initial}
        animate={{ opacity: expanded ? 1 : 0.72 }}
        exit={dialogBackdropMotion(reduceMotion).exit}
      />
      <motion.section
        className="pdf-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-viewer-title"
        initial={reduceMotion ? false : { opacity: 0, y: collapsedY }}
        animate={animationControls}
        exit={bottomSheetMotion(reduceMotion).exit}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: collapsedY }}
        dragElastic={0.04}
        dragMomentum={false}
        onDragStart={() => { didDrag.current = true }}
        onDragEnd={(event, info) => {
          settleAfterDrag(event, info)
          window.setTimeout(() => { didDrag.current = false }, 0)
        }}
      >
        <button
          className="pdf-viewer__grab-area"
          type="button"
          aria-label={expanded ? 'Recolher visualizador' : 'Expandir visualizador'}
          aria-expanded={expanded}
          onPointerDown={(event) => dragControls.start(event)}
          onClick={() => { if (!didDrag.current) snapTo(!expanded) }}
        >
          <span aria-hidden="true" />
          {expanded ? <ChevronDown size={17} aria-hidden="true" /> : <ChevronUp size={17} aria-hidden="true" />}
        </button>
        <header className="pdf-viewer__header">
        <div>
          <span>Documento</span>
          <h2 id="pdf-viewer-title">{title}</h2>
        </div>
        <div className="pdf-viewer__header-actions">
          <a href={source} target="_blank" rel="noreferrer" aria-label="Abrir documento externamente">
            <ExternalLink size={18} aria-hidden="true" />
          </a>
          <button type="button" aria-label="Fechar visualizador" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        </header>

        <div className="pdf-viewer__viewport" ref={viewportRef}>
        {isImage ? (
          <img
            className="pdf-viewer__image pdf-viewer__page-content"
            src={source}
            alt={title}
            decoding="async"
            style={{ width: Math.max(280, Math.min(viewportWidth - 24, 720)) * scale }}
          />
        ) : <Document
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
            className="pdf-viewer__page-content"
            pageNumber={page}
            width={Math.max(280, Math.min(viewportWidth - 24, 720))}
            scale={scale}
            renderAnnotationLayer
            renderTextLayer
          />
        </Document>}
        </div>

        <footer className="pdf-viewer__toolbar" aria-label="Controles do documento">
        {!isImage && <div>
          <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <span>{numberOfPages ? `${page} / ${numberOfPages}` : '— / —'}</span>
          <button type="button" aria-label="Próxima página" disabled={!numberOfPages || page >= numberOfPages} onClick={() => setPage((current) => current + 1)}>
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </div>}
        <div>
          <button type="button" aria-label="Diminuir zoom" disabled={scale <= 0.75} onClick={() => setScale((current) => Math.max(0.75, current - 0.25))}>
            <ZoomOut size={18} aria-hidden="true" />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button type="button" aria-label="Aumentar zoom" disabled={scale >= 2.5} onClick={() => setScale((current) => Math.min(2.5, current + 0.25))}>
            <ZoomIn size={18} aria-hidden="true" />
          </button>
        </div>
        </footer>
      </motion.section>
    </div>
  )
}
