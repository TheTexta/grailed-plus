# Grailed Plus (Chrome MV3 Beta)

Credit: Forked from [RVRX/grailed-plus](https://github.com/RVRX/grailed-plus).

Grailed Plus restores price-history insights on modern grailed.com listing pages.

## Current Beta Features
- Price history
- Average price drop
- Next expected drop estimate
- Seller account creation date
- Listing metadata button (opens JSON in a new tab)
- SPA-safe re-rendering on client-side route changes

## Planned Features
- Depop autocomparison with like / matching listings
- Dark mode integration
- Improved UI integration

## Project Layout
- `src/manifest.json`: Chrome MV3 manifest (primary beta target)
- `src/manifest.firefox.json`: Firefox MV3 manifest template for Phase 2
- `src/content/boot.js`: lifecycle + route transition handling
- `src/data/extractListing.js`: `__NEXT_DATA__` extraction + listing normalization
- `src/domain/metrics.js`: pricing and expected-drop calculations
- `src/domain/url.js`: listing URL parsing helpers
- `src/ui/renderPanel.js`: panel rendering + mount heuristics
- `src/priceHistory.js`: generated content-script bundle

## Scripts
- `npm run build`: rebuilds `src/priceHistory.js` from modules
- `npm run test`: runs unit tests
- `npm run lint`: syntax checks for source and tests
- `npm run zip:chrome`: build + package a Chrome sideload zip into `artifacts/`

## Chrome Sideload Beta
1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `src/` directory.
5. Open a Grailed listing URL (`https://www.grailed.com/listings/...`) and verify panel rendering.

## Manual Regression Checklist
- Listing with multiple price drops renders all metrics.
- Listing with zero price drops shows graceful fallback text.
- Seller creation date appears when available.
- Metadata button opens JSON payload.
- Navigating between listing pages without full reload re-renders once (no duplicate panels).
- Non-listing pages show no Grailed Plus panel.

## Notes
- This beta intentionally uses page bootstrap data (`__NEXT_DATA__`) only.
- Firefox rollout is planned after Chrome beta stabilization.
