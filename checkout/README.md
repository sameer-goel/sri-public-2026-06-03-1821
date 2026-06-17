# Checkout module

A self-contained, no-backend checkout for Om Sacred Space. Optimized for
payment convenience: one product catalog drives every "Book / Pay" button, and
each item checks out via a hosted Stripe Payment Link (one-tap Apple/Google Pay)
— falling back to a prefilled "reserve by email" action until links are added.

This module is **not** wired into the live site yet. Review it on its own first
(`checkout.html`), then merge using the steps below.

## Files (separation of concerns)

| File               | Layer  | Runs in        | Responsibility                                   |
|--------------------|--------|----------------|--------------------------------------------------|
| `catalog.js`       | data   | browser + Node | Products, prices, Stripe link slots, contact     |
| `checkout-core.js` | logic  | browser + Node | Money, quantity, email, checkout routing (pure)  |
| `checkout-ui.js`   | UI     | browser only   | Drawer DOM, focus trap, button wiring            |
| `checkout.css`     | styles | browser        | Drawer styling (uses the site's design tokens)   |
| `checkout.html`    | demo   | browser        | Standalone preview of every product              |
| `tests/`           | tests  | Node           | `node:test` unit + jsdom DOM tests               |

Load order in the browser is always: **catalog → core → ui**.

## Preview locally

```bash
python3 -m http.server 8765
# open http://localhost:8765/checkout/checkout.html
```

## Run tests

```bash
npm test
```

## Go live (no code)

1. In the Stripe dashboard, create a Payment Link per offering and enable
   Apple Pay / Google Pay.
2. Paste each link into `PAYMENT_LINKS` in `catalog.js`, keyed by product id.
   An empty string keeps that item on the email-reservation fallback.

## Go live (programmatic / agent-runnable)

Instead of clicking in the dashboard, generate every link from the catalog with
the Stripe Payment Links API. `scripts/create-payment-links.js` creates one
hosted link per product (inline `price_data`, no separate product/price steps)
and patches the returned URLs back into `catalog.js`.

```bash
# 1. preview the exact API payloads, no key, no network calls
npm run create-links:dry

# 2. create real links with a TEST key, then review the diff
STRIPE_SECRET_KEY=sk_test_xxx npm run create-links
git diff checkout/catalog.js

# optional: only specific products
node checkout/scripts/create-payment-links.js --only session-foundations,program-basic
```

Notes:
- The secret key is read only from the env var — never hardcode or commit it.
  Start with a `sk_test_...` key; the script warns on a live key.
- Apple Pay / Google Pay appear automatically via Stripe Dynamic payment methods.
- The Sound Bath maps to Stripe `adjustable_quantity` (min 5, max 30).
- Each link is tagged with `metadata[product_id]` for easy reconciliation via
  the `checkout.session.completed` webhook.

## Merge into a site page (later)

Add to the page `<head>`:

```html
<link rel="stylesheet" href="checkout/checkout.css">
```

Add before `</body>` (after `site.js` / `theme.js`):

```html
<script src="checkout/catalog.js" defer></script>
<script src="checkout/checkout-core.js" defer></script>
<script src="checkout/checkout-ui.js" defer></script>
```

The UI then makes any card whose `<h3>` matches a catalog `heading` a clickable
link to that service's Stripe page (the whole card is the click target — no
separate button), and wires any element with `data-oss-product="<id>"`.
No other markup changes are required.
