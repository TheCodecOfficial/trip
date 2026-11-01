// All trip dates/times are local Japan time (UTC+9, no DST) unless a stop carries its own `tz`.
export const JST = '+09:00'

const params = new URLSearchParams(location.search)
// Debug: ?date=2027-04-03&time=09:30 pretends it is that moment in Japan.
const fakeDate = params.get('date')
const fakeTime = params.get('time') ?? '09:00'

export function nowMs(): number {
  return fakeDate ? Date.parse(`${fakeDate}T${fakeTime.padStart(5, '0')}:00${JST}`) : Date.now()
}

export function todayJst(): string {
  return new Date(nowMs() + 9 * 3600_000).toISOString().slice(0, 10)
}

export function addDays(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000)
}

export function dateRange(start: string, end: string): string[] {
  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

const fmt = (opts: Intl.DateTimeFormatOptions) => {
  const f = new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' })
  return (d: string) => f.format(new Date(`${d}T00:00:00Z`))
}
export const formatDayLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' })
export const formatDay = fmt({ weekday: 'short', day: 'numeric', month: 'short' })
export const formatChip = fmt({ day: 'numeric', month: 'short' })
export const formatWeekday = fmt({ weekday: 'short' })

/** First HH:MM in a string like "15:00" or "15:00–22:00", as minutes after midnight. */
export function minutes(time?: string): number | undefined {
  const m = time?.match(/(\d{1,2}):(\d{2})/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined
}

export function toMs(date: string, time?: string, tz = JST): number | undefined {
  const min = minutes(time)
  if (min === undefined) return undefined
  const hh = String(Math.floor(min / 60)).padStart(2, '0')
  const mm = String(min % 60).padStart(2, '0')
  return Date.parse(`${date}T${hh}:${mm}:00${tz}`)
}

export function countdown(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `in ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `in ${h} h ${min % 60 ? `${min % 60} min` : ''}`.trim()
  const d = Math.round(h / 24)
  return `in ${d} day${d === 1 ? '' : 's'}`
}
