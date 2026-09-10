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
- `assets/simulation.js` — optional hero simulation and mobile-menu enhancement.
- `assets/fonts/` — self-hosted WOFF2 fonts and their SIL OFL licenses.
- `assets/og*.png` — social sharing images; PNG is retained for crawler compatibility.
- `robots.txt`, `sitemap.xml`, `_headers` — search and hosting configuration.

## Content updates

When the proposal status changes, review the status section, visible update dates, and `sitemap.xml` in the same commit. When replacing social images, keep them at 1200×630 and 1080×1080 and verify the absolute metadata URLs. Preserve explicit image dimensions and test keyboard navigation, reduced-motion behavior, and the 320–1440 px responsive range before publishing.
