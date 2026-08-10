import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
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
import {
  documentCategories,
  documentSeed,
  travelers,
  type DocumentCategory,
  type TripDocument,
} from '../data/documents'
import './DocumentsPage.css'

const categoryIcons: Record<DocumentCategory, LucideIcon> = {
  Voo: Plane,
  Hospedagem: BedDouble,
  Transporte: BusFront,
  Ingresso: Ticket,
  Seguro: ShieldCheck,
  Outro: FileText,
}

export default function DocumentsPage() {
  const reduceMotion = useReducedMotion()
  const fileInput = useRef<HTMLInputElement>(null)
  const [documents, setDocuments] = useState<TripDocument[]>(documentSeed)
  const [category, setCategory] = useState<(typeof documentCategories)[number]>('Todos')
  const [selected, setSelected] = useState<TripDocument | null>(null)

  const visibleDocuments = useMemo(
    () => documents.filter((document) => category === 'Todos' || document.category === category),
    [category, documents],
  )
  const confirmed = documents.filter((document) => document.status === 'Confirmado').length
  const progress = documents.length ? Math.round((confirmed / documents.length) * 100) : 0

  const importFile = (file?: File) => {
    if (!file) return
    const imported: TripDocument = {
      id: `local-${crypto.randomUUID()}`,
      title: file.name.replace(/\.[^.]+$/, '').replaceAll('-', ' '),
      category: 'Outro',
      dateLabel: 'Importado agora · apenas nesta sessão',
      status: 'Rascunho',
      travelerIds: ['kauan'],
      fileName: file.name,
      localFile: file,
      note: 'Ficheiro importado localmente e ainda não sincronizado com a NAS.',
    }
    setDocuments((current) => [imported, ...current])
    setCategory('Todos')
    setSelected(imported)
    if (fileInput.current) fileInput.current.value = ''
  }

  const openFile = (document: TripDocument) => {
    if (!document.localFile) return
    const url = URL.createObjectURL(document.localFile)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <main className="documents-page" id="main-content">
      <SubpageHeader
        kicker="Roma e Veneza"
        title="Documentos"
        actionIcon={Upload}
        actionLabel="Importar documento"
        onAction={() => fileInput.current?.click()}
      />
      <input
        ref={fileInput}
        className="documents-file-input"
        type="file"
        accept="application/pdf,image/*"
        onChange={(event) => importFile(event.target.files?.[0])}
      />

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

      <AnimatePresence>
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

              {selected.localFile ? (
                <button className="document-sheet__primary" type="button" onClick={() => openFile(selected)}>
                  Abrir ficheiro
                </button>
              ) : (
                <p className="document-sheet__notice">Os dados são demonstrativos. O ficheiro real será ligado à NAS na próxima etapa.</p>
              )}
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}
