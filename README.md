# Grailed Plus (V2)
Credit: Forked from [RVRX/grailed-plus](https://github.com/RVRX/grailed-plus).


## Project Overview

Enhance Grailed pages with a streamlined insights sidebar surfacing average and expected price-drop estimates, seller account age, one-click listing JSON metadata, automatic USD-to-selected-currency conversion and a site-wide dark mode with a customisable primary color

### Current Features

- Listing insights panel
- Average price drop
- Next expected drop estimate
- Seller account creation date
- Listing metadata button (opens listing JSON in a new tab)
- Automatic currency conversion (USD -> selected currency with tooltip original pricing shown on hover)
- Site-wide dark mode with customizable primary color

### Planned Features
- Depop/ebay autocomparison with like / matching listings (Possible ML image checking for like listings)
- ~Dark mode integration~ *Completed*
- ~Improved UI integration~ *Completed*
- Price trend graph view
- ~Updated logo and screenshots~ *Completed*
- ~Automatic currency conversion~ *Completed*
- Better inspect (hover inspect without clicking)
- ~better settings ui~ *Completed*

### Project Layout
- `src/manifest.json`: Chrome MV3 manifest
- `src/manifest.firefox.json`: Firefox MV3 manifest template for Phase 2
- `src/content/boot.js`: lifecycle + route transition handling
- `src/data/listingExtractor.js`: `__NEXT_DATA__` extraction + listing normalization
- `src/domain/pricingInsights.js`: pricing trend and expected-drop calculations
- `src/domain/settings.js`: selected currency persistence helpers
- `src/domain/currency.js`: exchange-rate cache + conversion helpers
- `src/domain/url.js`: listing URL parsing helpers
- `src/ui/renderInsightsPanel.js`: listing insights panel rendering + mount heuristics
- `src/ui/theme.js`: site-wide dark-mode attribute + CSS variable application
- `src/ui.css`: shared popup/options extension UI styles aligned with insights panel theme
- `src/options.html`: extension settings page
- `src/options.js`: currency settings UI logic
- `src/contentScript.js`: generated content-script bundle

### Scripts
- `npm run build`: rebuilds `src/contentScript.js` from modules
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

## Dark Mode Settings
1. Open **Grailed Plus Settings**.
2. Turn on **Enable site-wide dark mode**.
3. Choose behavior:
   - `Match device theme` (default)
   - `Permanent dark mode`
4. Choose a primary color (picker or hex value, default `#000000`).
5. Save and refresh open Grailed tabs.

Notes:
- Dark mode applies across `grailed.com` pages.
- Implementation is CSS-first and inverts most page colors.
- A smooth, fixed-position gradient depth tint is applied site-wide when a non-default custom color is selected.
- Custom color selection controls hue only; tint brightness is fixed for consistent dark contrast.
- Overscroll/backdrop remains pure black in dark mode.
- Default custom color `#000000` keeps the extra tint disabled.
- Images and media are counter-filtered to stay visually intact.
- Defaults: dark mode enabled + behavior set to `Match device theme`.
- Refresh open tabs after changing dark-mode settings.
