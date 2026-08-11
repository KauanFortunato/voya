import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Plus, UserRound, UsersRound } from 'lucide-react'

import SubpageHeader from '../components/SubpageHeader'
import {
  checklistGroups as checklistSeed,
  type ChecklistGroup,
  type ChecklistScope,
} from '../data/checklist'
import './ChecklistPage.css'

const scopes: { value: ChecklistScope; label: string; icon: typeof UsersRound }[] = [
  { value: 'family', label: 'Compartilhado', icon: UsersRound },
  { value: 'personal', label: 'Meu', icon: UserRound },
]

export default function ChecklistPage() {
  const reduceMotion = useReducedMotion()
  const [scope, setScope] = useState<ChecklistScope>('family')
  const [groups, setGroups] = useState<ChecklistGroup[]>(checklistSeed)

  const visibleGroups = groups.filter((group) => group.scope === scope)
  const visibleItems = visibleGroups.flatMap((group) => group.items)
  const completedCount = visibleItems.filter((item) => item.completed).length
  const progress = visibleItems.length ? Math.round((completedCount / visibleItems.length) * 100) : 0

  const overallLabel = useMemo(
    () => `${completedCount} de ${visibleItems.length} itens concluídos`,
    [completedCount, visibleItems.length],
  )

  const toggleItem = (groupId: string, itemId: string) => {
    setGroups((current) =>
      current.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              items: group.items.map((item) =>
                item.id === itemId ? { ...item, completed: !item.completed } : item,
              ),
            },
      ),
    )
  }

  return (
    <main className="checklist-page" id="main-content">
      <SubpageHeader
        kicker="Roma e Veneza"
        title="Checklist"
        actionIcon={Plus}
        actionLabel="Adicionar item"
      />

      <div className="checklist-scope" role="tablist" aria-label="Tipo de checklist">
        {scopes.map(({ value, label, icon: Icon }) => (
          <button
            className={scope === value ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={scope === value}
            key={value}
            onClick={() => setScope(value)}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <section className="checklist-summary" aria-label={overallLabel}>
        <div className="checklist-summary__heading">
          <div>
            <strong>{scope === 'family' ? 'Preparação compartilhada' : 'Preparação pessoal'}</strong>
            <span>{overallLabel}</span>
          </div>
          <b>{progress}%</b>
        </div>
        <span
          className="checklist-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <i style={{ transform: `scaleX(${progress / 100})` }} />
        </span>
      </section>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          className="checklist-groups"
          key={scope}
          initial={reduceMotion ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
          transition={{ type: 'spring', duration: 0.2, bounce: 0 }}
        >
          {visibleGroups.map((group) => {
            const groupCompleted = group.items.filter((item) => item.completed).length
            return (
              <section className="checklist-group" key={group.id} aria-labelledby={`group-${group.id}`}>
                <div className="checklist-group__heading">
                  <div>
                    <h2 id={`group-${group.id}`}>{group.title}</h2>
                    {group.ownerName && <span>Lista pessoal de {group.ownerName}</span>}
                  </div>
                  <b>{groupCompleted}/{group.items.length}</b>
                </div>
                <div className="checklist-items">
                  {group.items.map((item) => (
                    <button
                      className={`checklist-item${item.completed ? ' is-completed' : ''}`}
                      type="button"
                      aria-pressed={item.completed}
                      key={item.id}
                      onClick={() => toggleItem(group.id, item.id)}
                    >
                      <span className="checklist-checkbox">
                        <AnimatePresence initial={false}>
                          {item.completed && (
                            <motion.span
                              initial={reduceMotion ? false : { opacity: 0, scale: 0.9, filter: 'blur(2px)' }}
                              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.94, filter: 'blur(1px)' }}
                              transition={{ type: 'spring', duration: 0.16, bounce: 0 }}
                            >
                              <Check size={15} strokeWidth={3} aria-hidden="true" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
