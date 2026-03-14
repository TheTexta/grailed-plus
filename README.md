# Grailed Plus (V2)

Credit: Forked from [RVRX/grailed-plus](https://github.com/RVRX/grailed-plus).

Grailed Plus enhances Grailed listing pages with fast, decision-ready marketplace context: pricing intelligence, seller metadata, listing JSON access, optional currency conversion, and site-wide dark mode controls.

## Why Grailed Plus

Grailed Plus is built for in-flow browsing. Instead of opening extra tabs or doing manual lookups, it surfaces practical listing context directly where you already shop:

- Price movement signals to evaluate value quickly
- Seller account age for trust context
- One-click listing metadata inspection
- Optional USD conversion into your selected currency
- Grailed-wide dark mode with configurable primary color

## Current Feature Set

### Listing Intelligence

- Listing insights panel injected on Grailed listing pages
- Average price-drop signal
- Next expected drop estimate
- Price trend work is partially completed

### Seller and Metadata Context

- Seller account creation date
- Metadata button that opens listing JSON in a new tab

### Currency Conversion

- Automatic conversion from USD to your selected currency
- Original USD value preserved in hover tooltip
- Conversion is configurable and can be toggled on/off in settings

### Site-wide Dark Mode

- Dark mode that applies across Grailed pages
- Theme behavior options:
  - Match device theme (default)
  - Permanent dark mode
- Customizable primary color
- Default behavior ships with dark mode enabled

## Roadmap

### In Progress / Partial

- Price trend graph view

### Planned

- Depop and eBay auto-comparison for similar/matching listings
- Better inspect flow (hover inspect without clicking)
- Potential ML-assisted image matching for closer listing similarity

### Already Completed (Previously Planned)

- Dark mode integration
- Improved UI integration
- Updated logo and screenshots
- Automatic currency conversion
- Improved settings UI

## Project Layout

- src/manifest.json: Chrome MV3 manifest
- src/manifest.firefox.json: Firefox MV3 manifest template (Phase 2)
- src/content/boot.js: Lifecycle and route transition handling
- src/data/listingExtractor.js: NEXT data extraction and listing normalization
- src/domain/pricingInsights.js: Pricing trend and expected-drop calculations
- src/domain/settings.js: Selected currency persistence helpers
- src/domain/currency.js: Exchange-rate cache and conversion helpers
- src/domain/url.js: Listing URL parsing helpers
- src/ui/renderInsightsPanel.js: Insights panel rendering and mount heuristics
- src/ui/theme.js: Dark-mode attribute and CSS variable application
- src/ui.css: Shared extension UI styles
- src/options.html: Extension settings page
- src/options.js: Settings UI logic
- src/contentScript.js: Generated content-script bundle

## Scripts

- npm run build  
  Rebuilds src/contentScript.js from modules.

- npm run test  
  Runs unit tests.

- npm run lint  
  Runs syntax checks for source and tests.

- npm run zip:chrome  
  Builds and packages a Chrome sideload zip into artifacts.

- npm run release:chrome  
  Runs lint and tests, then builds/packages a Chrome release zip.

## Chrome Sideload Setup

1. Run npm run build.
2. Open chrome://extensions.
3. Enable Developer mode.
4. Click Load unpacked and select the src directory.
5. Open a Grailed listing URL like https://www.grailed.com/listings/... and verify panel rendering.

## Currency Settings

1. Click the Grailed Plus extension icon.
2. Open Settings from the popup, or use Extension options in chrome://extensions.
3. Select a curated currency or enter a custom 3-letter code, then save.
4. Enable currency conversion (disabled by default).
5. Refresh open listing tabs to apply changes.

### Currency Notes

- Exchange rates are fetched from Frankfurter: https://api.frankfurter.app/latest?base=USD
- Rates are cached in chrome.storage.local for 1 hour.
- If network fetch fails, stale cache is used when available.
- If neither network nor cache is available, values remain in USD.

## Dark Mode Settings

1. Open Grailed Plus Settings.
2. Enable site-wide dark mode.
3. Choose behavior:
   - Match device theme (default)
   - Permanent dark mode
4. Choose a primary color using picker or hex value (default: #000000).
5. Save and refresh open Grailed tabs.

### Dark Mode Notes

- Applies across grailed.com pages.
- CSS-first implementation that inverts most page colors.
- Non-default primary colors enable a smooth fixed-position gradient depth tint site-wide.
- Color selection controls hue; tint brightness remains fixed for consistent contrast.
- Overscroll and backdrop remain pure black in dark mode.
- Images and media are counter-filtered to preserve visual fidelity.
- Default custom color #000000 keeps extra tint disabled.

## Browser Support

- Chrome Manifest V3 is the active target.
- Firefox manifest template exists for Phase 2 progression.

## Status

Grailed Plus V2 currently delivers pricing insights, seller data, metadata access, custom currency conversion, and integrated dark mode with configurable theming.
