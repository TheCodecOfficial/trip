import { useState } from 'preact/hooks'
import { setRate } from '../store.ts'

const quick = [500, 1000, 3000, 5000, 10000, 30000]

export function YenConverter({ rate, home, defaultRate }: { rate: number; home: string; defaultRate: number }) {
  const [yen, setYen] = useState('1000')
  const [editingRate, setEditingRate] = useState(false)
  const yenNum = Number(yen.replace(/[^\d.]/g, '')) || 0
  const homeValue = yenNum / rate

  return (
    <div class="converter">
      <label class="conv-field">
        <span>¥</span>
        <input inputMode="decimal" value={yen} onInput={(e) => setYen((e.target as HTMLInputElement).value)} />
      </label>
      <label class="conv-field">
        <span>{home}</span>
        <input
          inputMode="decimal"
          value={homeValue ? (homeValue < 10 ? homeValue.toFixed(2) : homeValue.toFixed(1)) : ''}
          onInput={(e) => {
            const v = Number((e.target as HTMLInputElement).value.replace(',', '.'))
            setYen(v ? String(Math.round(v * rate)) : '')
          }}
        />
      </label>
      <div class="chips">
        {quick.map((q) => (
          <button type="button" key={q} class="chip" onClick={() => setYen(String(q))}>
            ¥{q.toLocaleString('en')}
          </button>
        ))}
      </div>
      <div class="conv-rate">
        {editingRate ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const v = Number((e.currentTarget.elements.namedItem('rate') as HTMLInputElement).value.replace(',', '.'))
              if (v > 0) setRate(v === defaultRate ? undefined : v)
              setEditingRate(false)
            }}
          >
            1 {home} = ¥ <input name="rate" inputMode="decimal" defaultValue={String(rate)} size={6} autoFocus />{' '}
            <button class="btn small">OK</button>
          </form>
        ) : (
          <button type="button" class="link" onClick={() => setEditingRate(true)}>
            1 {home} = ¥{rate} · ¥1,000 = {(1000 / rate).toFixed(2)} {home} · change rate
          </button>
        )}
      </div>
    </div>
  )
}
