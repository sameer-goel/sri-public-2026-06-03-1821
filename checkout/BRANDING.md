# Stripe Checkout branding — Om Sacred Space

The Stripe-hosted Checkout / Payment Links page is themed once at the account
level, and **every** payment link inherits it automatically. Values below are
taken from the site's design tokens in `styles.css` so the hosted page matches
omsacredspace.com.

Configure here: **Dashboard → Settings → Branding → Checkout & Payment Links**
`https://dashboard.stripe.com/settings/branding/checkout`
(Do this in **Test mode** first via the toggle, then repeat in Live mode.)

## Brand values (copy-paste)

| Setting          | Value                          | Source token        |
|------------------|--------------------------------|---------------------|
| Business name    | `Om Sacred Space`              | —                   |
| Icon             | upload `images/favicon.png`    | site favicon (ॐ)    |
| Logo             | upload `images/favicon.png` (or a wordmark if you have one) | — |
| Brand color      | `#C9A96E` (gold)               | `--gold`            |
| Accent color     | `#8B6CC1` (violet)             | `--accent`          |
| Button color     | `#C9A96E` (gold)               | `--btn--primary`    |
| Background        | `#F7F4EF` (cream) — recommended | `--bg-cream`        |
| Font             | `Lora` (elegant serif)         | closest to `Cormorant Garamond` |
| Shape / radius   | most rounded preset (~16px)    | `--radius: 16px`    |

### Notes / rationale
- **Light background recommended.** A cream page with indigo text and gold
  buttons is on-brand *and* maximizes legibility/conversion. A dramatic dark
  variant (`#0C0A1D`, `--bg-deep`) is possible but lowers checkout legibility.
- **Font.** Stripe applies one font family to the whole page and doesn't offer
  Cormorant Garamond. `Lora` (or `Noto Serif` / `PT Serif`) carries the same
  elegant serif feel. If you prefer clean over classic, `Inter` is also a preset
  and is the site's body font. All three support EU locales (en/nl/de/fr/es/it).
- **Button text contrast** is handled automatically by Stripe based on the
  button color.

## Also configure (buyer confidence + correctness)

- **Business details** → set Business name `Om Sacred Space`, support email
  `contact@omsacredspace.com`. `https://dashboard.stripe.com/settings/business-details`
- **Public details** → set Terms of Service + Privacy Policy URLs so Checkout
  can link them. `https://dashboard.stripe.com/settings/public`
- **Payment methods** → enable **iDEAL** (you're NL-based), Bancontact, cards,
  Apple Pay, Google Pay. Stripe's dynamic payment methods then show the most
  relevant ones per customer automatically (iDEAL requires EUR — all sessions
  are EUR). `https://dashboard.stripe.com/settings/payment_methods`
- (Optional, polished) **Custom domain** so links read `pay.omsacredspace.com`
  instead of `buy.stripe.com`. `https://docs.stripe.com/payments/checkout/custom-domains`

## What's automated vs manual

| Step                         | How                                   |
|------------------------------|---------------------------------------|
| Create the payment links     | `npm run create-links` (script/API)   |
| Apply the theme above        | Dashboard branding (one time, ~2 min) |
| Enable iDEAL + methods       | Dashboard payment methods (one time)  |
| Place buttons on the site    | merge step (links into the pages)     |

Once branding + payment methods are set, re-run `npm run create-links` only if
you add/changed products; existing links already inherit the theme.

## Verified account state & fixes (checked 2026-06-17)

These were read directly from the **live** account (`acct_…Ocgcb`) via the API,
and DNS. The API **cannot** set branding on your own account
(`403: you may only use it on connected accounts`), so every change below is
**Dashboard-only**.

### Current live branding (why the page looks generic)
| Field | Current value | Should be |
|-------|---------------|-----------|
| Brand (primary) color   | `#525f7f` (Stripe default grey) | `#C9A96E` gold |
| Accent (secondary) color | `#0074d4` (Stripe default blue) | `#8B6CC1` violet |
| Icon  | already uploaded (shows in checkout) | keep, or replace with a ≥128px ॐ |
| Logo  | not set | optional wordmark |

### Business details to correct (Settings → Business details)
- **URL is mistyped**: stored as `OmSacredSapce.com` (note "Sapce", no scheme)
  → set to `https://omsacredspace.com`.
- **Support email is unset** → set `contact@omsacredspace.com`.
  Domain email is live: MX = `mx1/mx2.hostinger.com`, SPF =
  `v=spf1 include:_spf.mail.hostinger.com ~all`. Confirm the `contact@`
  mailbox/alias actually exists in hPanel → Emails before relying on it.
- Public display name is `OmSacredSpaceWebsiteSales`; use `Om Sacred Space`
  if that name is shown to buyers.

### Asset note
- `images/favicon.png` is **32×32 px** — too small to re-upload as a Stripe
  icon/logo (needs square, ≥128px; 512px ideal). Not urgent: an icon is
  already set on the account.
