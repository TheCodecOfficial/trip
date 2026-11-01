import { useState } from 'preact/hooks'
import { unlock } from '../store.ts'

export function Unlock() {
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  return (
    <form
      class="unlock"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(false)
        const ok = await unlock(pass)
        setBusy(false)
        if (!ok) setError(true)
      }}
    >
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={72} height={72} />
      <h1>Unlock</h1>
      <p class="muted">Enter the passphrase once. It stays on this device until you lock the app.</p>
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Passphrase"
        value={pass}
        onInput={(e) => setPass((e.target as HTMLInputElement).value)}
        autoFocus
      />
      {error && <p class="error">Wrong passphrase.</p>}
      <button class="btn primary" disabled={busy || !pass}>
        {busy ? 'Unlocking…' : 'Unlock'}
      </button>
    </form>
  )
}
