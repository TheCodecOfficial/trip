// Which items show up on a given day, in what role and order.
import type { Item, Stay, Todo } from './schema.ts'
import type { TripData } from './store.ts'
import { addDays, minutes, toMs } from './dates.ts'

export type Role = 'event' | 'arrive' | 'checkin' | 'checkout'

export interface Entry {
  key: string
  item: Item
  role: Role
  time?: string // HH:MM shown in the time column
  at?: number // epoch ms, if known
}

export const isTransport = (i: Item) => i.type === 'train' || i.type === 'bus' || i.type === 'flight'

export function entriesFor(trip: TripData, date: string): Entry[] {
  const out: (Entry & { sort: number })[] = []
  for (const item of trip.items) {
    if (item.type === 'stay') {
      if (item.date === date) out.push(entry(item, 'checkin', date, item.checkIn, 15 * 60))
      if (item.until === date) out.push(entry(item, 'checkout', date, item.checkOut, 10 * 60))
      continue
    }
    if (item.date === date) {
      const time = item.type === 'activity' ? item.start : item.from.time
      out.push(entry(item, 'event', date, time, 24 * 60, isTransport(item) ? item.from.tz : undefined))
    } else if (isTransport(item) && item.to.date === date) {
      // Overnight transport: show the arrival on the next day too.
      out.push(entry(item, 'arrive', date, item.to.time, 0, item.to.tz))
    }
  }
  // Check-in times are "from" times: you get there after the day's last arrival.
  const lastArrival = Math.max(
    -1,
    ...out.filter((e) => e.role === 'event' && isTransport(e.item)).map((e) => arrivalMinutes(e.item, date) ?? -1),
  )
  for (const e of out) {
    if (e.role !== 'checkin' || lastArrival < e.sort) continue
    e.sort = lastArrival + 1
    e.at = toMs(date, `${Math.floor(lastArrival / 60)}:${String(lastArrival % 60).padStart(2, '0')}`)
  }
  // Check-outs before other things at the same time; untimed things last.
  const roleOrder: Record<Role, number> = { checkout: 0, arrive: 1, event: 2, checkin: 3 }
  return out.sort((a, b) => a.sort - b.sort || roleOrder[a.role] - roleOrder[b.role])
}

function arrivalMinutes(item: Item, date: string) {
  if (!isTransport(item) || (item.to.date && item.to.date !== date)) return undefined
  return minutes(item.to.time)
}

function entry(item: Item, role: Role, date: string, time: string | undefined, fallback: number, tz?: string) {
  const t = time?.match(/\d{1,2}:\d{2}/)?.[0]
  return { key: `${item.id}:${role}`, item, role, time: t, at: toMs(date, t, tz), sort: minutes(t) ?? fallback }
}

/** The stay you sleep in on the night of `date`. */
export function stayFor(trip: TripData, date: string): Stay | undefined {
  return trip.items.find((i): i is Stay => i.type === 'stay' && i.date <= date && date < i.until)
}

export const todosFor = (todos: Todo[], date: string) => todos.filter((t) => t.date === date)

/** Things to sort out before tomorrow: unbooked items and the first departure. */
export function headsUp(trip: TripData, date: string): Entry[] {
  const next = entriesFor(trip, addDays(date, 1))
  const firstDeparture = next.find((e) => e.role === 'event' && isTransport(e.item) && e.time)
  return next.filter((e) => e === firstDeparture || e.item.status !== 'booked' || e.role === 'checkout')
}

export function itemTitle(item: Item): string {
  if (item.title) return item.title
  if (item.type === 'stay' || item.type === 'activity') return item.name
  return `${item.from.place} → ${item.to.place}`
}
