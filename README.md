# EIP-8148 landing page

Production source for [eip8148.com](https://eip8148.com/). The site is intentionally buildless: it uses semantic HTML, plain CSS, and a small progressive-enhancement script, with no package manager, framework, analytics, or runtime dependency.

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
- `tests/interactions.test.cjs` — dependency-free tests for consolidation timing, reduced motion, and live-tab coordination. Run with `node --test tests/interactions.test.cjs`.
- `assets/fonts/` — self-hosted WOFF2 fonts and their SIL OFL licenses.
- `assets/og*.png` — social sharing images; PNG is retained for crawler compatibility.
- `robots.txt`, `sitemap.xml`, `_headers` — search and hosting configuration.

## Content updates

When the proposal status changes, review the status section, visible update dates, and `sitemap.xml` in the same commit. When replacing social images, keep them at 1200×630 and 1080×1080 and verify the absolute metadata URLs. Preserve explicit image dimensions and test keyboard navigation, reduced-motion behavior, and the 320–1440 px responsive range before publishing.

## Two-tab easter egg

Two live tabs of this site on the same origin and in the same browser profile slash the hero illustration: its balance stops, the fill turns red, and an explanation appears. BroadcastChannel performs a live handshake and Web Locks verifies that both documents still exist. No flag or tab list is stored in localStorage. Page exit releases the lock; restoring from the back/forward cache registers it again. Browsers without these APIs keep the normal illustration. After closing the other tab, reload to reset the illustration.
