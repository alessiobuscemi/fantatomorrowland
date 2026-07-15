# Fantatomorrowland 🎪

A twisted fantacalcio for Tomorrowland. Friends are the players, each with a
price. Every participant builds a team with 100 credits (no size limit, no
self-picks, shared picks allowed) and names a captain with a category:
**sex, disgust, idiocy, drama, pain**. Events score points to every team
holding that friend; the captain scores double in their chosen category.

Full rules: [spec.md](spec.md)

## Layout

- `fanta.js` — all game logic, pure functions
- `index.html` — thin mobile UI (event delegation, works offline, survives
  blocked localStorage)
- `build.py` — bundles everything into `docs/`:
  - `docs/index.html` + manifest + service worker + icons: installable PWA
    (served by GitHub Pages; open once, Add to Home Screen, fully offline after)
  - `docs/fantatomorrowland.html`: single self-contained file, no hosting needed
- `tests/` — `node --test tests/` (logic units + headless UI smoke + PWA build checks)

## Develop

```bash
node --test tests/    # run all tests
python3 build.py      # rebuild docs/
```

Data lives in the browser's localStorage; the Friends tab has JSON
export/import for backup.
