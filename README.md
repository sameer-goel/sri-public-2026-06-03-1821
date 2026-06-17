# Om Sacred Space - Versioned Development

## Structure

```
<root>/          ← ACTIVE development version. Edit here.
  index.html, sound-healing.html, book.html, retreat.html, shop.html,
  404.html, styles.css, portal.css, portal.js, images/, …
archive/         ← Frozen snapshots & experiments. Never edit.
  v1/  v2/  v3/  v4/               ← frozen version folders
  v2-backup.zip  v3-backup.zip  v4-backup.zip   ← compressed snapshots
  shop.html                        ← standalone full shop design
  sri-yantra-book-animation.html   ← standalone Sri Yantra animation
```

## Rules (the norm)

- **The active version lives in the repository root.** All changes go there.
- **`archive/` is read-only.** It holds frozen versions and experiments for rollback.
- **To back up & move on:** copy the current root site into `archive/vN/`, zip it as
  `archive/vN-backup.zip`, then keep developing in root. See
  `.kiro/steering/version-workflow.md` for the full procedure.
- To test, open the root `index.html` in a browser. No build step.

## Version Log

| Version | Description |
|---------|-------------|
| v1 | Original portal animation with tunnel, starfield, and calligraphy welcome. |
| v2 | Home button re-entry tunnel animation (dark screen, no hero leak); hero quote changed to "Authenticity is the Sacred Space to Bliss."; yantra image contained with header/footer margins. |
| v3 | New navigation layout: fixed (non-scrolling) hero. Header is logo (left) + menu left-to-right - Sound Healing, Sri Yantra Book, Sacred Retreat, Sacred Shop - with the atmosphere/theme icon on the right. Sound Healing is the existing site, Sri Yantra Book has its own page, Sacred Retreat and Sacred Shop are "coming soon" pages. Theme switcher works across all pages. Instagram and YouTube moved from the header to the footer. Home/logo page split from the Sound Healing content flow. **FROZEN - approved milestone (`archive/v3/`).** |
| v4 | Commerce milestone evolved from v3: live Stripe payments with **iDEAL** enabled (NL); payment-convenience checkout layer (catalog / core / UI) + unit tests; **Group Healing** section with the tiered per-person **Group Sound Bath** booking (volume pricing 5–9 / 10–14 / 15–19 / 20+) and a **Mega Sound Events** enquiry card; 8th **Custom Package** program (€222); Sacred Store hidden from nav; a small Node checkout server (`checkout/server.js`) for dynamic Sound Bath Checkout Sessions; Stripe-branding audit (`checkout/BRANDING.md`). **FROZEN — approved milestone (`archive/v4/`).** |
| Active (root) | Current development version, evolved from v4. Lives in the repository root. |
