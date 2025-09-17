# DuoLiftApp — Ponte Sollevatore a Due Colonne (PWA)

Gioco puzzle in HTML5/Canvas: assembla un ponte 2 colonne con bracci telescopici (3 sfilate), centralina, motore e base. Funziona offline, installabile come PWA, con modalità **Camera** (getUserMedia) per sfondo in stile AR.

## Struttura
- `index.html` — UI + canvas + overlay intro
- `app.js` — logica di gioco (drag, snap, simmetria, punteggio, timer)
- `manifest.json` — metadati PWA
- `service-worker.js` — cache offline
- `readme.html` — guida rapida
- `icons/icon-192.png`, `icons/icon-512.png` — icone PWA

## Esecuzione
Pubblica la cartella su GitHub Pages come `DuoLiftApp/` e apri `index.html`.

## Licenza
MIT
