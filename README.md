# EIP-8148 landing page

Production source for [eip8148.com](https://eip8148.com/). The site is intentionally buildless: it uses semantic HTML, plain CSS, and small progressive-enhancement scripts, with no package manager, framework, or analytics. EVA Hub totals optionally refresh from a public API; the page remains usable without it.

## Local preview

Run a static server from the repository root:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. Opening `index.html` directly is not representative because production security and cache headers are supplied by the host.

## Deployment

Publish the repository root with Cloudflare Pages. Cloudflare reads `_headers` from the published directory and applies its Content Security Policy, browser security headers, and cache policy.

The canonical URL, Open Graph metadata, `robots.txt`, and `sitemap.xml` currently target `https://eip8148.com/`. Update them together before deploying under another production domain.

## Structure

- `index.html` — the complete page and inline diagrams.
- `assets/styles.css` — layout, responsive styles, local font declarations, and interaction states.
- `assets/simulation.js` — optional hero simulation, section diagrams, and mobile-menu enhancement. The five step illustrations loop while visible and pause offscreen or in a hidden tab, preserving their place in the cycle. Reduced motion keeps their static explanation. The consolidation illustration gathers the same eight squares in place after five seconds of increasing tremble; clicking scatters them, then starts a ten-second wait before the next gathering. Hidden and offscreen time pauses the sequence; reduced motion uses static transitions.
- `assets/eva-support.js` — refreshes the validator signal totals from EVA Hub, preserving the dated HTML snapshot if the request fails.
- `tests/interactions.test.cjs` — dependency-free tests for consolidation timing, reduced motion, and live-tab coordination. Run with `node --test tests/interactions.test.cjs`.
- `tests/eva-support.test.cjs` — checks stake-weighted totals, rounding, and fallback behavior. Run all tests with `node --test tests/*.test.cjs`.
- `assets/fonts/` — self-hosted WOFF2 fonts and their SIL OFL licenses.
- `assets/og*.png` — social sharing images; PNG is retained for crawler compatibility.
- `robots.txt`, `sitemap.xml`, `_headers` — search and hosting configuration.

## Content updates

When the proposal status changes, review the status section, visible update dates, and `sitemap.xml` in the same commit. When replacing social images, keep them at 1200×630 and 1080×1080 and verify the absolute metadata URLs. Preserve explicit image dimensions and test keyboard navigation, reduced-motion behavior, and the 320–1440 px responsive range before publishing.

## Validator signals

The `#validator-support` panel in Voices of support makes one anonymous GET to [EVA Hub’s EIP-8148 endpoint](https://api.ethva.net/eips/8148) per page load, with a six-second timeout and no cookies or referrer. This is the endpoint used by the public Hub client; no documented external API contract was found. It returned HTTP 200 and permitted CORS from both `https://eip8148.com` and the local preview on 2026-09-15. The production CSP permits connections only to this endpoint. Network errors, timeouts, and malformed responses preserve all six snapshot fields and their original check date. An explicitly unapproved proposal hides the panel.

Balances arrive in wei. The support percentage is `yesVoteBalance / (yesVoteBalance + noVoteBalance + abstainVoteBalance)`, calculated with BigInt before rounding. Signal counts are distinct from validator-key counts; the percentage refers only to participating stake. Zero participation displays a dash, and rounding must not turn partial support into 100%. The [EVA methodology](https://hub.ethva.net/methodology) describes these results as non-binding validator sentiment. The snapshot was checked on 2026-09-15 at 19:27 UTC: 9 yes / 49,330 ETH, 0 no, 0 abstain. Update all `data-eva-*` values and the check timestamp together when refreshing the static snapshot. Existing quotations are independent of this integration and must remain verbatim.

## Two-tab easter egg

Two live tabs of this site on the same origin and in the same browser profile slash the hero illustration: its balance stops, the fill turns red, and an explanation appears. BroadcastChannel performs a live handshake and Web Locks verifies that both documents still exist. No flag or tab list is stored in localStorage. Page exit releases the lock; restoring from the back/forward cache registers it again. Browsers without these APIs keep the normal illustration. After closing the other tab, reload to reset the illustration.
