import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  BedDouble,
  BusFront,
  Check,
  ChevronRight,
  FileText,
  Plane,
  ShieldCheck,
  Ticket,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import SubpageHeader from '../components/SubpageHeader'
import ModalPortal from '../components/ModalPortal'
import { useAuth } from '../auth/auth'
import {
  listDocuments,
  updateDocumentActivities,
  uploadDocument,
  type ApiDocument,
  type ApiItineraryActivity,
} from '../api/documents'
import {
  documentCategories,
  documentSeed,
  travelers,
  type DocumentCategory,
  type TravelerId,
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
const uploadCategories: DocumentCategory[] = ['Voo', 'Hospedagem', 'Transporte', 'Ingresso', 'Seguro', 'Outro']
const allowedUploadTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const maxUploadSize = 25 * 1024 * 1024

type UploadDraft = {
  file: File
  title: string
  category: DocumentCategory
  travelerIds: TravelerId[]
  activityIds: string[]
}

function inferDocumentTitle(filename: string) {
  return filename.replace(/\.[^.]+$/, '').replaceAll(/[-_]+/g, ' ').trim()
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

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
    activityIds: document.activityIds,
    note: `Guardado na NAS · ${Math.max(1, Math.round(Number(document.fileSize) / 1024))} KB`,
  }
}

export default function DocumentsPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const reduceMotion = useReducedMotion()
  const fileInput = useRef<HTMLInputElement>(null)
  const deepLinkOpened = useRef(false)
  const [remoteDocuments, setRemoteDocuments] = useState<TripDocument[]>([])
  const [activities, setActivities] = useState<ApiItineraryActivity[]>([])
  const [category, setCategory] = useState<(typeof documentCategories)[number]>('Todos')
  const [selected, setSelected] = useState<TripDocument | null>(null)
  const [viewer, setViewer] = useState<{ title: string; source: string; temporary: boolean } | null>(null)
  const [uploadDraft, setUploadDraft] = useState<UploadDraft | null>(null)
  const [associationDraft, setAssociationDraft] = useState<string[]>([])
  const [associationState, setAssociationState] = useState<'idle' | 'saving' | 'error'>('idle')
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
      setActivities(payload.activities.filter((activity) => activity.category !== 'tempo_livre'))
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

  const prepareUpload = (file?: File) => {
    if (!file) return
    if (fileInput.current) fileInput.current.value = ''
    const userId = user?.displayName.toLocaleLowerCase('pt-PT')
    if (!userId || !travelerIds.has(userId)) {
      setUploadState({ status: 'error', progress: 0, message: 'Não foi possível associar o viajante atual.' })
      return
    }
    if (!allowedUploadTypes.has(file.type)) {
      setUploadState({ status: 'error', progress: 0, message: 'Use um ficheiro PDF, JPG, PNG ou WebP.' })
      return
    }
    if (file.size > maxUploadSize) {
      setUploadState({ status: 'error', progress: 0, message: 'O ficheiro deve ter no máximo 25 MB.' })
      return
    }

    setUploadState({ status: 'idle', progress: 0, message: '' })
    setUploadDraft({
      file,
      title: inferDocumentTitle(file.name),
      category: 'Outro',
      travelerIds: [userId as TravelerId],
      activityIds: [],
    })
  }

  const closeUploadDraft = () => {
    if (uploadState.status === 'uploading') return
    setUploadDraft(null)
    setUploadState({ status: 'idle', progress: 0, message: '' })
  }

  const toggleUploadTraveler = (travelerId: TravelerId) => {
    setUploadDraft((current) => {
      if (!current) return current
      const selected = current.travelerIds.includes(travelerId)
        ? current.travelerIds.filter((id) => id !== travelerId)
        : [...current.travelerIds, travelerId]
      return { ...current, travelerIds: selected }
    })
  }

  const toggleUploadActivity = (activityId: string) => {
    setUploadDraft((current) => {
      if (!current) return current
      const activityIds = current.activityIds.includes(activityId)
        ? current.activityIds.filter((id) => id !== activityId)
        : [...current.activityIds, activityId]
      return { ...current, activityIds }
    })
  }

  const openDocument = (document: TripDocument) => {
    setAssociationDraft(document.activityIds ?? [])
    setAssociationState('idle')
    setSelected(document)
  }

  useEffect(() => {
    if (deepLinkOpened.current) return
    const documentId = searchParams.get('document')
    const document = remoteDocuments.find((item) => item.id === documentId)
    if (!document) return
    deepLinkOpened.current = true
    openDocument(document)
  }, [remoteDocuments, searchParams])

  const saveDocumentActivities = async () => {
    if (!selected || !remoteDocuments.some((document) => document.id === selected.id)) return
    setAssociationState('saving')
    try {
      const result = await updateDocumentActivities(selected.id, associationDraft)
      const updated = { ...selected, activityIds: result.activityIds }
      setRemoteDocuments((current) => current.map((document) => document.id === selected.id ? updated : document))
      setSelected(updated)
      setAssociationState('idle')
    } catch {
      setAssociationState('error')
    }
  }

  const submitUpload = async (event: FormEvent) => {
    event.preventDefault()
    if (!uploadDraft || uploadState.status === 'uploading') return
    const title = uploadDraft.title.trim()
    if (!title || !uploadDraft.travelerIds.length) return

    setUploadState({ status: 'uploading', progress: 0, message: `A enviar ${uploadDraft.file.name}` })
    try {
      const uploaded = await uploadDocument(
        uploadDraft.file,
        {
          title,
          category: uploadDraft.category,
          travelerIds: uploadDraft.travelerIds,
          activityIds: uploadDraft.activityIds,
        },
        (progress) => setUploadState((current) => ({ ...current, progress })),
      )
      const document = mapApiDocument(uploaded)
      setRemoteDocuments((current) => [document, ...current])
      setCategory('Todos')
      setUploadDraft(null)
      openDocument(document)
      setUploadState({ status: 'success', progress: 100, message: 'Documento guardado na NAS.' })
    } catch (error) {
      setUploadState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Não foi possível importar o documento',
      })
    }
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
        onChange={(event) => prepareUpload(event.target.files?.[0])}
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
              onClick={() => openDocument(document)}
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

      <ModalPortal open={Boolean(uploadDraft)} onClose={closeUploadDraft}>
        {uploadDraft && (
          <div className="document-sheet-layer" role="presentation">
            <motion.button
              className="document-sheet-backdrop"
              type="button"
              aria-label="Cancelar importação"
              disabled={uploadState.status === 'uploading'}
              onClick={closeUploadDraft}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.18 }}
            />
            <motion.form
              className="document-sheet document-upload-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="document-upload-title"
              aria-describedby="document-upload-description"
              onSubmit={(event) => void submitUpload(event)}
              initial={reduceMotion ? false : { y: '100%' }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduceMotion ? undefined : { y: 24, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.34, bounce: 0 }}
            >
              <span className="document-sheet__handle" aria-hidden="true" />
              <button
                className="document-sheet__close"
                type="button"
                aria-label="Cancelar importação"
                disabled={uploadState.status === 'uploading'}
                onClick={closeUploadDraft}
              >
                <X size={19} aria-hidden="true" />
              </button>
              <span className="document-sheet__eyebrow">Novo documento</span>
              <h2 id="document-upload-title">Revisar antes de enviar</h2>
              <p id="document-upload-description">Organize o ficheiro para a família encontrá-lo rapidamente.</p>

              <div className="document-upload-file">
                <span><FileText size={20} aria-hidden="true" /></span>
                <div>
                  <strong>{uploadDraft.file.name}</strong>
                  <small>{formatFileSize(uploadDraft.file.size)}</small>
                </div>
              </div>

              <label className="document-upload-field">
                <span>Título</span>
                <input
                  value={uploadDraft.title}
                  maxLength={160}
                  disabled={uploadState.status === 'uploading'}
                  onChange={(event) => setUploadDraft((current) => current ? { ...current, title: event.target.value } : current)}
                  required
                />
              </label>

              <fieldset className="document-upload-field" disabled={uploadState.status === 'uploading'}>
                <legend>Categoria</legend>
                <div className="document-upload-categories">
                  {uploadCategories.map((option) => {
                    const Icon = categoryIcons[option]
                    return (
                      <button
                        type="button"
                        key={option}
                        className={uploadDraft.category === option ? 'is-selected' : ''}
                        aria-pressed={uploadDraft.category === option}
                        onClick={() => setUploadDraft((current) => current ? { ...current, category: option } : current)}
                      >
                        <Icon size={16} aria-hidden="true" />
                        {option}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <fieldset className="document-upload-field" disabled={uploadState.status === 'uploading'}>
                <legend>Itens do roteiro <small>(opcional)</small></legend>
                {activities.length ? (
                  <div className="document-upload-activities">
                    {activities.map((activity) => {
                      const isSelected = uploadDraft.activityIds.includes(activity.id)
                      return (
                        <button
                          type="button"
                          key={activity.id}
                          className={isSelected ? 'is-selected' : ''}
                          aria-pressed={isSelected}
                          onClick={() => toggleUploadActivity(activity.id)}
                        >
                          <span><strong>{activity.title}</strong><small>{activity.dayDate} · {activity.city}{activity.time ? ` · ${activity.time}` : ''}</small></span>
                          {isSelected && <Check size={15} aria-hidden="true" />}
                        </button>
                      )
                    })}
                  </div>
                ) : <small className="document-upload-muted">Importe o roteiro para disponibilizar as atividades.</small>}
              </fieldset>

              <fieldset className="document-upload-field" disabled={uploadState.status === 'uploading'}>
                <legend>Viajantes associados</legend>
                <div className="document-upload-travelers">
                  {(Object.entries(travelers) as Array<[TravelerId, (typeof travelers)[TravelerId]]>).map(([id, traveler]) => {
                    const isSelected = uploadDraft.travelerIds.includes(id)
                    return (
                      <button
                        type="button"
                        key={id}
                        className={isSelected ? 'is-selected' : ''}
                        aria-pressed={isSelected}
                        onClick={() => toggleUploadTraveler(id)}
                      >
                        <i>{traveler.initials}</i>
                        <span>{traveler.name}</span>
                        {isSelected && <Check size={15} aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
                {!uploadDraft.travelerIds.length && <small className="document-upload-help">Escolha ao menos um viajante.</small>}
              </fieldset>

              {uploadState.status === 'error' && <p className="document-upload-error" role="alert">{uploadState.message}</p>}
              {uploadState.status === 'uploading' && (
                <div className="document-upload-active" role="status">
                  <span>A enviar para a NAS</span>
                  <strong>{uploadState.progress}%</strong>
                  <span className="documents-upload-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadState.progress}>
                    <i style={{ transform: `scaleX(${uploadState.progress / 100})` }} />
                  </span>
                </div>
              )}

              <button
                className="document-sheet__primary"
                type="submit"
                disabled={uploadState.status === 'uploading' || !uploadDraft.title.trim() || !uploadDraft.travelerIds.length}
                aria-busy={uploadState.status === 'uploading'}
              >
                {uploadState.status === 'uploading' ? `A enviar… ${uploadState.progress}%` : 'Guardar na NAS'}
              </button>
            </motion.form>
          </div>
        )}
      </ModalPortal>

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

              {remoteDocuments.some((document) => document.id === selected.id) && (
                <div className="document-associations">
                  <strong>Ligado ao roteiro</strong>
                  {activities.length ? (
                    <div>
                      {activities.map((activity) => {
                        const isLinked = associationDraft.includes(activity.id)
                        return (
                          <button
                            type="button"
                            key={activity.id}
                            className={isLinked ? 'is-selected' : ''}
                            aria-pressed={isLinked}
                            disabled={associationState === 'saving'}
                            onClick={() => setAssociationDraft((current) => current.includes(activity.id)
                              ? current.filter((id) => id !== activity.id)
                              : [...current, activity.id])}
                          >
                            <span><b>{activity.title}</b><small>{activity.dayDate} · {activity.city}</small></span>
                            {isLinked && <Check size={15} aria-hidden="true" />}
                          </button>
                        )
                      })}
                    </div>
                  ) : <p>O roteiro ainda não foi importado para a NAS.</p>}
                  {associationState === 'error' && <p role="alert">Não foi possível guardar as ligações.</p>}
                  {activities.length > 0 && (
                    <button
                      className="document-associations__save"
                      type="button"
                      disabled={associationState === 'saving'}
                      onClick={() => void saveDocumentActivities()}
                    >
                      {associationState === 'saving' ? 'A guardar…' : 'Guardar ligações'}
                    </button>
                  )}
                  {associationDraft.length > 0 && (
                    <Link to={`/itinerary?activity=${associationDraft[0]}`}>Ver no roteiro</Link>
                  )}
                </div>
              )}

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
