import { useEffect, useState } from 'preact/hooks'
import type { Item } from '../schema.ts'
import type { TripData } from '../store.ts'
import { dateRange, daysBetween, formatChip, formatDay, formatWeekday, todayJst } from '../dates.ts'
import { entriesFor, isTransport, stayFor, type Entry } from '../timeline.ts'
import { ItemCard } from '../components/ItemCard.tsx'
import { EditSheet, newItem } from '../components/EditSheet.tsx'

const filters: [string, (e: Entry) => boolean][] = [
  ['All', () => true],
  ['Transport', (e) => isTransport(e.item)],
  ['Tickets', (e) => e.item.type === 'activity'],
  ['Stays', (e) => e.item.type === 'stay'],
  ['Not booked', (e) => e.item.status !== 'booked'],
]

const addTypes: [Item['type'], string][] = [
  ['train', '🚄 Train'],
  ['bus', '🚌 Bus'],
  ['flight', '✈️ Flight'],
  ['activity', '🎟️ Ticket / activity'],
  ['stay', '🏨 Stay'],
]

export function Trip({ trip, onPickDay }: { trip: TripData; onPickDay: (d: string) => void }) {
  const [filter, setFilter] = useState(0)
  const [adding, setAdding] = useState<Item>()
  const [chooser, setChooser] = useState(false)
  const days = dateRange(trip.trip.start, trip.trip.end)
  const today = todayJst()

  useEffect(() => {
    if (today >= trip.trip.start && today <= trip.trip.end)
      document.getElementById(`day-${today}`)?.scrollIntoView({ block: 'start' })
  }, [])

  const jump = (d: string) => document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div class="view trip">
      <div class="trip-top">
        <div class="chips scroll">
          {days.map((d) => (
            <button type="button" key={d} class={`chip day-chip${d === today ? ' is-today' : ''}`} onClick={() => jump(d)}>
              <small>{formatWeekday(d)}</small>
              {formatChip(d)}
            </button>
          ))}
        </div>
        <div class="chips scroll">
          {filters.map(([label], i) => (
            <button type="button" key={label} class={`chip${filter === i ? ' active' : ''}`} onClick={() => setFilter(i)}>
              {label}
            </button>
          ))}
          <button type="button" class="chip add" onClick={() => setChooser(!chooser)}>
            + Add
          </button>
        </div>
        {chooser && (
          <div class="chips">
            {addTypes.map(([type, label]) => (
              <button
                type="button"
                key={type}
                class="chip"
                onClick={() => {
                  setChooser(false)
                  setAdding(newItem(type, today >= trip.trip.start && today <= trip.trip.end ? today : trip.trip.start))
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {days.map((d) => {
        const entries = entriesFor(trip, d).filter(filters[filter][1])
        const stay = stayFor(trip, d)
        const city = trip.days[d]?.city
        return (
          <section key={d} id={`day-${d}`} class="trip-day">
            <h2 class={`day-head${d === today ? ' is-today' : ''}`} onClick={() => onPickDay(d)}>
              <span>
                {formatDay(d)}
                {city && <span class="muted"> · {city}</span>}
              </span>
              <small class="muted">Day {daysBetween(trip.trip.start, d) + 1}</small>
            </h2>
            {entries.map((e) => (
              <ItemCard key={e.key} item={e.item} role={e.role} time={e.time} />
            ))}
            {filter === 0 && stay && !entries.some((e) => e.item === stay) && <div class="night">🌙 {stay.name}</div>}
            {filter === 0 && !entries.length && !stay && <p class="empty">—</p>}
          </section>
        )
      })}
      {adding && <EditSheet item={adding} isNew onClose={() => setAdding(undefined)} />}
    </div>
  )
}
