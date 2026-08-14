import { useEffect, useState, type FormEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check, Gauge, HeartHandshake, Pencil, Save, Utensils, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { listTravelers, updateTravelerProfile, type ApiTraveler, type TravelerInterest } from '../api/travelers'
import ModalPortal from '../components/ModalPortal'
import SubpageHeader from '../components/SubpageHeader'
import { bottomSheetMotion, dialogBackdropMotion } from '../motion/dialogMotion'
import './TravelersPage.css'

const paceLabels = { relaxed: 'Tranquilo', balanced: 'Equilibrado', intense: 'Intenso' } as const
const interestLabels: Record<TravelerInterest, string> = {
  art: 'Arte e museus', history: 'História', food: 'Gastronomia', nature: 'Natureza',
  shopping: 'Compras', photography: 'Fotografia',
}
const interests = Object.keys(interestLabels) as TravelerInterest[]

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('pt-PT')
}

function profileCompletion(traveler: ApiTraveler) {
  const values = [traveler.interests.length > 0, traveler.dietaryNotes, traveler.accessibilityNotes, traveler.emergencyContactName, traveler.notes]
  return Math.round((values.filter(Boolean).length / values.length) * 100)
}

type TravelerEditorProps = {
  traveler: ApiTraveler
  onClose: () => void
  onSaved: (traveler: ApiTraveler) => void
}

function TravelerEditor({ traveler, onClose, onSaved }: TravelerEditorProps) {
  const reduceMotion = useReducedMotion()
  const [draft, setDraft] = useState(traveler)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle')

  const toggleInterest = (interest: TravelerInterest) => {
    setDraft((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }))
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (saveState === 'saving') return
    setSaveState('saving')
    try {
      const result = await updateTravelerProfile(traveler.id, {
        travelPace: draft.travelPace,
        interests: draft.interests,
        dietaryNotes: draft.dietaryNotes.trim(),
        accessibilityNotes: draft.accessibilityNotes.trim(),
        emergencyContactName: draft.emergencyContactName.trim(),
        emergencyContactPhone: draft.emergencyContactPhone.trim(),
        notes: draft.notes.trim(),
      })
      onSaved({ ...draft, ...result.profile })
    } catch {
      setSaveState('error')
    }
  }

  return (
    <div className="traveler-editor-layer" role="presentation">
      <motion.button
        className="traveler-editor-backdrop"
        type="button"
        aria-label="Fechar preferências"
        disabled={saveState === 'saving'}
        onClick={onClose}
        {...dialogBackdropMotion(reduceMotion)}
      />
      <motion.form
        className="traveler-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="traveler-editor-title"
        onSubmit={(event) => void save(event)}
        {...bottomSheetMotion(reduceMotion)}
      >
        <span className="traveler-editor__handle" aria-hidden="true" />
        <div className="traveler-editor__heading">
          <div><span>Preferências de viagem</span><h2 id="traveler-editor-title">{traveler.displayName}</h2></div>
          <button type="button" aria-label="Fechar" disabled={saveState === 'saving'} onClick={onClose}><X size={19} /></button>
        </div>

        <fieldset className="traveler-editor__group" disabled={saveState === 'saving'}>
          <legend>Ritmo preferido</legend>
          <div className="traveler-editor__pace">
            {(Object.entries(paceLabels) as Array<[ApiTraveler['travelPace'], string]>).map(([value, label]) => (
              <button type="button" key={value} className={draft.travelPace === value ? 'is-selected' : ''} aria-pressed={draft.travelPace === value} onClick={() => setDraft((current) => ({ ...current, travelPace: value }))}>
                {label}{draft.travelPace === value && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="traveler-editor__group" disabled={saveState === 'saving'}>
          <legend>Interesses</legend>
          <div className="traveler-editor__interests">
            {interests.map((interest) => (
              <button type="button" key={interest} className={draft.interests.includes(interest) ? 'is-selected' : ''} aria-pressed={draft.interests.includes(interest)} onClick={() => toggleInterest(interest)}>
                {interestLabels[interest]}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="traveler-editor__field"><span>Alimentação</span><textarea rows={2} maxLength={500} value={draft.dietaryNotes} onChange={(event) => setDraft((current) => ({ ...current, dietaryNotes: event.target.value }))} placeholder="Alergias, restrições ou preferências" /></label>
        <label className="traveler-editor__field"><span>Acessibilidade e mobilidade</span><textarea rows={2} maxLength={500} value={draft.accessibilityNotes} onChange={(event) => setDraft((current) => ({ ...current, accessibilityNotes: event.target.value }))} placeholder="Necessidades de mobilidade, pausas ou assistência" /></label>
        <div className="traveler-editor__contact">
          <label className="traveler-editor__field"><span>Contacto de emergência</span><input maxLength={120} value={draft.emergencyContactName} onChange={(event) => setDraft((current) => ({ ...current, emergencyContactName: event.target.value }))} placeholder="Nome" /></label>
          <label className="traveler-editor__field"><span>Telefone</span><input type="tel" maxLength={40} value={draft.emergencyContactPhone} onChange={(event) => setDraft((current) => ({ ...current, emergencyContactPhone: event.target.value }))} placeholder="+351…" /></label>
        </div>
        <label className="traveler-editor__field"><span>Outras notas</span><textarea rows={3} maxLength={1000} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="O que deve ser considerado durante a viagem?" /></label>

        {saveState === 'error' && <p className="traveler-editor__error" role="alert">Não foi possível guardar. As preferências anteriores continuam seguras.</p>}
        <button className="traveler-editor__save" type="submit" disabled={saveState === 'saving'} aria-busy={saveState === 'saving'}>
          <Save size={17} aria-hidden="true" />{saveState === 'saving' ? 'A guardar…' : 'Guardar preferências'}
        </button>
      </motion.form>
    </div>
  )
}

export default function TravelersPage() {
  const [searchParams] = useSearchParams()
  const openedFromSettings = searchParams.get('from') === 'settings'
  const [travelers, setTravelers] = useState<ApiTraveler[]>([])
  const [selected, setSelected] = useState<ApiTraveler | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  const load = async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const payload = await listTravelers(signal)
      setTravelers(payload.travelers)
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os viajantes')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [])

  const saved = (traveler: ApiTraveler) => {
    setTravelers((current) => current.map((item) => item.id === traveler.id ? traveler : item))
    setSelected(null)
    setSavedMessage(`Preferências de ${traveler.displayName} guardadas.`)
  }

  return (
    <main className="travelers-page" id="main-content">
      <SubpageHeader
        kicker="Perfis da viagem"
        title="Viajantes"
        backTo={openedFromSettings ? '/more/settings' : '/more'}
        backLabel={openedFromSettings ? 'Configurações' : 'Mais'}
      />
      <section className="travelers-intro">
        <HeartHandshake size={21} aria-hidden="true" />
        <div><strong>Uma viagem que funciona para todos</strong><span>Ritmo, alimentação e necessidades ficam visíveis para os demais viajantes.</span></div>
      </section>
      {savedMessage && <p className="travelers-feedback" role="status">{savedMessage}<button type="button" onClick={() => setSavedMessage('')}>Fechar</button></p>}
      {loading && !travelers.length && <div className="travelers-loading" role="status" aria-label="A carregar viajantes">{[0, 1, 2, 3].map((item) => <span key={item}><i /><b /><em /></span>)}</div>}
      {error && <div className="travelers-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
      <section className="travelers-list" aria-live="polite">
        {travelers.map((traveler) => {
          const completion = profileCompletion(traveler)
          return (
            <article className="traveler-card" key={traveler.id}>
              <span className="traveler-card__avatar">{initials(traveler.displayName)}</span>
              <div className="traveler-card__heading"><div><h2>{traveler.displayName}</h2><span>{traveler.role === 'organizer' ? 'Organizador' : 'Viajante'}</span></div><strong className={traveler.updatedAt ? 'is-ready' : ''}>{traveler.updatedAt ? `${completion}%` : 'Por preencher'}</strong></div>
              <div className="traveler-card__summary">
                <span><Gauge size={15} aria-hidden="true" />{paceLabels[traveler.travelPace]}</span>
                <span><Utensils size={15} aria-hidden="true" />{traveler.dietaryNotes || 'Sem informação alimentar'}</span>
              </div>
              {traveler.interests.length > 0 && <div className="traveler-card__interests">{traveler.interests.slice(0, 3).map((interest) => <span key={interest}>{interestLabels[interest]}</span>)}</div>}
              {traveler.canEdit && <button className="traveler-card__edit" type="button" onClick={() => { setSavedMessage(''); setSelected(traveler) }}><Pencil size={15} aria-hidden="true" />Editar preferências</button>}
            </article>
          )
        })}
      </section>

      <ModalPortal open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected && <TravelerEditor traveler={selected} onClose={() => setSelected(null)} onSaved={saved} />}
      </ModalPortal>
    </main>
  )
}
