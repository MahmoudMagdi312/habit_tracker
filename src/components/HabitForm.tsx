import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CreateHabitInput } from '../domain/types'

const ICONS = ['🎯', '💧', '📖', '🏃', '🧘', '💤']
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7']

export default function HabitForm({
  onSubmit,
  initialValues,
  submitLabel = 'Create habit',
  ariaLabel = 'Create habit',
  onCancel,
}: {
  onSubmit: (input: CreateHabitInput) => void
  initialValues?: Partial<CreateHabitInput>
  submitLabel?: string
  ariaLabel?: string
  onCancel?: () => void
}) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  )
  const [icon, setIcon] = useState(initialValues?.icon ?? ICONS[0])
  const [color, setColor] = useState(initialValues?.color ?? COLORS[0])
  const [reminderTime, setReminderTime] = useState(
    initialValues?.reminderTime ?? '',
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    onSubmit({ name, description, icon, color, reminderTime })
  }

  return (
    <form onSubmit={handleSubmit} aria-label={ariaLabel} className="habit-form">
      <div className="field">
        <label htmlFor="habit-name">Name</label>
        <input
          id="habit-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Drink water"
          required
          autoFocus
        />
      </div>

      <div className="field">
        <label htmlFor="habit-description">Description (optional)</label>
        <input
          id="habit-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="e.g. One glass after waking up"
        />
      </div>

      <div className="field">
        <label htmlFor="habit-reminder">Reminder time (optional)</label>
        <input
          id="habit-reminder"
          type="time"
          value={reminderTime}
          onChange={(event) => setReminderTime(event.target.value)}
        />
      </div>

      <fieldset className="field">
        <legend>Icon</legend>
        <div className="choices">
          {ICONS.map((option) => (
            <label key={option} className="choice">
              <input
                type="radio"
                name="habit-icon"
                value={option}
                checked={icon === option}
                onChange={() => setIcon(option)}
                aria-label={`icon ${option}`}
              />
              <span aria-hidden="true">{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Color</legend>
        <div className="choices">
          {COLORS.map((option) => (
            <label key={option} className="choice">
              <input
                type="radio"
                name="habit-color"
                value={option}
                checked={color === option}
                onChange={() => setColor(option)}
                aria-label={`color ${option}`}
              />
              <span
                className="swatch"
                style={{ backgroundColor: option }}
                aria-hidden="true"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
