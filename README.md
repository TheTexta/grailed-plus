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

# Grailed Plus

A browser extension that enhances your Grailed experience with powerful pricing insights, cross-market comparisons, and a clean, native UI.

## Features

- **Depop Price Comparison (NEW)**
  - Instantly compare Grailed listings with similar items on Depop.
  - Real-time Depop pricing data shown directly on Grailed listing pages.
  - Make smarter buying and selling decisions with cross-market context.

- **Refreshed Injected UI (NEW)**
  - All extension UI components now feature a minimalist, data-dense design.
  - Improved clarity, hierarchy, and consistency with Grailed’s native look.
  - Full support for both light and dark modes.

- **Grailed Market Insights**
  - View historical price trends for any listing.
  - See recent sales, price drops, and seller context at a glance.

- **Seller and Metadata Context**
  - Seller account creation date for trust context.
  - One-click listing metadata inspection (view listing JSON).

- **Currency Conversion**
  - Automatic conversion from USD to your selected currency.
  - Original USD value preserved in hover tooltip.
  - Configurable and can be toggled on/off in settings.

- **Site-wide Dark Mode**
  - Applies across Grailed pages.
  - Match device theme or set permanent dark mode.
  - Customizable primary color.

## Installation

1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Build the extension with `npm run build`.
4. Load the extension into your browser (see your browser’s extension documentation).

## Usage

- Browse Grailed as usual.
- On any listing page, view Depop price comparisons and enhanced market insights.
- All features are available in both light and dark mode.

## Settings

### Currency
1. Click the Grailed Plus extension icon.
2. Open Settings from the popup, or use Extension options in chrome://extensions.
3. Select a curated currency or enter a custom 3-letter code, then save.
4. Enable currency conversion (disabled by default).
5. Refresh open listing tabs to apply changes.

*Exchange rates are fetched from Frankfurter (https://api.frankfurter.app/latest?base=USD) and cached for 1 hour. If unavailable, values remain in USD.*

### Dark Mode
1. Open Grailed Plus Settings.
2. Enable site-wide dark mode.
3. Choose behavior: match device theme (default) or permanent dark mode.
4. Choose a primary color (default: #000000).
5. Save and refresh open Grailed tabs.

*Dark mode uses a CSS-first approach for high contrast and fidelity. Images/media are counter-filtered to preserve appearance.*

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

- `npm run build` – Rebuilds src/contentScript.js from modules.
- `npm run test` – Runs unit tests.
- `npm run lint` – Runs syntax checks for source and tests.
- `npm run zip:chrome` – Builds and packages a Chrome sideload zip into artifacts.
- `npm run release:chrome` – Runs lint and tests, then builds/packages a Chrome release zip.

## Chrome Sideload Setup

1. Run `npm run build`.
2. Open chrome://extensions.
3. Enable Developer mode.
4. Click Load unpacked and select the src directory.
5. Open a Grailed listing URL like https://www.grailed.com/listings/... and verify panel rendering.

## Browser Support

- Chrome Manifest V3 is the active target.
- Firefox manifest template exists for Phase 2 progression.

## Contributing

1. Fork the repo and create your branch: `git checkout -b feature/your-feature`
2. Commit your changes: `git commit -am 'Add new feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Open a pull request.

## License

MIT
- Default custom color #000000 keeps extra tint disabled.
