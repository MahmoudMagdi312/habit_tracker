import type { NotificationSender } from './scheduler'

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

export function getNotificationPermission(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.requestPermission()
}

/** Sends through the browser Notification API, only when permission is granted. */
export function createBrowserNotificationSender(): NotificationSender {
  return {
    send(title, options) {
      if (typeof Notification === 'undefined') return
      if (Notification.permission !== 'granted') return
      new Notification(title, options)
    },
  }
}
