import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  BedDouble,
  BusFront,
  ChevronRight,
  FileText,
  Plane,
  ShieldCheck,
  Ticket,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react'

import SubpageHeader from '../components/SubpageHeader'
import ModalPortal from '../components/ModalPortal'
import { useAuth } from '../auth/auth'
import { listDocuments, uploadDocument, type ApiDocument } from '../api/documents'
import {
  documentCategories,
  documentSeed,
  travelers,
  type DocumentCategory,
  type TripDocument,
} from '../data/documents'
import './DocumentsPage.css'

const PdfViewer = lazy(() => import('../components/PdfViewer'))

const categoryIcons: Record<DocumentCategory, LucideIcon> = {
  Voo: Plane,
  Hospedagem: BedDouble,
  Transporte: BusFront,
  Ingresso: Ticket,
  Seguro: ShieldCheck,
  Outro: FileText,
}

const travelerIds = new Set(Object.keys(travelers))

function mapApiDocument(document: ApiDocument): TripDocument {
  const date = new Date(document.startsAt ?? document.createdAt)
  const dateLabel = Number.isNaN(date.getTime())
    ? 'Importado recentemente'
    : `Importado em ${new Intl.DateTimeFormat('pt-PT', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)}`
  const status: TripDocument['status'] = document.status === 'confirmed'
    ? 'Confirmado'
    : document.status === 'attention' || document.status === 'expired'
      ? 'Atenção'
      : 'Rascunho'

  return {
    id: document.id,
    title: document.title,
    category: document.category as DocumentCategory,
    dateLabel,
    bookingCode: document.bookingCode ?? undefined,
    status,
    travelerIds: document.travelerIds.filter((id) => travelerIds.has(id)) as TripDocument['travelerIds'],
    fileName: document.originalFilename,
    fileUrl: `/api/documents/${document.id}/file`,
    note: `Guardado na NAS · ${Math.max(1, Math.round(Number(document.fileSize) / 1024))} KB`,
  }
}

export default function DocumentsPage() {
  const { user } = useAuth()
  const reduceMotion = useReducedMotion()
  const fileInput = useRef<HTMLInputElement>(null)
  const [remoteDocuments, setRemoteDocuments] = useState<TripDocument[]>([])
  const [category, setCategory] = useState<(typeof documentCategories)[number]>('Todos')
  const [selected, setSelected] = useState<TripDocument | null>(null)
  const [viewer, setViewer] = useState<{ title: string; source: string; temporary: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [uploadState, setUploadState] = useState<{
    status: 'idle' | 'uploading' | 'success' | 'error'
    progress: number
    message: string
  }>({ status: 'idle', progress: 0, message: '' })

  const documents = useMemo(() => [...remoteDocuments, ...documentSeed], [remoteDocuments])

  const loadRemoteDocuments = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setLoadError('')
    try {
      const payload = await listDocuments(signal)
      setRemoteDocuments(payload.documents.map(mapApiDocument))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os documentos da NAS')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadRemoteDocuments(controller.signal)
    return () => controller.abort()
  }, [loadRemoteDocuments])

  const visibleDocuments = useMemo(
    () => documents.filter((document) => category === 'Todos' || document.category === category),
    [category, documents],
  )
  const confirmed = documents.filter((document) => document.status === 'Confirmado').length
  const progress = documents.length ? Math.round((confirmed / documents.length) * 100) : 0

  const importFile = async (file?: File) => {
    if (!file) return
    const userId = user?.displayName.toLocaleLowerCase('pt-PT')
    if (!userId || !travelerIds.has(userId)) {
      setUploadState({ status: 'error', progress: 0, message: 'Não foi possível associar o viajante atual.' })
      return
    }

    setUploadState({ status: 'uploading', progress: 0, message: `A enviar ${file.name}` })
    try {
      const uploaded = await uploadDocument(
        file,
        {
          title: file.name.replace(/\.[^.]+$/, '').replaceAll(/[-_]+/g, ' ').trim(),
          category: 'Outro',
          travelerIds: [userId],
        },
        (progress) => setUploadState((current) => ({ ...current, progress })),
      )
      const document = mapApiDocument(uploaded)
      setRemoteDocuments((current) => [document, ...current])
      setCategory('Todos')
      setSelected(document)
      setUploadState({ status: 'success', progress: 100, message: 'Documento guardado na NAS.' })
    } catch (error) {
      setUploadState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Não foi possível importar o documento',
      })
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const openFile = (document: TripDocument) => {
    if (document.localFile) {
      const url = URL.createObjectURL(document.localFile)
      setSelected(null)
      setViewer({ title: document.title, source: url, temporary: true })
      return
    }
    if (document.fileUrl) {
      setSelected(null)
      setViewer({ title: document.title, source: document.fileUrl, temporary: false })
    }
  }

  const closeViewer = () => {
    if (viewer?.temporary) URL.revokeObjectURL(viewer.source)
    setViewer(null)
  }

  return (
    <main className="documents-page" id="main-content">
      <SubpageHeader
        kicker="Roma e Veneza"
        title="Documentos"
        actionIcon={Upload}
        actionLabel="Importar documento"
        onAction={() => uploadState.status !== 'uploading' && fileInput.current?.click()}
      />
      <input
        ref={fileInput}
        className="documents-file-input"
        type="file"
        accept="application/pdf,image/*"
        disabled={uploadState.status === 'uploading'}
        onChange={(event) => void importFile(event.target.files?.[0])}
      />

      {uploadState.status !== 'idle' && (
        <section
          className={`documents-upload-state is-${uploadState.status}`}
          aria-live="polite"
          aria-busy={uploadState.status === 'uploading'}
        >
          <div>
            <strong>{uploadState.status === 'uploading' ? `${uploadState.progress}%` : uploadState.status === 'success' ? 'Concluído' : 'Falhou'}</strong>
            <span>{uploadState.message}</span>
          </div>
          {uploadState.status === 'uploading' && (
            <span className="documents-upload-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadState.progress}>
              <i style={{ transform: `scaleX(${uploadState.progress / 100})` }} />
            </span>
          )}
          {uploadState.status !== 'uploading' && (
            <button type="button" onClick={() => setUploadState({ status: 'idle', progress: 0, message: '' })}>Fechar</button>
          )}
        </section>
      )}

      <section className="documents-summary" aria-label={`${confirmed} de ${documents.length} documentos confirmados`}>
        <div className="documents-summary__heading">
          <div>
            <strong>Prontos para a viagem</strong>
            <span>{confirmed} de {documents.length} confirmados</span>
          </div>
          <b>{progress}%</b>
        </div>
        <span
          className="documents-progress"
          role="progressbar"
          aria-label="Documentos confirmados"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <i style={{ transform: `scaleX(${progress / 100})` }} />
        </span>
      </section>

      <div className="documents-filters" aria-label="Filtrar documentos">
        {documentCategories.map((option) => (
          <button
            type="button"
            key={option}
            className={category === option ? 'is-active' : ''}
            aria-pressed={category === option}
            onClick={() => setCategory(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <section className="documents-list" aria-live="polite">
        {loading && !remoteDocuments.length && (
          <div className="documents-loading" role="status" aria-label="A carregar documentos da NAS">
            {[0, 1].map((item) => <span key={item}><i /><b /><em /></span>)}
          </div>
        )}
        {loadError && (
          <div className="documents-load-error" role="alert">
            <span>{loadError}</span>
            <button type="button" onClick={() => void loadRemoteDocuments()}>Tentar novamente</button>
          </div>
        )}
        {visibleDocuments.length ? visibleDocuments.map((document) => {
          const Icon = categoryIcons[document.category]
          return (
            <button
              className="document-card"
              type="button"
              key={document.id}
              onClick={() => setSelected(document)}
            >
              <span className={`document-card__icon is-${document.status.toLowerCase().replace('ç', 'c')}`}>
                <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="document-card__content">
                <span className="document-card__topline">
                  <strong>{document.title}</strong>
                  <span className={`document-status is-${document.status.toLowerCase().replace('ç', 'c')}`}>
                    {document.status}
                  </span>
                </span>
                <small>{document.category} · {document.dateLabel}</small>
                <span className="document-card__footer">
                  <span className="traveler-stack" aria-label={document.travelerIds.map((id) => travelers[id].name).join(', ')}>
                    {document.travelerIds.map((id) => <i key={id}>{travelers[id].initials}</i>)}
                  </span>
                  {document.bookingCode && <code>{document.bookingCode}</code>}
                </span>
              </span>
              <ChevronRight className="document-card__chevron" size={18} aria-hidden="true" />
            </button>
          )
        }) : (
          <div className="documents-empty">
            <FileText size={24} aria-hidden="true" />
            <strong>Nenhum documento aqui</strong>
            <span>Importe um ficheiro ou escolha outra categoria.</span>
          </div>
        )}
      </section>

      <ModalPortal open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected && (
          <div className="document-sheet-layer" role="presentation">
            <motion.button
              className="document-sheet-backdrop"
              type="button"
              aria-label="Fechar detalhes"
              onClick={() => setSelected(null)}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.18 }}
            />
            <motion.section
              className="document-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="document-sheet-title"
              initial={reduceMotion ? false : { y: '100%' }}
              animate={{ y: 0 }}
              exit={reduceMotion ? undefined : { y: '100%' }}
              transition={{ type: 'spring', duration: 0.38, bounce: 0 }}
            >
              <span className="document-sheet__handle" aria-hidden="true" />
              <button className="document-sheet__close" type="button" aria-label="Fechar" onClick={() => setSelected(null)}>
                <X size={19} aria-hidden="true" />
              </button>
              <span className="document-sheet__eyebrow">{selected.category}</span>
              <h2 id="document-sheet-title">{selected.title}</h2>
              <p>{selected.dateLabel}</p>

              <dl className="document-details">
                <div><dt>Estado</dt><dd>{selected.status}</dd></div>
                {selected.bookingCode && <div><dt>Código da reserva</dt><dd><code>{selected.bookingCode}</code></dd></div>}
                <div><dt>Ficheiro</dt><dd>{selected.fileName ?? 'Ainda não anexado'}</dd></div>
              </dl>

              <div className="document-travelers">
                <strong>Viajantes associados</strong>
                <div>
                  {selected.travelerIds.map((id) => (
                    <span key={id}>
                      <i>{travelers[id].initials}</i>
                      {travelers[id].name}
                      {selected.travelerRoles?.[id] && <em>{selected.travelerRoles[id]}</em>}
                    </span>
                  ))}
                </div>
              </div>

              {selected.note && <p className="document-sheet__note">{selected.note}</p>}

              {selected.localFile || selected.fileUrl ? (
                <button className="document-sheet__primary" type="button" onClick={() => openFile(selected)}>
                  Visualizar no app
                </button>
              ) : (
                <p className="document-sheet__notice">Os dados são demonstrativos. O ficheiro real será ligado à NAS na próxima etapa.</p>
              )}
            </motion.section>
          </div>
        )}
      </ModalPortal>

      <ModalPortal open={Boolean(viewer)} onClose={closeViewer}>
        {viewer && (
          <Suspense fallback={<div className="pdf-viewer-lazy" role="status">A preparar visualizador…</div>}>
            <PdfViewer title={viewer.title} source={viewer.source} onClose={closeViewer} />
          </Suspense>
        )}
      </ModalPortal>
    </main>
  )
}
