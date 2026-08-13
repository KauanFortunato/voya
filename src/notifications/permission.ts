export type NotificationPermissionState =
  | 'granted'
  | 'prompt'
  | 'denied'
  | 'unsupported'
  | 'insecure'

export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === 'undefined') return 'unsupported'
  if (!window.isSecureContext) return 'insecure'
  if (!('Notification' in window)) return 'unsupported'

  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return 'prompt'
}

export function isIosBrowserWithoutInstalledApp() {
  if (typeof window === 'undefined') return false

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  const isIos = /iPad|iPhone|iPod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || navigatorWithStandalone.standalone === true

  return isIos && !isStandalone
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  const currentState = getNotificationPermissionState()
  if (currentState !== 'prompt') return currentState

  const permission = await Notification.requestPermission()
  if (permission === 'granted') return 'granted'
  if (permission === 'denied') return 'denied'
  return 'prompt'
}
