import { getJsonWithOfflineFallback } from '../offline/data'

export type BudgetTraveler = { id: string; displayName: string }

export type ApiExpense = {
  id: string
  title: string
  category: string
  amount: number
  currency: string
  spentAt: string
  createdAt: string
  paidBy: string
  paidByName: string
  splits: Array<{ userId: string; amount: number }>
  canDelete: boolean
}

export type BudgetPayload = {
  trip: { id: string; title: string; budgetAmount: number; currency: string }
  travelers: BudgetTraveler[]
  expenses: ApiExpense[]
  canEditBudget: boolean
}

export type ExpenseInput = {
  title: string
  category: string
  amount: number
  paidBy: string
  travelerIds: string[]
  spentAt: string
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? 'Não foi possível concluir o pedido'
}

export async function getBudget(signal?: AbortSignal) {
  return getJsonWithOfflineFallback<BudgetPayload>('budget', '/api/budget', {
    signal,
    errorMessage: 'Não foi possível carregar o orçamento',
  })
}

export async function updateBudget(amount: number) {
  const response = await fetch('/api/budget', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{ budgetAmount: number }>
}

export async function createExpense(expense: ExpenseInput) {
  const response = await fetch('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expense),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{ id: string }>
}

export async function deleteExpense(expenseId: string) {
  const response = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await readError(response))
}
