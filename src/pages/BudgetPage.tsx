import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, ReceiptText, Trash2, WalletCards, X } from 'lucide-react'

import { createExpense, deleteExpense, getBudget, updateBudget, type ApiExpense, type BudgetPayload } from '../api/budget'
import ModalPortal from '../components/ModalPortal'
import SubpageHeader from '../components/SubpageHeader'
import './BudgetPage.css'

const categories = ['Hospedagem', 'Alimentação', 'Transporte', 'Ingressos', 'Compras', 'Outro']
const money = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const date = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short' })

type ExpenseEditorProps = {
  budget: BudgetPayload
  onClose: () => void
  onCreated: () => void
}

function ExpenseEditor({ budget, onClose, onCreated }: ExpenseEditorProps) {
  const reduceMotion = useReducedMotion()
  const today = new Date().toISOString().slice(0, 10)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(categories[1])
  const [paidBy, setPaidBy] = useState(budget.travelers[0]?.id ?? '')
  const [travelerIds, setTravelerIds] = useState(() => budget.travelers.map(({ id }) => id))
  const [spentAt, setSpentAt] = useState(today)
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')

  const toggleTraveler = (travelerId: string) => {
    setTravelerIds((current) => current.includes(travelerId)
      ? current.filter((id) => id !== travelerId)
      : [...current, travelerId])
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const parsedAmount = Number(amount.replace(',', '.'))
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !travelerIds.length) {
      setState('error')
      return
    }
    setState('saving')
    try {
      await createExpense({ title: title.trim(), category, amount: parsedAmount, paidBy, travelerIds, spentAt })
      onCreated()
    } catch {
      setState('error')
    }
  }

  return (
    <div className="expense-editor-layer" role="presentation">
      <motion.button className="expense-editor-backdrop" type="button" aria-label="Fechar nova despesa" onClick={onClose} disabled={state === 'saving'} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={{ duration: 0.16 }} />
      <motion.form className="expense-editor" role="dialog" aria-modal="true" aria-labelledby="expense-editor-title" onSubmit={(event) => void submit(event)} initial={reduceMotion ? false : { y: '100%', opacity: 0.92 }} animate={{ y: 0, opacity: 1 }} exit={reduceMotion ? undefined : { y: 18, opacity: 0 }} transition={{ type: 'spring', duration: 0.34, bounce: 0 }}>
        <span className="expense-editor__handle" aria-hidden="true" />
        <div className="expense-editor__heading"><div><span>Novo lançamento</span><h2 id="expense-editor-title">Adicionar despesa</h2></div><button type="button" onClick={onClose} disabled={state === 'saving'} aria-label="Fechar"><X size={19} /></button></div>
        <label className="expense-field"><span>Descrição</span><input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Bilhetes do museu" /></label>
        <div className="expense-editor__row">
          <label className="expense-field"><span>Valor</span><div className="expense-money-input"><b>€</b><input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></div></label>
          <label className="expense-field"><span>Data</span><input required type="date" value={spentAt} onChange={(event) => setSpentAt(event.target.value)} /></label>
        </div>
        <label className="expense-field"><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="expense-field"><span>Quem pagou</span><select value={paidBy} onChange={(event) => setPaidBy(event.target.value)}>{budget.travelers.map((traveler) => <option value={traveler.id} key={traveler.id}>{traveler.displayName}</option>)}</select></label>
        <fieldset className="expense-split" disabled={state === 'saving'}><legend>Dividir entre</legend><div>{budget.travelers.map((traveler) => <label key={traveler.id} className={travelerIds.includes(traveler.id) ? 'is-selected' : ''}><input type="checkbox" checked={travelerIds.includes(traveler.id)} onChange={() => toggleTraveler(traveler.id)} /><span>{traveler.displayName}</span></label>)}</div><small>{travelerIds.length ? `${money.format((Number(amount.replace(',', '.')) || 0) / travelerIds.length)} por pessoa` : 'Escolha pelo menos uma pessoa'}</small></fieldset>
        {state === 'error' && <p className="expense-editor__error" role="alert">Confira os dados e tente novamente.</p>}
        <button className="expense-editor__save" type="submit" disabled={state === 'saving'} aria-busy={state === 'saving'}><ReceiptText size={17} />{state === 'saving' ? 'A guardar…' : 'Guardar despesa'}</button>
      </motion.form>
    </div>
  )
}

function ExpenseRow({ expense, onDelete }: { expense: ApiExpense; onDelete: (expense: ApiExpense) => void }) {
  return (
    <article className="expense-row">
      <span className="expense-row__icon"><ReceiptText size={18} /></span>
      <div className="expense-row__main"><strong>{expense.title}</strong><span>{expense.paidByName} pagou · {date.format(new Date(expense.spentAt))}</span></div>
      <div className="expense-row__amount"><strong>{money.format(expense.amount)}</strong><span>{expense.category}</span></div>
      {expense.canDelete && <button type="button" aria-label={`Apagar ${expense.title}`} onClick={() => onDelete(expense)}><Trash2 size={16} /></button>}
    </article>
  )
}

export default function BudgetPage() {
  const [budget, setBudget] = useState<BudgetPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [budgetEditing, setBudgetEditing] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)
  const [feedback, setFeedback] = useState('')

  const load = async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try { setBudget(await getBudget(signal)) }
    catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o orçamento')
    } finally { if (!signal?.aborted) setLoading(false) }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [])

  const totals = useMemo(() => {
    if (!budget) return { spent: 0, remaining: 0, progress: 0, balances: [] }
    const spent = budget.expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const balances = budget.travelers.map((traveler) => {
      const paid = budget.expenses.filter((expense) => expense.paidBy === traveler.id).reduce((sum, expense) => sum + expense.amount, 0)
      const owes = budget.expenses.flatMap((expense) => expense.splits).filter((split) => split.userId === traveler.id).reduce((sum, split) => sum + split.amount, 0)
      return { ...traveler, balance: paid - owes }
    })
    return { spent, remaining: budget.trip.budgetAmount - spent, progress: budget.trip.budgetAmount ? Math.min(100, spent / budget.trip.budgetAmount * 100) : 0, balances }
  }, [budget])

  const saveBudget = async (event: FormEvent) => {
    event.preventDefault()
    const amount = Number(budgetDraft.replace(',', '.'))
    if (!budget || !Number.isFinite(amount) || amount < 0) return
    setSavingBudget(true)
    try {
      const result = await updateBudget(amount)
      setBudget({ ...budget, trip: { ...budget.trip, budgetAmount: result.budgetAmount } })
      setBudgetEditing(false)
      setFeedback('Orçamento atualizado.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar') }
    finally { setSavingBudget(false) }
  }

  const remove = async (expense: ApiExpense) => {
    if (!window.confirm(`Apagar a despesa “${expense.title}”? Esta ação não pode ser desfeita.`)) return
    try {
      await deleteExpense(expense.id)
      setBudget((current) => current ? { ...current, expenses: current.expenses.filter(({ id }) => id !== expense.id) } : current)
      setFeedback('Despesa apagada.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível apagar') }
  }

  return (
    <main className="budget-page" id="main-content">
      <SubpageHeader kicker={budget?.trip.title ?? 'Viagem atual'} title="Orçamento" actionIcon={Plus} actionLabel="Adicionar despesa" onAction={() => setEditorOpen(true)} />
      {feedback && <p className="budget-feedback" role="status">{feedback}<button type="button" onClick={() => setFeedback('')}>Fechar</button></p>}
      {loading && !budget && <div className="budget-loading" role="status" aria-label="A carregar orçamento"><span /><span /><span /></div>}
      {error && <div className="budget-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
      {budget && <>
        <section className="budget-hero">
          <div className="budget-hero__top"><span><WalletCards size={18} />Orçamento da viagem</span>{budget.canEditBudget && <button type="button" onClick={() => { setBudgetDraft(String(budget.trip.budgetAmount)); setBudgetEditing(true) }}><Pencil size={15} />Editar</button>}</div>
          {budgetEditing ? <form className="budget-inline-form" onSubmit={(event) => void saveBudget(event)}><label><span>€</span><input autoFocus inputMode="decimal" value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} /></label><button type="submit" disabled={savingBudget}>{savingBudget ? 'A guardar…' : 'Guardar'}</button><button type="button" onClick={() => setBudgetEditing(false)}>Cancelar</button></form> : <strong className="budget-hero__value">{money.format(budget.trip.budgetAmount)}</strong>}
          <div className="budget-progress"><i style={{ transform: `scaleX(${totals.progress / 100})` }} /></div>
          <div className="budget-hero__totals"><span><small>Gasto</small><b>{money.format(totals.spent)}</b></span><span><small>{totals.remaining >= 0 ? 'Disponível' : 'Acima do orçamento'}</small><b className={totals.remaining < 0 ? 'is-negative' : ''}>{money.format(Math.abs(totals.remaining))}</b></span></div>
        </section>
        <section className="budget-balances"><div className="budget-section-title"><div><span>Acertos entre viajantes</span><h2>Quem tem a receber</h2></div></div><div>{totals.balances.map((traveler) => <article key={traveler.id}><span className="budget-avatar">{traveler.displayName.slice(0, 2).toUpperCase()}</span><strong>{traveler.displayName}</strong><span className={traveler.balance >= 0 ? 'is-positive' : 'is-negative'}>{traveler.balance >= 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{traveler.balance === 0 ? 'acertado' : `${traveler.balance > 0 ? 'recebe' : 'deve'} ${money.format(Math.abs(traveler.balance))}`}</span></article>)}</div></section>
        <section className="budget-expenses"><div className="budget-section-title"><div><span>Histórico</span><h2>Despesas</h2></div><b>{budget.expenses.length}</b></div>{budget.expenses.length ? <div>{budget.expenses.map((expense) => <ExpenseRow expense={expense} onDelete={(item) => void remove(item)} key={expense.id} />)}</div> : <div className="budget-empty"><ReceiptText size={24} /><strong>Nenhuma despesa ainda</strong><span>Registre o primeiro pagamento da viagem.</span><button type="button" onClick={() => setEditorOpen(true)}><Plus size={16} />Adicionar despesa</button></div>}</section>
      </>}
      <ModalPortal open={editorOpen && Boolean(budget)} onClose={() => setEditorOpen(false)}>{budget && <ExpenseEditor budget={budget} onClose={() => setEditorOpen(false)} onCreated={() => { setEditorOpen(false); setFeedback('Despesa adicionada e dividida.'); void load() }} />}</ModalPortal>
    </main>
  )
}
