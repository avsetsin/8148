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

## Public quotations

Add verified public comments to the `#voices` list using the existing `.voice` figure, a stable permalink, a compact author byline, and a dated source link. Preserve the original words, punctuation, capitalization, and spelling. Choose complete arguments without shortening them to fit a character limit, and keep editorial text outside the blockquote. Forum excerpts retain their CC BY-NC-SA 3.0 attribution in the footer.

The Blockdaemon entry uses the opening of its [15 September 2026 comment](https://ethereum-magicians.org/t/eip-8148-custom-sweep-threshold-for-validators/27669/13), checked on 16 September: explicit support followed by institutional clients’ demand for predictable, automatic rewards. The excerpt is contiguous and ends after “automatic stream.” Line-wrapped fragments are joined into two paragraphs; the words and punctuation are unchanged.

All twelve displayed excerpts were checked against the forum on 16 November 2026, including the posts beyond the first twenty returned on the topic’s first API page. Each excerpt matches contiguous source text, allowing only HTML whitespace and paragraph layout to differ. [Rocket Pool’s 17 September comment](https://ethereum-magicians.org/t/eip-8148-custom-sweep-threshold-for-validators/27669/14) retains both the core team’s support and its qualification about design work. [Launchnodes’ comment](https://ethereum-magicians.org/t/eip-8148-custom-sweep-threshold-for-validators/27669/15) explains how thresholds can reflect operators’ liquidity and risk requirements. [P2P.org’s comment](https://ethereum-magicians.org/t/eip-8148-custom-sweep-threshold-for-validators/27669/16) gives its complete closing argument about reward delivery preventing consolidation to 512 or 1024 ETH per validator; the existing `#voice-amir` permalink is preserved.

The November update adds [Everstake, 24 September](https://ethereum-magicians.org/t/eip-8148-custom-sweep-threshold-for-validators/27669/19), [mitsuhitokawada, 12 October](https://ethereum-magicians.org/t/eip-8148-custom-sweep-threshold-for-validators/27669/21), [MixBytes, 14 October](https://ethereum-magicians.org/t/eip-8148-custom-sweep-threshold-for-validators/27669/22), and [Quat Capital, 16 October](https://ethereum-magicians.org/t/eip-8148-custom-sweep-threshold-for-validators/27669/23). RockX and quiqsilver were reviewed but omitted from the compact selection because their arguments repeat Everstake and P2P.org. Quat Capital is the forum display name of `2xStake`; its excerpt is the complete geographic-decentralization argument. The [ack3 comment](https://ethereum-magicians.org/t/eip-8148-custom-sweep-threshold-for-validators/27669/24) also supports the proposal but raises a consolidation concern; it is not used as an unqualified endorsement. The page’s stake-adjustment instructions already explain that deposits and consolidated balances above a threshold can be swept. The forum’s [terms, section 3](https://ethereum-magicians.org/tos) confirm the CC BY-NC-SA 3.0 license used in the footer.

## Hegotá status and implementation

EIP-8148 moved to Considered for Inclusion (CFI) at [ACDC #190 on 29 October 2026](https://forkcast.org/calls/acdc/190/#t=5254). Forkcast’s [EIP history](https://forkcast.org/api/eips/8148.json) and [meeting decisions](https://forkcast.org/artifacts/acdc/2026-10-29_190/key_decisions.json) confirm the transition. As checked on 16 November, [EIP-8081](https://eips.ethereum.org/EIPS/eip-8081) still lists it under PFI, so the landing page cites the actual decision. CFI does not mean Scheduled for Inclusion (SFI), and the EIP document’s separate lifecycle status remains Draft.

The latest [EIP consensus-layer design](https://eips.ethereum.org/EIPS/eip-8148#consensus-layer), merged in [EIPs #12598](https://github.com/ethereum/EIPs/pull/12598) on 30 October, stores the threshold in bytes 1–2 of compounding withdrawal credentials, as a little-endian uint16 in 1 ETH units; zero encodes the 2,048 ETH default. It adds no field to `BeaconState` or `Validator`. The published consensus-specs feature still uses a separate list and deposit bytes 10–11; [consensus-specs #5790](https://github.com/ethereum/consensus-specs/pull/5790) is open to align it. Keep this distinction visible until that work lands. Credential proof verifiers should follow the EIP’s [compatibility guidance](https://eips.ethereum.org/EIPS/eip-8148#usage-of-the-previously-unused-bytes-in-compounding-withdrawal-credentials) about comparing prefix and execution address.

The [Prysm](https://github.com/OffchainLabs/prysm/pull/17338), [Geth](https://github.com/nalepae/go-ethereum/pull/1), and [Dora explorer](https://github.com/nalepae/dora/pull/1) prototype PRs remain open and unmerged, as does [sys-asm #54](https://github.com/ethereum/sys-asm/pull/54). Prysm’s prototype includes a Kurtosis configuration but targets Gloas rather than Heze. The page therefore labels these proofs of concept and leaves multi-client devnet testing pending. The old [spec tests PR #5565](https://github.com/ethereum/consensus-specs/pull/5565) was closed without merging; do not claim those tests were accepted. The support CTA now directs client developers to implementation review.

## Hegotá priorities

The compact `#client-priorities` panel lists selected client and staking-protocol rankings for EIP-8148 in one row per team. Its heading is “Hegotá priorities” and the existing section anchor is preserved. Keep each grade, date, and source attached to its team, and preserve permalinks for retained entries. Teku’s A tier is listed on [Forkcast](https://forkcast.org/upgrade/hegota/client-priority/) with a 10 September 2026 date. Prysm’s A tier comes from its [team rationale](https://hackmd.io/@ttsao/prysm-view-hegota), updated 15 September, which describes its prototype, technical feasibility assessment, and support for inclusion. Rankings express priorities for Hegotá; they are not a decision to include the EIP.

Lido contributors’ A tier is supported by their [16 September forum post](https://ethereum-magicians.org/t/eip-8081-hegota-network-upgrade-meta-thread/26876/16), which includes a disclosure that EIP-8148 is authored by Lido contributors. Nimbus’ C tier is stated in its [16 September ACDC agenda comment](https://github.com/ethereum/pm/issues/2222#issuecomment-5700405295). All four displayed ratings and dates were rechecked against Forkcast’s public data on 16 November 2026 and remain unchanged. These are selected priorities, not a claim of consensus across client teams. The Nimbus source was also checked directly; its encoded ranking places 8148 in C.

Lodestar’s C rating is excluded from this panel because its [official position](https://blog.chainsafe.io/lodestars-position-on-hegota/) places EIP-8148 under “Looking beyond Hegota”, using a separate scale for future forks. It must not be presented as support for inclusion in Hegotá.

## Validator signals

The `#validator-support` panel in Voices of support makes one anonymous GET to [EVA Hub’s EIP-8148 endpoint](https://api.ethva.net/eips/8148) per page load, with a six-second timeout and no cookies or referrer. This is the endpoint used by the public Hub client; no documented external API contract was found. It returned HTTP 200 and permitted CORS from both `https://eip8148.com` and the local preview on 2026-09-15. The production CSP permits connections only to this endpoint. Network errors, timeouts, and malformed responses preserve all six snapshot fields and their original check date. An explicitly unapproved proposal hides the panel.

Balances arrive in wei. The support percentage is `yesVoteBalance / (yesVoteBalance + noVoteBalance + abstainVoteBalance)`, calculated with BigInt before rounding. Signal counts are distinct from validator-key counts; the percentage refers only to participating stake. Zero participation displays a dash, and rounding must not turn partial support into 100%. The [EVA methodology](https://hub.ethva.net/methodology) describes these results as non-binding validator sentiment. The snapshot was checked on 2026-11-16 at 09:16:37 UTC: 11 yes / 50,220 ETH, 0 no, 0 abstain; 100% of participating stake supports the proposal. The API returned `approved: true` and `signalingOpen: true`, HTTP 200, and allowed the production origin through CORS. Update all `data-eva-*` values and the check timestamp together when refreshing the static snapshot. Existing quotations are independent of this integration and must remain verbatim.

## Two-tab easter egg

Two live tabs of this site on the same origin and in the same browser profile slash the hero illustration: its balance stops, the fill turns red, and an explanation appears. BroadcastChannel performs a live handshake and Web Locks verifies that both documents still exist. No flag or tab list is stored in localStorage. Page exit releases the lock; restoring from the back/forward cache registers it again. Browsers without these APIs keep the normal illustration. After closing the other tab, reload to reset the illustration.
