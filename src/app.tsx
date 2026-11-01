import { useEffect, useState } from 'preact/hooks'
import { useRegisterSW } from 'virtual:pwa-register/preact'
import { useStore } from './store.ts'
import { todayJst } from './dates.ts'
import { Today } from './views/Today.tsx'
import { Trip } from './views/Trip.tsx'
import { Todo } from './views/Todo.tsx'
import { Info } from './views/Info.tsx'
import { Unlock } from './views/Unlock.tsx'
import { Toaster } from './components/ui.tsx'

const tabs = [
  ['today', 'Today', '☀️'],
  ['trip', 'Trip', '🗓️'],
  ['todo', 'To-do', '✅'],
  ['info', 'Info', 'ℹ️'],
] as const
type Tab = (typeof tabs)[number][0]

const readTab = (): Tab => tabs.find(([t]) => `#${t}` === location.hash)?.[0] ?? 'today'

export function App() {
  return (
    <>
      <Screen />
      {/* Mounted in every phase (also while locked) so the app is cached for offline use on the first visit. */}
      <UpdatePrompt />
      <Toaster />
    </>
  )
}

function Screen() {
  const state = useStore()
  const [tab, setTabState] = useState<Tab>(readTab)
  const [date, setDate] = useState<string>()

  useEffect(() => {
    const onHash = () => setTabState(readTab())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => scrollTo(0, 0), [tab])

  const setTab = (t: Tab) => {
    if (t === tab) return
    location.hash = t
  }

  if (state.phase === 'loading') return <div class="center muted">Loading…</div>
  if (state.phase === 'error') return <div class="center error">{state.error}</div>
  if (state.phase === 'locked' || !state.trip) return <Unlock />

  const trip = state.trip
  const { start, end } = trip.trip
  const today = todayJst()
  const day = date ?? (today < start ? start : today > end ? end : today)
  const openTodos = trip.todos.filter((t) => !t.done && (!t.date || t.date <= today)).length

  return (
    <>
      <main>
        {tab === 'today' && <Today trip={trip} date={day} setDate={setDate} />}
        {tab === 'trip' && (
          <Trip
            trip={trip}
            onPickDay={(d) => {
              setDate(d)
              setTab('today')
            }}
          />
        )}
        {tab === 'todo' && <Todo trip={trip} />}
        {tab === 'info' && <Info trip={trip} />}
      </main>
      <nav class="tabbar">
        {tabs.map(([t, label, icon]) => (
          <button
            type="button"
            key={t}
            class={t === tab ? 'active' : ''}
            onClick={() => {
              if (t === 'today') setDate(undefined)
              setTab(t)
            }}
          >
            <span class="tab-icon" aria-hidden>
              {icon}
            </span>
            {label}
            {t === 'todo' && openTodos > 0 && <span class="tab-badge">{openTodos}</span>}
          </button>
        ))}
      </nav>
    </>
  )
}

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for new data whenever the app is reopened (and hourly while open).
      if (!reg) return
      const check = () => navigator.onLine && reg.update()
      setInterval(check, 3600_000)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    },
  })
  if (!needRefresh) return null
  return (
    <div class="update">
      New version / data available
      <button type="button" class="btn small primary" onClick={() => updateServiceWorker(true)}>
        Reload
      </button>
    </div>
  )
}
