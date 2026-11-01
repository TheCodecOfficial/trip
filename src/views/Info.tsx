import type { TripData } from '../store.ts'
import { exportOverlay, getState, importOverlay, lock, overlayEditCount, resetAll } from '../store.ts'
import { ExtLink, RichText, toast } from '../components/ui.tsx'
import { YenConverter } from '../components/YenConverter.tsx'

export function Info({ trip }: { trip: TripData }) {
  const { base, overlay } = getState()
  const edits = overlayEditCount(overlay)

  return (
    <div class="view info">
      <h1>Info</h1>

      <section>
        <h2>Yen converter</h2>
        <YenConverter rate={trip.trip.jpyPerHome} home={trip.trip.homeCurrency} defaultRate={base!.trip.jpyPerHome} />
      </section>

      {trip.accounts.length > 0 && (
        <section>
          <h2>Accounts</h2>
          <div class="link-list">
            {trip.accounts.map((a) => (
              <ExtLink key={a.url} href={a.url} class="link-row">
                <span>
                  <strong>{a.name}</strong>
                  {a.note && <small>{a.note}</small>}
                </span>
                <span aria-hidden>↗</span>
              </ExtLink>
            ))}
          </div>
        </section>
      )}

      {Object.keys(trip.ticketGuides).length > 0 && (
        <section>
          <h2>Tickets: how they work</h2>
          {Object.entries(trip.ticketGuides).map(([k, g]) => (
            <details key={k} class="card guide">
              <summary>
                <strong>{g.name}</strong>
                <small>{g.summary}</small>
              </summary>
              {g.steps.length > 0 && (
                <ol>
                  {g.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              )}
              {g.url && <ExtLink href={g.url}>Website ↗</ExtLink>}
            </details>
          ))}
        </section>
      )}

      {trip.emergency.length > 0 && (
        <section>
          <h2>Emergency</h2>
          <div class="link-list">
            {trip.emergency.map((c) => (
              <div key={c.name} class="link-row static">
                <span>
                  <strong>{c.name}</strong>
                  {c.note && <small>{c.note}</small>}
                </span>
                {c.phone && (
                  <a class="btn small" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>
                    📞 {c.phone}
                  </a>
                )}
                {c.url && <ExtLink href={c.url}>↗</ExtLink>}
              </div>
            ))}
          </div>
        </section>
      )}

      {trip.info.map((s) => (
        <section key={s.title}>
          <details class="card guide">
            <summary>
              <strong>{s.title}</strong>
            </summary>
            <RichText text={s.body} />
          </details>
        </section>
      ))}

      <section>
        <h2>This app</h2>
        <div class="card plain">
          <p class="muted">
            Data built {new Date(trip.builtAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.{' '}
            {edits ? `${edits} change${edits === 1 ? '' : 's'} made on this phone.` : 'No changes on this phone.'}
          </p>
          <div class="actions">
            <button type="button" class="btn" onClick={exportOverlay} disabled={!edits}>
              Export my changes
            </button>
            <label class="btn">
              Import changes
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (!file) return
                  try {
                    await importOverlay(file)
                    toast('Changes imported')
                  } catch (err) {
                    toast(String(err instanceof Error ? err.message : err))
                  }
                }}
              />
            </label>
            {edits > 0 && (
              <button
                type="button"
                class="btn danger"
                onClick={() =>
                  confirm('Discard all changes made on this phone (including hidden items and ticked to-dos)?') && resetAll()
                }
              >
                Reset changes
              </button>
            )}
            <button
              type="button"
              class="btn"
              onClick={() => confirm('Lock the app? You will need the passphrase again.') && lock()}
            >
              🔒 Lock
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
