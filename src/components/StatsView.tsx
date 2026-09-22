import type { AggregateStats, HabitStats } from '../domain/stats'
import type { Habit } from '../domain/types'

function percent(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`
}

function dayLabel(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export default function StatsView({
  aggregate,
  entries,
}: {
  aggregate: AggregateStats
  entries: { habit: Habit; stats: HabitStats }[]
}) {
  return (
    <section aria-label="Stats" className="stats-view">
      <article className="stat-card aggregate">
        <h2>Overall</h2>
        <dl>
          <Row label="Last 30 days" value={percent(aggregate.last30.rate)} />
          <Row label="Last 90 days" value={percent(aggregate.last90.rate)} />
          <Row label="Lifetime" value={percent(aggregate.lifetime.rate)} />
        </dl>
      </article>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p>No habits yet — create one in the Today view.</p>
        </div>
      ) : (
        entries.map(({ habit, stats }) => (
          <article key={habit.id} className="stat-card">
            <h3>
              <span aria-hidden="true">{habit.icon}</span> {habit.name}
              {habit.archivedAt && <span className="archived-tag">archived</span>}
            </h3>
            <dl>
              <Row
                label="Current streak"
                value={`🔥 ${dayLabel(stats.currentStreak)}`}
              />
              <Row label="Best streak" value={dayLabel(stats.bestStreak)} />
              <Row label="Last 30 days" value={percent(stats.last30.rate)} />
              <Row label="Last 90 days" value={percent(stats.last90.rate)} />
              <Row label="Lifetime" value={percent(stats.lifetime.rate)} />
            </dl>
          </article>
        ))
      )}
    </section>
  )
}
