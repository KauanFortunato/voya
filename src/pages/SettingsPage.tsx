import { useEffect, useState, type FormEvent } from 'react'
import { BellRing, CalendarClock, Check, ChevronRight, CircleAlert, Clock3, LoaderCircle, Save, Smartphone, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  getReminderPreferences,
  updateReminderPreferences,
  type ReminderLeadMinutes,
  type ReminderPreferences,
} from '../api/settings'
import SubpageHeader from '../components/SubpageHeader'
import {
  getNotificationPermissionState,
  isIosBrowserWithoutInstalledApp,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '../notifications/permission'
import './SettingsPage.css'

const leadOptions: Array<{ value: ReminderLeadMinutes; label: string; detail: string }> = [
  { value: 15, label: '15 min', detail: 'Para compromissos próximos' },
  { value: 30, label: '30 min', detail: 'Antecedência equilibrada' },
  { value: 60, label: '1 hora', detail: 'Mais tempo para se preparar' },
  { value: 1440, label: '1 dia', detail: 'Aviso no dia anterior' },
]

const permissionContent: Record<NotificationPermissionState, { label: string; detail: string }> = {
  granted: {
    label: 'Permitidas',
    detail: 'Este dispositivo permite mostrar notificações do Voya.',
  },
  prompt: {
    label: 'Por configurar',
    detail: 'A decisão só será pedida quando tocar em ativar.',
  },
  denied: {
    label: 'Bloqueadas',
    detail: 'Permita as notificações nas definições do navegador ou do dispositivo.',
  },
  unsupported: {
    label: 'Indisponíveis',
    detail: 'Este navegador não disponibiliza notificações para o Voya.',
  },
  insecure: {
    label: 'Requer HTTPS',
    detail: 'Abra o Voya através de uma ligação segura para configurar notificações.',
  },
}

function SettingsSkeleton() {
  return (
    <div className="settings-loading" role="status" aria-label="A carregar preferências">
      <span className="settings-loading__intro" />
      <span className="settings-loading__status" />
      <span className="settings-loading__toggle" />
      <span className="settings-loading__label" />
      <span className="settings-loading__options" />
      <span className="settings-loading__button" />
      <span className="settings-loading__personal" />
    </div>
  )
}

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<ReminderPreferences | null>(null)
  const [initialPreferences, setInitialPreferences] = useState<ReminderPreferences | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>(() => getNotificationPermissionState())
  const [permissionRequestState, setPermissionRequestState] = useState<'idle' | 'requesting' | 'error'>('idle')

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

  useEffect(() => {
    const refreshPermission = () => {
      setPermissionState(getNotificationPermissionState())
      setPermissionRequestState('idle')
    }

    window.addEventListener('focus', refreshPermission)
    document.addEventListener('visibilitychange', refreshPermission)
    return () => {
      window.removeEventListener('focus', refreshPermission)
      document.removeEventListener('visibilitychange', refreshPermission)
    }
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

  const enableNotificationsOnDevice = async () => {
    if (!initialPreferences?.enabled || permissionState !== 'prompt' || permissionRequestState === 'requesting') return

    setPermissionRequestState('requesting')
    try {
      setPermissionState(await requestNotificationPermission())
      setPermissionRequestState('idle')
    } catch {
      setPermissionState(getNotificationPermissionState())
      setPermissionRequestState('error')
    }
  }

  const nextReminder = preferences?.schedule.nextScheduledFor
    ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' })
      .format(new Date(preferences.schedule.nextScheduledFor))
    : null

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

          <section className={`settings-status${preferences.enabled ? ' is-active' : ''}`} aria-label="Estado dos lembretes">
            <span className="settings-status__icon"><CalendarClock size={20} aria-hidden="true" /></span>
            <div>
              <strong>{preferences.enabled ? 'Lembretes ativos' : 'Lembretes pausados'}</strong>
              <small>{preferences.enabled
                ? preferences.schedule.scheduledCount
                  ? `${preferences.schedule.scheduledCount} ${preferences.schedule.scheduledCount === 1 ? 'aviso agendado' : 'avisos agendados'}`
                  : 'Nenhum aviso agendado neste momento'
                : 'Nenhum aviso será agendado para este perfil'}</small>
              {preferences.enabled && nextReminder && <span>Próximo: {nextReminder}</span>}
            </div>
            <b>{preferences.enabled ? 'Ativo' : 'Pausado'}</b>
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

          <section className="settings-personal" aria-labelledby="personal-settings-title">
            <div className="settings-section-heading">
              <span>Conta e dispositivo</span>
              <h2 id="personal-settings-title">Preferências pessoais</h2>
            </div>
            <Link to="/more/travelers?from=settings" className="settings-row">
              <span><UserRound size={19} aria-hidden="true" /></span>
              <div><strong>Perfil de viajante</strong><small>Ritmo, interesses, alimentação e acessibilidade</small></div>
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
            <div className={`settings-row settings-row--static settings-device-permission is-${permissionState}`}>
              <span><Smartphone size={19} aria-hidden="true" /></span>
              <div>
                <strong>Notificações neste dispositivo</strong>
                <small>{permissionState === 'unsupported' && isIosBrowserWithoutInstalledApp()
                  ? 'No iPhone ou iPad, adicione o Voya ao ecrã principal e abra-o pelo ícone.'
                  : permissionState === 'prompt' && !initialPreferences?.enabled
                    ? 'Ative e guarde os lembretes antes de configurar este dispositivo.'
                    : permissionContent[permissionState].detail}</small>
                {permissionRequestState === 'error' && <em role="alert">Não foi possível abrir o pedido. Tente novamente.</em>}
              </div>
              <b>{permissionContent[permissionState].label}</b>
              {permissionState === 'prompt' && (
                <button
                  type="button"
                  disabled={!initialPreferences?.enabled || permissionRequestState === 'requesting'}
                  aria-busy={permissionRequestState === 'requesting'}
                  onClick={() => void enableNotificationsOnDevice()}
                >
                  {permissionRequestState === 'requesting' && <LoaderCircle size={15} aria-hidden="true" />}
                  {permissionRequestState === 'requesting' ? 'A aguardar…' : 'Ativar neste dispositivo'}
                </button>
              )}
            </div>
          </section>
        </form>
      )}
    </main>
  )
}
