import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  BedDouble,
  BusFront,
  Check,
  ChevronRight,
  Download,
  FileText,
  Plane,
  Share2,
  ShieldCheck,
  Ticket,
  Trash2,
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
  deleteDocument as removeRemoteDocument,
  updateDocumentActivities,
  uploadDocument,
  type ApiDocument,
  type ApiItineraryActivity,
} from '../api/documents'
import {
  documentCategories,
  travelers,
  type DocumentCategory,
  type TravelerId,
  type TripDocument,
} from '../data/documents'
import { documentFilename } from '../documents/filename'
import { canShareDocument, downloadDocument } from '../documents/share'
import {
  getOfflineDocumentUrl,
  isDocumentAvailableOffline,
  readDocumentBlob,
  removeDocumentOffline,
  storeDocumentOffline,
  supportsOfflineDocuments,
} from '../offline/documents'
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
    mimeType: document.mimeType,
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
  const [deleteConfirm, setDeleteConfirm] = useState<TripDocument | null>(null)
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting' | 'error'>('idle')
  const [viewer, setViewer] = useState<{ title: string; source: string; mimeType?: string; temporary: boolean } | null>(null)
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
  const [offlineStates, setOfflineStates] = useState<Record<string, {
    status: 'checking' | 'idle' | 'downloading' | 'available' | 'removing' | 'error'
    progress: number | null
    message: string
  }>>({})
  const preparedShare = useRef<{ documentId: string; file: File } | null>(null)
  const [shareState, setShareState] = useState<{
    status: 'idle' | 'preparing' | 'ready' | 'sharing' | 'success' | 'downloaded' | 'error'
    progress: number | null
    message: string
  }>({ status: 'idle', progress: null, message: '' })

  const documents = remoteDocuments

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

  useEffect(() => {
    let active = true
    const documentsWithFiles = remoteDocuments.filter((document) => document.fileUrl)
    if (!documentsWithFiles.length) return

    if (!supportsOfflineDocuments()) {
      setOfflineStates(Object.fromEntries(documentsWithFiles.map((document) => [document.id, {
        status: 'error', progress: null, message: 'Este navegador não permite guardar documentos offline.',
      }])))
      return
    }

    setOfflineStates((current) => Object.fromEntries(documentsWithFiles.map((document) => [
      document.id,
      current[document.id] ?? { status: 'checking', progress: null, message: 'A verificar disponibilidade…' },
    ])))
    void Promise.all(documentsWithFiles.map(async (document) => {
      const available = await isDocumentAvailableOffline(document.fileUrl!)
      return [document.id, {
        status: available ? 'available' : 'idle',
        progress: available ? 100 : null,
        message: available ? 'Disponível sem ligação à internet.' : 'Ainda requer ligação à internet.',
      }] as const
    })).then((entries) => {
      if (active) setOfflineStates(Object.fromEntries(entries))
    }).catch(() => {
      if (!active) return
      setOfflineStates(Object.fromEntries(documentsWithFiles.map((document) => [document.id, {
        status: 'error', progress: null, message: 'Não foi possível verificar o armazenamento local.',
      }])))
    })

    return () => { active = false }
  }, [remoteDocuments])

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
    preparedShare.current = null
    setShareState({ status: 'idle', progress: null, message: '' })
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

  const requestDocumentDeletion = (document: TripDocument) => {
    setSelected(null)
    setDeleteState('idle')
    setDeleteConfirm(document)
  }

  const cancelDocumentDeletion = () => {
    if (deleteState === 'deleting' || !deleteConfirm) return
    const document = deleteConfirm
    setDeleteConfirm(null)
    openDocument(document)
  }

  const confirmDocumentDeletion = async () => {
    if (!deleteConfirm || deleteState === 'deleting') return
    setDeleteState('deleting')
    try {
      await removeRemoteDocument(deleteConfirm.id)
      if (deleteConfirm.fileUrl) await removeDocumentOffline(deleteConfirm.fileUrl).catch(() => undefined)
      setRemoteDocuments((current) => current.filter((document) => document.id !== deleteConfirm.id))
      setDeleteConfirm(null)
      setDeleteState('idle')
      setUploadState({ status: 'success', progress: 100, message: 'Documento apagado da NAS.' })
    } catch {
      setDeleteState('error')
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

  const openFile = async (document: TripDocument) => {
    if (document.localFile) {
      const url = URL.createObjectURL(document.localFile)
      setSelected(null)
      setViewer({ title: document.title, source: url, mimeType: document.localFile.type, temporary: true })
      return
    }
    if (document.fileUrl) {
      const offlineUrl = await getOfflineDocumentUrl(document.fileUrl).catch(() => null)
      setSelected(null)
      setViewer({
        title: document.title,
        source: offlineUrl ?? document.fileUrl,
        mimeType: document.mimeType,
        temporary: Boolean(offlineUrl),
      })
    }
  }

  const saveForOffline = async (document: TripDocument) => {
    if (!document.fileUrl) return
    setOfflineStates((current) => ({ ...current, [document.id]: {
      status: 'downloading', progress: 0, message: 'A guardar neste dispositivo…',
    } }))
    try {
      await storeDocumentOffline(document.fileUrl, (progress) => {
        setOfflineStates((current) => ({ ...current, [document.id]: {
          status: 'downloading', progress, message: progress === null
            ? 'A descarregar documento…'
            : `A descarregar documento… ${progress}%`,
        } }))
      })
      setOfflineStates((current) => ({ ...current, [document.id]: {
        status: 'available', progress: 100, message: 'Disponível sem ligação à internet.',
      } }))
    } catch (error) {
      setOfflineStates((current) => ({ ...current, [document.id]: {
        status: 'error', progress: null,
        message: error instanceof Error ? error.message : 'Não foi possível guardar o documento.',
      } }))
    }
  }

  const removeFromOffline = async (document: TripDocument) => {
    if (!document.fileUrl) return
    setOfflineStates((current) => ({ ...current, [document.id]: {
      status: 'removing', progress: null, message: 'A remover deste dispositivo…',
    } }))
    try {
      await removeDocumentOffline(document.fileUrl)
      setOfflineStates((current) => ({ ...current, [document.id]: {
        status: 'idle', progress: null, message: 'Ainda requer ligação à internet.',
      } }))
    } catch {
      setOfflineStates((current) => ({ ...current, [document.id]: {
        status: 'error', progress: null, message: 'Não foi possível remover a cópia local.',
      } }))
    }
  }

  const shareDocument = async (document: TripDocument) => {
    const prepared = preparedShare.current?.documentId === document.id
      ? preparedShare.current.file
      : null

    if (prepared && canShareDocument(prepared)) {
      setShareState({ status: 'sharing', progress: 100, message: 'A abrir as opções de compartilhamento…' })
      try {
        await navigator.share({
          files: [prepared],
          title: document.title,
          text: `Documento da viagem: ${document.title}`,
        })
        setShareState({ status: 'success', progress: 100, message: 'Documento compartilhado.' })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setShareState({ status: 'ready', progress: 100, message: 'Compartilhamento cancelado. O arquivo continua pronto.' })
          return
        }
        setShareState({ status: 'error', progress: null, message: 'Não foi possível abrir o compartilhamento.' })
      }
      return
    }

    setShareState({ status: 'preparing', progress: 0, message: 'A preparar o arquivo…' })
    try {
      const blob = document.localFile ?? (document.fileUrl
        ? await readDocumentBlob(document.fileUrl, (progress) => setShareState({
          status: 'preparing',
          progress,
          message: progress === null ? 'A preparar o arquivo…' : `A preparar o arquivo… ${progress}%`,
        }))
        : null)
      if (!blob) throw new Error('Este documento ainda não possui um arquivo para compartilhar.')

      const mimeType = blob.type || document.mimeType || 'application/octet-stream'
      const file = new File(
        [blob],
        documentFilename(document.fileName, document.title, mimeType),
        { type: mimeType },
      )
      preparedShare.current = { documentId: document.id, file }

      if (canShareDocument(file)) {
        setShareState({
          status: 'ready',
          progress: 100,
          message: 'Arquivo pronto. Toque novamente para escolher com quem compartilhar.',
        })
        return
      }

      downloadDocument(file)
      setShareState({
        status: 'downloaded',
        progress: 100,
        message: 'O navegador não oferece compartilhamento de arquivos. O download foi iniciado.',
      })
    } catch (error) {
      setShareState({
        status: 'error',
        progress: null,
        message: error instanceof Error ? error.message : 'Não foi possível preparar o documento.',
      })
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
              <p id="document-upload-description">Organize o ficheiro para que todos possam encontrá-lo rapidamente.</p>

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
                      aria-busy={associationState === 'saving'}
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
                <>
                  <div className="document-file-actions">
                    <button className="document-sheet__primary" type="button" onClick={() => void openFile(selected)}>
                      Visualizar no app
                    </button>
                    <button
                      className="document-sheet__share"
                      type="button"
                      disabled={shareState.status === 'preparing' || shareState.status === 'sharing'}
                      aria-busy={shareState.status === 'preparing' || shareState.status === 'sharing'}
                      onClick={() => void shareDocument(selected)}
                    >
                      <Share2 size={17} aria-hidden="true" />
                      {shareState.status === 'preparing' ? 'A preparar…'
                        : shareState.status === 'sharing' ? 'A compartilhar…'
                          : shareState.status === 'ready' || shareState.status === 'success' ? 'Compartilhar agora'
                            : shareState.status === 'error' ? 'Tentar novamente'
                              : shareState.status === 'downloaded' ? 'Baixar novamente'
                                : 'Compartilhar arquivo'}
                    </button>
                  </div>
                  {shareState.status !== 'idle' && (
                    <div className={`document-share-state is-${shareState.status}`} role={shareState.status === 'error' ? 'alert' : 'status'}>
                      <span>{shareState.message}</span>
                      {shareState.status === 'preparing' && shareState.progress !== null && (
                        <span className="document-share-progress" role="progressbar" aria-label="Preparar documento para compartilhar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shareState.progress}>
                          <i style={{ transform: `scaleX(${shareState.progress / 100})` }} />
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="document-sheet__notice">Os dados são demonstrativos. O ficheiro real será ligado à NAS na próxima etapa.</p>
              )}

              {selected.fileUrl && remoteDocuments.some((document) => document.id === selected.id) && (() => {
                const offline = offlineStates[selected.id] ?? {
                  status: 'checking' as const, progress: null, message: 'A verificar disponibilidade…',
                }
                const busy = offline.status === 'checking' || offline.status === 'downloading' || offline.status === 'removing'
                const available = offline.status === 'available'
                return (
                  <section className={`document-offline is-${offline.status}`} aria-live="polite" aria-busy={busy}>
                    <div>
                      <span className="document-offline__icon"><Download size={18} aria-hidden="true" /></span>
                      <span><strong>Disponibilidade offline</strong><small>{offline.message}</small></span>
                    </div>
                    {offline.status === 'downloading' && offline.progress !== null && (
                      <span className="document-offline__progress" role="progressbar" aria-label="Descarregar documento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={offline.progress}>
                        <i style={{ transform: `scaleX(${offline.progress / 100})` }} />
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={busy || !supportsOfflineDocuments()}
                      onClick={() => void (available ? removeFromOffline(selected) : saveForOffline(selected))}
                    >
                      {offline.status === 'checking' ? 'A verificar…'
                        : offline.status === 'downloading' ? 'A guardar…'
                          : offline.status === 'removing' ? 'A remover…'
                            : available ? 'Remover deste dispositivo'
                              : offline.status === 'error' ? 'Tentar novamente'
                                : !supportsOfflineDocuments() ? 'Não disponível'
                                  : 'Guardar neste dispositivo'}
                    </button>
                  </section>
                )
              })()}

              {remoteDocuments.some((document) => document.id === selected.id) && (
                <button className="document-sheet__delete" type="button" onClick={() => requestDocumentDeletion(selected)}>
                  <Trash2 size={16} aria-hidden="true" />Apagar documento
                </button>
              )}
            </motion.section>
          </div>
        )}
      </ModalPortal>

      <ModalPortal open={Boolean(deleteConfirm)} onClose={cancelDocumentDeletion}>
        {deleteConfirm && (
          <div className="document-sheet-layer" role="presentation">
            <motion.button
              className="document-sheet-backdrop"
              type="button"
              aria-label="Cancelar exclusão"
              disabled={deleteState === 'deleting'}
              onClick={cancelDocumentDeletion}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.16 }}
            />
            <motion.section
              className="document-sheet document-delete-sheet"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="document-delete-title"
              aria-describedby="document-delete-description"
              initial={reduceMotion ? false : { opacity: 0, y: 24, filter: 'blur(2px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 10, filter: 'blur(1px)' }}
              transition={{ type: 'spring', duration: 0.28, bounce: 0 }}
            >
              <span className="document-sheet__handle" aria-hidden="true" />
              <span className="document-delete-sheet__icon"><Trash2 size={20} aria-hidden="true" /></span>
              <h2 id="document-delete-title">Apagar este documento?</h2>
              <p id="document-delete-description">
                “{deleteConfirm.title}” será removido do app e do armazenamento da NAS. Esta ação não pode ser desfeita.
              </p>
              {deleteState === 'error' && <p className="document-delete-sheet__error" role="alert">Não foi possível apagar. O documento continua guardado.</p>}
              <div className="document-delete-sheet__actions">
                <button type="button" disabled={deleteState === 'deleting'} onClick={cancelDocumentDeletion}>Cancelar</button>
                <button type="button" disabled={deleteState === 'deleting'} aria-busy={deleteState === 'deleting'} onClick={() => void confirmDocumentDeletion()}>
                  {deleteState === 'deleting' ? 'A apagar…' : 'Sim, apagar'}
                </button>
              </div>
            </motion.section>
          </div>
        )}
      </ModalPortal>

      <ModalPortal open={Boolean(viewer)} onClose={closeViewer}>
        {viewer && (
          <Suspense fallback={<div className="pdf-viewer-lazy" role="status">A preparar visualizador…</div>}>
            <PdfViewer title={viewer.title} source={viewer.source} mimeType={viewer.mimeType} onClose={closeViewer} />
          </Suspense>
        )}
      </ModalPortal>
    </main>
  )
}
