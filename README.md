# Grailed Plus (V2)

Credit: Forked from [RVRX/grailed-plus](https://github.com/RVRX/grailed-plus).

Grailed Plus restores price-history insights on modern grailed.com listing pages.

## Extension Store Description
### Project Overview

Grailed Plus adds pricing intelligence back to Grailed listing pages. It reads listing data directly from the page and shows useful context in a clean sidebar panel so buyers and sellers can make faster decisions.


### Current Features

- Price history
- Average price drop
- Next expected drop estimate
- Seller account creation date
- Listing metadata button (opens listing JSON in a new tab)
- Automatic currency conversion (USD -> selected currency with tooltip original pricing shown on hover)

## Planned Features
- Depop autocomparison with like / matching listings (Possible ML image checking for like listings)
- Dark mode integration
- ~Improved UI integration~ *Completed*
- Price History graph view
- Updated logo and screenshots
- ~Automatic currency conversion~ *Completed*

## Project Layout
- `src/manifest.json`: Chrome MV3 manifest
- `src/manifest.firefox.json`: Firefox MV3 manifest template for Phase 2
- `src/content/boot.js`: lifecycle + route transition handling
- `src/data/extractListing.js`: `__NEXT_DATA__` extraction + listing normalization
- `src/domain/metrics.js`: pricing and expected-drop calculations
- `src/domain/settings.js`: selected currency persistence helpers
- `src/domain/currency.js`: exchange-rate cache + conversion helpers
- `src/domain/url.js`: listing URL parsing helpers
- `src/ui/renderPanel.js`: panel rendering + mount heuristics
- `src/options.html`: extension settings page
- `src/options.js`: currency settings UI logic
- `src/priceHistory.js`: generated content-script bundle

## Scripts
- `npm run build`: rebuilds `src/priceHistory.js` from modules
- `npm run test`: runs unit tests
- `npm run lint`: syntax checks for source and tests
- `npm run zip:chrome`: build + package a Chrome sideload zip into `artifacts/`
- `npm run release:chrome`: lint + test + build/package Chrome release zip

## Chrome Sideload Instructions
1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `src/` directory.
5. Open a Grailed listing URL (`https://www.grailed.com/listings/...`) and verify panel rendering.

## Currency Settings
1. Click the Grailed Plus extension icon.
2. Click **Open Settings** from the popup (or use **Extension options** in `chrome://extensions`).
3. Select a curated currency or enter a custom 3-letter code and save.
4. Turn on **Enable currency conversion** (it is disabled by default).
5. Refresh open listing tabs to apply the new currency.

Notes:
- Exchange rates are fetched from Frankfurter (`https://api.frankfurter.app/latest?base=USD`).
- Rates are cached in `chrome.storage.local` for 1 hour.
- If network fetch fails, stale cache is used when available; otherwise values remain in USD.
