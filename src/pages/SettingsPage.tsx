import { useEffect, useState, type FormEvent } from 'react'
import { BellRing, Check, CircleAlert, Clock3, Save } from 'lucide-react'

import {
  getReminderPreferences,
  updateReminderPreferences,
  type ReminderLeadMinutes,
  type ReminderPreferences,
} from '../api/settings'
import SubpageHeader from '../components/SubpageHeader'
import './SettingsPage.css'

const leadOptions: Array<{ value: ReminderLeadMinutes; label: string; detail: string }> = [
  { value: 15, label: '15 min', detail: 'Para compromissos próximos' },
  { value: 30, label: '30 min', detail: 'Antecedência equilibrada' },
  { value: 60, label: '1 hora', detail: 'Mais tempo para se preparar' },
  { value: 1440, label: '1 dia', detail: 'Aviso no dia anterior' },
]

function SettingsSkeleton() {
  return (
    <div className="settings-loading" role="status" aria-label="A carregar preferências">
      <span className="settings-loading__intro" />
      <span className="settings-loading__toggle" />
      <span className="settings-loading__label" />
      <span className="settings-loading__options" />
      <span className="settings-loading__button" />
    </div>
  )
}

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<ReminderPreferences | null>(null)
  const [initialPreferences, setInitialPreferences] = useState<ReminderPreferences | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading')
  const [message, setMessage] = useState('')

  const load = async (signal?: AbortSignal) => {
    setState('loading')
    setMessage('')
    try {
      const result = await getReminderPreferences(signal)
      setPreferences(result)
      setInitialPreferences(result)
      setState('ready')
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível carregar as preferências')
      setState('error')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [])

  const changed = Boolean(preferences && initialPreferences && (
    preferences.enabled !== initialPreferences.enabled
    || preferences.defaultLeadMinutes !== initialPreferences.defaultLeadMinutes
  ))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!preferences || state === 'saving' || !changed) return
    setState('saving')
    setMessage('')
    try {
      const saved = await updateReminderPreferences(preferences)
      setPreferences(saved)
      setInitialPreferences(saved)
      setState('saved')
      setMessage('Preferências guardadas neste perfil.')
    } catch (reason) {
      setState('error')
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível guardar as preferências')
    }
  }

  return (
    <main className="settings-page" id="main-content" aria-busy={state === 'loading' || state === 'saving'}>
      <SubpageHeader kicker="Preferências pessoais" title="Configurações" />

      {state === 'loading' && !preferences && <SettingsSkeleton />}
      {state === 'error' && !preferences && (
        <section className="settings-error" role="alert">
          <CircleAlert size={22} aria-hidden="true" />
          <strong>Não foi possível abrir as configurações</strong>
          <span>{message}</span>
          <button type="button" onClick={() => void load()}>Tentar novamente</button>
        </section>
      )}

      {preferences && (
        <form className="settings-form" onSubmit={(event) => void submit(event)}>
          <section className="settings-intro" aria-labelledby="reminder-settings-title">
            <span><BellRing size={21} aria-hidden="true" /></span>
            <div>
              <h2 id="reminder-settings-title">Lembretes da viagem</h2>
              <p>Defina como as atividades importantes devem considerar o seu perfil.</p>
            </div>
          </section>

          <button
            className={`settings-toggle${preferences.enabled ? ' is-enabled' : ''}`}
            type="button"
            role="switch"
            aria-checked={preferences.enabled}
            disabled={state === 'saving'}
            onClick={() => {
              setPreferences((current) => current ? { ...current, enabled: !current.enabled } : current)
              setState('ready')
              setMessage('')
            }}
          >
            <span><strong>Usar lembretes</strong><small>{preferences.enabled ? 'Ativado para este perfil' : 'Desativado para este perfil'}</small></span>
            <i aria-hidden="true"><b /></i>
          </button>

          <fieldset className="settings-lead" disabled={state === 'saving'}>
            <legend><Clock3 size={17} aria-hidden="true" />Antecedência padrão</legend>
            <p>Esta opção será usada quando uma atividade importante não tiver um horário de aviso próprio.</p>
            <div>
              {leadOptions.map((option) => (
                <label className={preferences.defaultLeadMinutes === option.value ? 'is-selected' : ''} key={option.value}>
                  <input
                    type="radio"
                    name="default-reminder-lead"
                    value={option.value}
                    checked={preferences.defaultLeadMinutes === option.value}
                    onChange={() => {
                      setPreferences((current) => current ? { ...current, defaultLeadMinutes: option.value } : current)
                      setState('ready')
                      setMessage('')
                    }}
                  />
                  <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                  <Check size={16} aria-hidden="true" />
                </label>
              ))}
            </div>
          </fieldset>

          {message && (
            <p className={`settings-feedback${state === 'error' ? ' is-error' : ''}`} role={state === 'error' ? 'alert' : 'status'}>
              {state === 'error' ? <CircleAlert size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              {message}
            </p>
          )}

          <button className="settings-save" type="submit" disabled={!changed || state === 'saving'} aria-busy={state === 'saving'}>
            <Save size={17} aria-hidden="true" />
            {state === 'saving' ? 'A guardar…' : 'Guardar preferências'}
          </button>
        </form>
      )}
    </main>
  )
}
