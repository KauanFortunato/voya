import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, CircleAlert, ListChecks, Plus, UserRound, UsersRound, X } from 'lucide-react'

import {
  createChecklistItem,
  getChecklist,
  setChecklistItemCompletion,
  type ApiChecklistGroup,
  type ChecklistPayload,
  type ChecklistScope,
} from '../api/checklist'
import ModalPortal from '../components/ModalPortal'
import SubpageHeader from '../components/SubpageHeader'
import './ChecklistPage.css'

const scopes: { value: ChecklistScope; label: string; icon: typeof UsersRound }[] = [
  { value: 'family', label: 'Compartilhado', icon: UsersRound },
  { value: 'personal', label: 'Meu', icon: UserRound },
]

function ChecklistSkeleton() {
  return (
    <div className="checklist-loading" role="status" aria-label="A carregar checklist">
      <span className="checklist-loading__tabs" />
      <span className="checklist-loading__summary" />
      <span className="checklist-loading__group" />
      <span className="checklist-loading__group" />
    </div>
  )
}

type ItemEditorProps = {
  groups: ApiChecklistGroup[]
  initialScope: ChecklistScope
  onClose: () => void
  onCreated: (groupId: string, item: Awaited<ReturnType<typeof createChecklistItem>>['item']) => void
}

function ItemEditor({ groups, initialScope, onClose, onCreated }: ItemEditorProps) {
  const reduceMotion = useReducedMotion()
  const initialGroup = groups.find((group) => group.scope === initialScope) ?? groups[0]
  const [groupId, setGroupId] = useState(initialGroup?.id ?? '')
  const [title, setTitle] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!groupId || !title.trim() || state === 'saving') return
    setState('saving')
    try {
      const { item } = await createChecklistItem(groupId, title.trim())
      onCreated(groupId, item)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="checklist-editor-layer" role="presentation">
      <motion.button
        className="checklist-editor-backdrop"
        type="button"
        aria-label="Fechar novo item"
        disabled={state === 'saving'}
        onClick={onClose}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.15 }}
      />
      <motion.form
        className="checklist-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-editor-title"
        onSubmit={(event) => void submit(event)}
        initial={reduceMotion ? false : { y: 24, opacity: 0, filter: 'blur(2px)' }}
        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
        exit={reduceMotion ? undefined : { y: 10, opacity: 0, filter: 'blur(1px)' }}
        transition={{ type: 'spring', duration: 0.26, bounce: 0 }}
      >
        <span className="checklist-editor__handle" aria-hidden="true" />
        <div className="checklist-editor__heading">
          <div><span>Preparação da viagem</span><h2 id="checklist-editor-title">Adicionar item</h2></div>
          <button type="button" onClick={onClose} disabled={state === 'saving'} aria-label="Fechar"><X size={19} /></button>
        </div>
        <label className="checklist-field"><span>Item</span><input autoFocus required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Separar os passaportes" /></label>
        <label className="checklist-field"><span>Lista</span><select required value={groupId} onChange={(event) => setGroupId(event.target.value)}>{groups.map((group) => <option value={group.id} key={group.id}>{group.scope === 'personal' ? `${group.title} · pessoal` : group.title}</option>)}</select></label>
        {state === 'error' && <p className="checklist-editor__error" role="alert">Não foi possível guardar. Tente novamente.</p>}
        <button className="checklist-editor__save" type="submit" disabled={state === 'saving' || !title.trim()} aria-busy={state === 'saving'}><Plus size={17} />{state === 'saving' ? 'A guardar…' : 'Adicionar à checklist'}</button>
      </motion.form>
    </div>
  )
}

export default function ChecklistPage() {
  const reduceMotion = useReducedMotion()
  const [scope, setScope] = useState<ChecklistScope>('family')
  const [checklist, setChecklist] = useState<ChecklistPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [savingIds, setSavingIds] = useState<string[]>([])
  const [editorOpen, setEditorOpen] = useState(false)

  const load = async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try { setChecklist(await getChecklist(signal)) }
    catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a checklist')
    } finally { if (!signal?.aborted) setLoading(false) }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [])

  const visibleGroups = checklist?.groups.filter((group) => group.scope === scope) ?? []
  const visibleItems = visibleGroups.flatMap((group) => group.items)
  const completedCount = visibleItems.filter((item) => item.completed).length
  const progress = visibleItems.length ? Math.round((completedCount / visibleItems.length) * 100) : 0
  const allowedGroups = checklist?.groups.filter((group) => group.canAddItems) ?? []

  const overallLabel = useMemo(
    () => `${completedCount} de ${visibleItems.length} itens concluídos`,
    [completedCount, visibleItems.length],
  )

  const toggleItem = async (groupId: string, itemId: string, completed: boolean) => {
    if (!checklist || savingIds.includes(itemId)) return
    const nextCompleted = !completed
    setActionError('')
    setSavingIds((current) => [...current, itemId])
    setChecklist((current) => current ? {
      ...current,
      groups: current.groups.map((group) => group.id === groupId ? {
        ...group,
        items: group.items.map((item) => item.id === itemId ? { ...item, completed: nextCompleted } : item),
      } : group),
    } : current)
    try {
      const result = await setChecklistItemCompletion(itemId, nextCompleted)
      setChecklist((current) => current ? {
        ...current,
        groups: current.groups.map((group) => group.id === groupId ? {
          ...group,
          items: group.items.map((item) => item.id === itemId ? { ...item, ...result } : item),
        } : group),
      } : current)
    } catch (reason) {
      setChecklist((current) => current ? {
        ...current,
        groups: current.groups.map((group) => group.id === groupId ? {
          ...group,
          items: group.items.map((item) => item.id === itemId ? { ...item, completed } : item),
        } : group),
      } : current)
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o item')
    } finally {
      setSavingIds((current) => current.filter((id) => id !== itemId))
    }
  }

  const addCreatedItem = (groupId: string, item: Awaited<ReturnType<typeof createChecklistItem>>['item']) => {
    setChecklist((current) => current ? {
      ...current,
      groups: current.groups.map((group) => group.id === groupId ? { ...group, items: [...group.items, item] } : group),
    } : current)
    const targetScope = checklist?.groups.find((group) => group.id === groupId)?.scope
    if (targetScope) setScope(targetScope)
    setEditorOpen(false)
  }

  return (
    <main className="checklist-page" id="main-content" aria-busy={loading}>
      <SubpageHeader
        kicker={checklist?.trip.title ?? 'Viagem atual'}
        title="Checklist"
        actionIcon={allowedGroups.length ? Plus : undefined}
        actionLabel={allowedGroups.length ? 'Adicionar item' : undefined}
        onAction={() => setEditorOpen(true)}
      />

      {loading && !checklist && <ChecklistSkeleton />}
      {error && !checklist && <section className="checklist-error" role="alert"><CircleAlert size={23} /><strong>Não foi possível abrir a checklist</strong><span>{error}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></section>}

      {checklist && <>
        <div className="checklist-scope" role="tablist" aria-label="Tipo de checklist">
          {scopes.map(({ value, label, icon: Icon }) => (
            <button className={scope === value ? 'is-active' : ''} type="button" role="tab" aria-selected={scope === value} key={value} onClick={() => setScope(value)}><Icon size={16} aria-hidden="true" />{label}</button>
          ))}
        </div>

        {actionError && <p className="checklist-action-error" role="alert">{actionError}<button type="button" onClick={() => setActionError('')}>Fechar</button></p>}

        <section className="checklist-summary" aria-label={overallLabel}>
          <div className="checklist-summary__heading"><div><strong>{scope === 'family' ? 'Preparação compartilhada' : 'Preparação pessoal'}</strong><span>{overallLabel}</span></div><b>{progress}%</b></div>
          <span className="checklist-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ transform: `scaleX(${progress / 100})` }} /></span>
        </section>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div className="checklist-groups" key={scope} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -3 }} transition={{ type: 'spring', duration: 0.2, bounce: 0 }}>
            {visibleGroups.length ? visibleGroups.map((group) => {
              const groupCompleted = group.items.filter((item) => item.completed).length
              return (
                <section className="checklist-group" key={group.id} aria-labelledby={`group-${group.id}`}>
                  <div className="checklist-group__heading"><div><h2 id={`group-${group.id}`}>{group.title}</h2>{group.ownerName && <span>Lista pessoal de {group.ownerName}</span>}</div><b>{groupCompleted}/{group.items.length}</b></div>
                  <div className="checklist-items">
                    {group.items.length ? group.items.map((item) => {
                      const saving = savingIds.includes(item.id)
                      return <button className={`checklist-item${item.completed ? ' is-completed' : ''}`} type="button" aria-pressed={item.completed} aria-busy={saving} disabled={saving} key={item.id} onClick={() => void toggleItem(group.id, item.id, item.completed)}><span className="checklist-checkbox"><AnimatePresence initial={false}>{item.completed && <motion.span initial={reduceMotion ? false : { opacity: 0, scale: 0.9, filter: 'blur(2px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={reduceMotion ? undefined : { opacity: 0, scale: 0.94, filter: 'blur(1px)' }} transition={{ type: 'spring', duration: 0.16, bounce: 0 }}><Check size={15} strokeWidth={3} aria-hidden="true" /></motion.span>}</AnimatePresence></span><span>{item.title}</span></button>
                    }) : <p className="checklist-group__empty">Nenhum item nesta lista.</p>}
                  </div>
                </section>
              )
            }) : <section className="checklist-empty"><ListChecks size={25} /><strong>Nenhuma lista {scope === 'family' ? 'compartilhada' : 'pessoal'}</strong><span>Quando uma lista for criada, ela aparecerá aqui.</span></section>}
          </motion.div>
        </AnimatePresence>
      </>}

      <ModalPortal open={editorOpen && allowedGroups.length > 0} onClose={() => setEditorOpen(false)}>{allowedGroups.length > 0 && <ItemEditor groups={allowedGroups} initialScope={scope} onClose={() => setEditorOpen(false)} onCreated={addCreatedItem} />}</ModalPortal>
    </main>
  )
}
