import { useEffect, useState } from 'preact/hooks'
import type { TripData } from '../store.ts'
import { addDays, countdown, daysBetween, formatDay, formatDayLong, nowMs, todayJst } from '../dates.ts'
import { entriesFor, headsUp, itemTitle, stayFor, todosFor } from '../timeline.ts'
import { statusLabel } from '../constants.ts'
import { ItemCard } from '../components/ItemCard.tsx'
import { TodoList } from './Todo.tsx'

export function Today({ trip, date, setDate }: { trip: TripData; date: string; setDate: (d: string) => void }) {
  const now = useNow()
  const today = todayJst()
  const { start, end } = trip.trip
  const dayNo = daysBetween(start, date) + 1
  const total = daysBetween(start, end) + 1
  const entries = entriesFor(trip, date)
  const isToday = date === today
  const nextEntry = isToday ? entries.find((e) => e.at !== undefined && e.at > now) : undefined
  const tonight = stayFor(trip, date)
  const checkinToday = entries.some((e) => e.role === 'checkin')
  const todos = todosFor(trip.todos, date)
  const pre = today < start ? trip.todos.filter((t) => !t.date && !t.done) : []
  const tomorrow = headsUp(trip, date)

  return (
    <div class="view today">
      {today < start && date === start && (
        <div class="hero">
          <div class="hero-big">{daysBetween(today, start)}</div>
          <div>days until {trip.trip.title}</div>
        </div>
      )}
      {today > end && date === end && <div class="banner">The trip is over. おつかれさまでした!</div>}

      <div class="day-nav">
        <button
          type="button"
          class="icon-btn"
          aria-label="Previous day"
          disabled={date <= start}
          onClick={() => setDate(addDays(date, -1))}
        >
          ‹
        </button>
        <div class="day-title">
          <h1>{formatDayLong(date)}</h1>
          <div class="muted">
            {dayNo >= 1 && dayNo <= total ? `Day ${dayNo} of ${total}` : ''}
            {trip.days[date]?.city ? ` · ${trip.days[date].city}` : ''}
          </div>
        </div>
        <button
          type="button"
          class="icon-btn"
          aria-label="Next day"
          disabled={date >= end}
          onClick={() => setDate(addDays(date, 1))}
        >
          ›
        </button>
      </div>
      {!isToday && today >= start && today <= end && (
        <button type="button" class="btn small back-today" onClick={() => setDate(today)}>
          ← Back to today
        </button>
      )}

      {trip.days[date]?.note && <div class="day-note">{trip.days[date].note}</div>}

      {pre.length > 0 && (
        <section>
          <h2>Before you go</h2>
          <TodoList todos={pre} />
        </section>
      )}

      <section>
        {entries.length === 0 && <p class="empty">Nothing scheduled. Enjoy the day.</p>}
        {entries.map((e) => {
          const past = isToday && e.at !== undefined && e.at < now
          return (
            <ItemCard
              key={e.key}
              item={e.item}
              role={e.role}
              time={e.time}
              open={e === nextEntry || (!past && entries.length <= 3)}
              past={past}
              next={e === nextEntry ? countdown(e.at! - now) : undefined}
            />
          )
        })}
      </section>

      {tonight && !checkinToday && (
        <section>
          <h2>Tonight</h2>
          <ItemCard item={tonight} role="event" time="🌙" />
        </section>
      )}

      {todos.length > 0 && (
        <section>
          <h2>To-do</h2>
          <TodoList todos={todos} />
        </section>
      )}

      {tomorrow.length > 0 && date < end && (
        <section class="heads-up">
          <h2>Tomorrow · {formatDay(addDays(date, 1))}</h2>
          <ul>
            {tomorrow.map((e) => (
              <li key={e.key}>
                <span class="time">{e.time ?? '—'}</span> {e.role === 'checkout' ? 'Check-out: ' : ''}
                {itemTitle(e.item)}
                {e.item.status !== 'booked' && <span class={`badge status-${e.item.status}`}>{statusLabel[e.item.status]}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** Re-render every 30 s so countdowns and "past" markers stay current. */
function useNow() {
  const [now, setNow] = useState(nowMs())
  useEffect(() => {
    const t = setInterval(() => setNow(nowMs()), 30_000)
    const onVisible = () => document.visibilityState === 'visible' && setNow(nowMs())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return now
}
