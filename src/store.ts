// App state: loads + decrypts trip.enc, keeps on-device edits (the "overlay") and merges both.
import { useEffect, useState } from 'preact/hooks'
import type { Item, Todo, Trip } from './schema.ts'
import { decryptJson, deriveKey, encryptJson, parseHeader, sameBytes, type BlobHeader } from './crypto.ts'
import { idbDel, idbGet, idbSet } from './idb.ts'

export type TripData = Trip & { builtAt: string }

/** Everything changed on the phone. Stored encrypted with the same key as the trip data. */
export interface Overlay {
  patches: Record<string, Record<string, unknown>> // edits to items from trip.yaml, by id (null = field cleared)
  added: Item[] // items created on the phone
  hidden: string[] // trip.yaml items hidden on the phone
  todoDone: Record<string, boolean>
  addedTodos: Todo[]
  rate?: number
  updatedAt?: string
}

export interface State {
  phase: 'loading' | 'locked' | 'ready' | 'error'
  base?: TripData
  overlay: Overlay
  trip?: TripData // base + overlay
  error?: string
}

const emptyOverlay = (): Overlay => ({ patches: {}, added: [], hidden: [], todoDone: {}, addedTodos: [] })

let state: State = { phase: 'loading', overlay: emptyOverlay() }
let blob: Uint8Array | undefined
let header: BlobHeader | undefined
let key: CryptoKey | undefined
const listeners = new Set<() => void>()

function set(next: Partial<State>) {
  state = { ...state, ...next }
  if (state.base) state.trip = merge(state.base, state.overlay)
  listeners.forEach((l) => l())
}

export function useStore(): State {
  const [, force] = useState(0)
  const rendered = state
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    if (state !== rendered) l() // changed between render and subscribe (e.g. init finished first)
    return () => void listeners.delete(l)
  }, [])
  return state
}

export const getState = () => state

// ---------- loading / unlocking ----------

export async function init() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}trip.enc`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`Trip data not found (${res.status})`)
    blob = new Uint8Array(await res.arrayBuffer())
    header = parseHeader(blob)
  } catch (e) {
    return set({ phase: 'error', error: String(e instanceof Error ? e.message : e) })
  }
  const stored = await idbGet<CryptoKey>('key')
  if (stored && (await open(stored))) return
  set({ phase: 'locked' })
}

/** Returns false for a wrong passphrase. */
export async function unlock(passphrase: string): Promise<boolean> {
  if (!blob || !header) return false
  const k = await deriveKey(passphrase, header.salt, header.iterations)
  if (!(await open(k, passphrase))) return false
  await idbSet('key', k)
  return true
}

async function open(k: CryptoKey, passphrase?: string): Promise<boolean> {
  let base: TripData
  try {
    base = await decryptJson<TripData>(blob!, k)
  } catch {
    return false
  }
  key = k
  set({ phase: 'ready', base, overlay: await loadOverlay(passphrase) })
  return true
}

async function loadOverlay(passphrase?: string): Promise<Overlay> {
  const saved = await idbGet<Uint8Array>('overlay')
  if (!saved) return emptyOverlay()
  try {
    // After a passphrase change the edits are still encrypted with the old salt.
    const savedHeader = parseHeader(saved)
    const k =
      sameBytes(savedHeader.salt, header!.salt) || !passphrase
        ? key!
        : await deriveKey(passphrase, savedHeader.salt, savedHeader.iterations)
    const overlay = { ...emptyOverlay(), ...(await decryptJson<Overlay>(saved, k)) }
    if (k !== key) await saveOverlay(overlay)
    return overlay
  } catch {
    // Unreadable (passphrase changed): keep the old blob aside instead of overwriting it silently.
    await idbSet(`overlay-unreadable-${Date.now()}`, saved)
    await idbDel('overlay')
    return emptyOverlay()
  }
}

// Saves run one after another so a slow older save can never overwrite a newer one.
let saving: Promise<void> = Promise.resolve()

function saveOverlay(overlay: Overlay): Promise<void> {
  const k = key
  const h = header
  if (!k || !h) return saving
  saving = saving
    .then(async () => idbSet('overlay', await encryptJson(overlay, k, h.salt, h.iterations)))
    .catch((e) => console.error('Saving edits failed', e))
  return saving
}

export async function lock() {
  await idbDel('key')
  key = undefined
  set({ phase: 'locked', base: undefined, trip: undefined, overlay: emptyOverlay() })
}

// ---------- merging ----------

function merge(base: TripData, o: Overlay): TripData {
  const items = base.items
    .filter((i) => !o.hidden.includes(i.id))
    .map((i) => (o.patches[i.id] ? applyPatch(i, o.patches[i.id]) : i))
    .concat(o.added)
  const todos = base.todos.concat(o.addedTodos).map((t) => (t.id in o.todoDone ? { ...t, done: o.todoDone[t.id] } : t))
  return {
    ...base,
    trip: { ...base.trip, jpyPerHome: o.rate ?? base.trip.jpyPerHome },
    items,
    todos,
  }
}

function applyPatch(item: Item, patch: Record<string, unknown>): Item {
  const out: Record<string, unknown> = { ...item, ...patch }
  for (const [k, v] of Object.entries(patch)) if (v === null) delete out[k]
  return out as Item
}

// ---------- edits ----------

function update(fn: (o: Overlay) => void) {
  const overlay = structuredClone(state.overlay)
  fn(overlay)
  overlay.updatedAt = new Date().toISOString()
  set({ overlay })
  void saveOverlay(overlay)
}

export const isBaseItem = (id: string) => !!state.base?.items.some((i) => i.id === id)
export const isEdited = (id: string) => id in state.overlay.patches || state.overlay.added.some((i) => i.id === id)

export function saveItem(item: Item) {
  update((o) => {
    const original = state.base?.items.find((i) => i.id === item.id)
    if (!original) {
      const idx = o.added.findIndex((i) => i.id === item.id)
      if (idx >= 0) o.added[idx] = item
      else o.added.push(item)
      return
    }
    const patch: Record<string, unknown> = {}
    const orig = original as Record<string, unknown>
    for (const [k, v] of Object.entries(item)) if (JSON.stringify(v) !== JSON.stringify(orig[k])) patch[k] = v
    // Fields cleared in the form: null survives JSON and removes the original value on merge.
    for (const k of Object.keys(orig)) if (!(k in item)) patch[k] = null
    if (Object.keys(patch).length) o.patches[item.id] = patch
    else delete o.patches[item.id]
  })
}

export function removeItem(id: string) {
  update((o) => {
    if (isBaseItem(id)) {
      if (!o.hidden.includes(id)) o.hidden.push(id)
      delete o.patches[id]
    } else o.added = o.added.filter((i) => i.id !== id)
  })
}

export const resetItem = (id: string) => update((o) => void delete o.patches[id])

export const setTodoDone = (id: string, done: boolean) => update((o) => void (o.todoDone[id] = done))

export function addTodo(text: string, date?: string) {
  update((o) => void o.addedTodos.push({ id: `local-${Date.now().toString(36)}`, text, date, done: false }))
}

export function removeTodo(id: string) {
  update((o) => {
    o.addedTodos = o.addedTodos.filter((t) => t.id !== id)
    delete o.todoDone[id]
  })
}

export const setRate = (rate: number | undefined) => update((o) => void (o.rate = rate))

export const resetAll = () => update((o) => Object.assign(o, emptyOverlay()))

export function overlayEditCount(o: Overlay = state.overlay) {
  return (
    Object.keys(o.patches).length +
    o.added.length +
    o.hidden.length +
    Object.keys(o.todoDone).length +
    o.addedTodos.length +
    (o.rate ? 1 : 0)
  )
}

export function exportOverlay() {
  const file = new Blob([JSON.stringify(state.overlay, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = `trip-edits-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export async function importOverlay(file: File) {
  const data = JSON.parse(await file.text()) as Partial<Overlay>
  if (typeof data !== 'object' || !data.patches) throw new Error('Not a trip edits file')
  update((o) => Object.assign(o, emptyOverlay(), data))
}
