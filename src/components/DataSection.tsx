import { useState } from 'react'

export default function DataSection({
  onExport,
  onReset,
}: {
  onExport: () => void
  onReset: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <section aria-label="Data" className="data-section">
      <h2>Data</h2>
      {confirming ? (
        <div
          role="alertdialog"
          aria-label="Confirm reset"
          className="confirm-bar"
        >
          <span className="confirm-text">
            Reset everything — all habits, history, and settings? This cannot
            be undone.
          </span>
          <button type="button" onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button
            type="button"
            aria-label="Confirm reset all data"
            onClick={() => {
              setConfirming(false)
              onReset()
            }}
          >
            Reset everything
          </button>
        </div>
      ) : (
        <div className="data-actions">
          <button type="button" onClick={onExport}>
            Export data
          </button>
          <button type="button" onClick={() => setConfirming(true)}>
            Reset all data
          </button>
        </div>
      )}
    </section>
  )
}
