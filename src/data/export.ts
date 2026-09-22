import type { HabitStore } from '../store/habitStore'

/** Serializes the store's export payload as pretty-printed JSON. */
export function exportJson(store: HabitStore): string {
  return JSON.stringify(store.exportData(), null, 2)
}

/** Triggers a browser download of the full payload as a single JSON file. */
export function downloadExport(store: HabitStore): void {
  const blob = new Blob([exportJson(store)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `habit-tracker-${store.getToday()}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
