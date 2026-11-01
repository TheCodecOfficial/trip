# Trip

An offline travel companion (PWA). It shows what's on today (trains, tickets, stays, to-dos) and
has a day-by-day view of the whole trip.

All trip data is **encrypted**. The repository and the website only contain `public/trip.enc`
(AES-256-GCM, key derived from a passphrase with PBKDF2-SHA256, 600k iterations). Plaintext lives
in `data/` and `sources/`, which are gitignored and never committed.

## Updating the data

```sh
npm install
npm run check:data            # validate data/trip.yaml, show warnings
npm run build:data            # encrypt to public/trip.enc (asks for the passphrase)
npm run leakcheck             # prove no plaintext is in git history or dist/
git add public/trip.enc && git commit -m "Update data" && git push
```

The phone picks up the new data the next time the app is opened online ("New version / data
available → Reload").

## Development

```sh
npm run build:data -- --src examples/trip.example.yaml --dev   # data/trip.dev.enc, passphrase "dev"
npm run dev                                                      # serves the dev blob as trip.enc
```

Append `?date=2027-04-04&time=09:30` to the URL to simulate a day.

Data format: see `src/schema.ts` and `examples/trip.example.yaml` (fictional).

## On the phone

Open the site in Chrome → ⋮ → *Add to Home screen / Install app*. Enter the passphrase once; the key
is stored on the device (non-extractable) until *Info → Lock*. Changes made on the phone (status,
seats, notes, to-dos) are stored encrypted on the device and can be exported as JSON from *Info*.

## Going public (GitHub Pages)

1. `npm run build:data` with the real passphrase (5+ random words). Then `npm run build`.
2. `npm run leakcheck` passes. `git log --all --stat` shows nothing under `data/` or `sources/`.
3. Optional: squash history into a single commit.
4. Make the repository public, then *Settings → Pages → Source: GitHub Actions*. The workflow only
   runs on public repositories.
