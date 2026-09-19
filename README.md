# OGScope

Paste a URL, see the exact preview card that X, Facebook, LinkedIn, Slack, Discord, WhatsApp,
iMessage and Google will render, and get the tags you need to fix.

Free tool, no account. The paid side is an Open Graph image API.

## Why this exists

The official tools in this space died or got worse:

- X shut down its Card Validator and never replaced it.
- Facebook's Sharing Debugger now requires a logged in developer account.
- LinkedIn's Post Inspector is slow and login walled.

The demand did not go anywhere. That gap is the business.

## Running it

```bash
npm install
npm run dev
```

The dev server runs as a background daemon. `npx astro dev stop` shuts it down, `npx astro dev logs`
shows output.

```bash
npm test          # 81 tests, no network needed
npm run build     # production build
npm run deploy    # build and push to Cloudflare
```

## How it is put together

Astro on Cloudflare Workers. The content pages are static HTML, the two API routes run on demand.
There is no database, which is deliberate: the free tool cannot fall over under load and cannot
generate a bill.

```
src/lib/
  platforms.ts   Spec table for all 8 platforms. Single source of truth.
  guides.ts      Long form guide copy for the per platform pages.
  metadata.ts    Pure HTML parsing. No network.
  audit.ts       Pure grading. Tags plus image facts in, issues out.
  imagesize.ts   Reads dimensions from PNG/JPEG/GIF/WEBP headers.
  safeurl.ts     SSRF guard. Runs before any fetch.
  scan.ts        The only file that touches the network.
  card.ts        Renders one platform's unfurl. Used by both the page and the browser.

src/pages/
  index.astro          Landing page and the checker
  fix/[platform].astro Generates all 8 guide pages
  pricing.astro
  bot.astro            What our crawler does
  api/scan.ts          Scan endpoint
  api/og.ts            Open Graph image generator
```

### The split that matters

Everything except `scan.ts` is pure. Parsing, grading and image decoding take values and return
values, so they are tested directly against the malformed markup real sites ship. All the network
work lives behind one seam.

### Security

`safeurl.ts` runs before any fetch, because this service fetches whatever URL a stranger submits.
It blocks private ranges, loopback, link local (including the cloud metadata endpoint at
169.254.169.254), non web ports, and credentials in the URL. There are tests for each case. Do not
route around it.

User supplied titles and descriptions are rendered into HTML by `card.ts`, so everything there goes
through `escapeHtml`, and image URLs are restricted to http and https so a `javascript:` URL cannot
reach the DOM.

### House style

`copy.test.ts` fails the build on em dashes, curly quotes and stock marketing verbs. It is a test
because these drift back in every time a file is edited.

## Deploying

Run `./deploy-wizard.sh` for a guided walkthrough of the parts that need your accounts. The short
version:

1. `npx wrangler login`
2. `npm run deploy`
3. Point a domain at the Worker in the Cloudflare dashboard, or use the free `workers.dev` subdomain.

Set `site` in `astro.config.mjs` to your real domain before deploying, since canonical tags and the
sitemap are built from it.

## Cost

Nothing has a fixed cost. Cloudflare's free tier covers 100,000 requests a day and commercial use is
allowed. There is no paid API behind any feature. A domain is the only thing you have to buy.

## Fonts

Archivo, under the SIL Open Font License. See `public/fonts/LICENSE.txt`.
