# Om Sacred Space

A static website for Om Sacred Space — sound healing, energy work, the Sri Yantra
Guidebook, and more.

## Pages

- `index.html` — Home / landing
- `sound-healing.html` — Sound healing, sessions, programs, FAQ, and contact
- `book.html` — The Sri Yantra Guidebook (worldwide Amazon store links)
- `retreat.html` — Sacred Retreat (coming soon)
- `shop.html` — Sacred Shop
- `404.html` — Fallback page

## Tech

Plain HTML, CSS, and vanilla JavaScript. No build step.

- `styles.css` — design system and page styles
- `portal.css`, `portal.js` — intro portal animation
- Theme switcher with several presets, persisted in `localStorage`

## Running locally

Open `index.html` in a browser, or serve the folder with any static server:

```
python3 -m http.server 8000
```

Then visit http://localhost:8000.
