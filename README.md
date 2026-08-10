# Hermes Token Cost

A dependency-free, client-side calculator for estimating Hermes Agent model spend from Nous Portal input/output pricing and editable cache-read assumptions.

## Pricing snapshot

Checked against the live [Nous Portal catalog](https://portal.nousresearch.com/) on **August 9, 2026**:

- OpenAI GPT-5.6 Sol (batch): **$2.00/M input**, **$12.00/M output**
- OpenAI GPT-5.5: **$4.00/M input**, **$24.00/M output**
- Cache-read defaults ($0.20/M and $0.40/M) are explicitly labeled assumptions, set to 10% of input.

OpenRouter links are included as model references only; the app does not present OpenRouter pricing as Nous Portal pricing.

## Development

Requires Node.js 18+ and no package install.

```bash
npm test
npm run build
npx serve dist -l 4173
```

Open `http://localhost:4173/token/` (the build emits both `/` and `/token/` entry points).

## Architecture

- `index.html` — semantic application shell
- `styles.css` — responsive design system and layouts
- `calc.js` — pure parsing, calculation, validation, and URL-state functions
- `app.js` — DOM rendering, persistence, sharing, copy, themes, and interactions
- `tests/` — Node built-in unit tests
- `scripts/build.js` — dependency-free static production build

All computation and state remain in the browser. There is no backend, login, analytics, or runtime dependency. URL shares use a base64url-encoded hash. URL state takes precedence over local storage; otherwise saved local edits take precedence over the default Hermes snapshot.

## Deployment

The `dist/` directory is suitable for Cloudflare Pages, GitHub Pages, Netlify, or Vercel. For Cloudflare Pages:

```bash
npm run build
npx wrangler pages deploy dist --project-name odaya-token-calculator
```

Attach a custom domain or route only after inspecting existing DNS/routes. Do not overwrite an existing root application simply to expose `/token`.

## Caveat

This is an estimate, not an invoice. Hermes “cached/other” residual tokens are treated as cache reads for estimation. Currency conversions are fixed illustrative display rates; USD is the authoritative pricing base.
