import { useState } from 'react'
import {
  getNotificationPermission,
  requestNotificationPermission,
} from '../reminders/notifications'
import type { PermissionState } from '../reminders/notifications'

export default function RemindersBar({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}) {
  const [permission, setPermission] = useState<PermissionState>(
    getNotificationPermission,
  )

  async function enable() {
    setPermission(await requestNotificationPermission())
  }

  return (
    <div role="group" aria-label="Reminders" className="reminders-bar">
      <label className="toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span>Reminders</span>
      </label>

      {permission === 'default' && (
        <button type="button" onClick={enable}>
          Enable browser notifications
        </button>
      )}
      {permission === 'granted' && (
        <span className="perm ok">Notifications allowed</span>
      )}
      {permission === 'denied' && (
        <p className="perm warn">
          Notifications are blocked. Allow them in your browser&rsquo;s site
          settings for this page to get reminders.
        </p>
      )}
      {permission === 'unsupported' && (
        <p className="perm warn">
          This browser doesn&rsquo;t support notifications, so reminders can
          only be checked while this tab is open.
        </p>
      )}
    </div>
  )
}
