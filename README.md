
# Grailed Plus (V2)

## 🚀 Feature Quick Reference

| Feature                        | Description                                                      |
|--------------------------------|------------------------------------------------------------------|
| Listing Insights Panel         | Injects price trends, drops, and seller context on listings       |
| Depop Market Compare           | Depop reranking with local MobileCLIP-S1 image similarity        |
| Seller Metadata                | Shows seller account age and trust context                       |
| One-click Metadata Inspection  | View raw listing JSON directly                                   |
| Currency Conversion            | USD→local currency, configurable, Frankfurter API                |
| Site-wide Dark Mode            | CSS-driven, device/permanent, custom primary color               |
| Minimalist UI                  | Data-dense, native-feeling, light/dark support                   |
| Modular Bootstrapping          | Lifecycle-based feature loading                                  |
| Settings Management            | Currency, theme, feature toggles                                 |
| Query Synthesis                | Generates search queries for cross-market providers               |
| Browser Storage Abstraction    | Unified storage for settings and state                           |


Credit: Price history project forked from [RVRX/grailed-plus](https://github.com/RVRX/grailed-plus).

Grailed Plus enhances Grailed listing pages with fast, decision-ready marketplace context: pricing intelligence, seller metadata, listing JSON access, optional currency conversion, site-wide dark mode controls, and local ML reranking for Depop market compare.


## 🏗️ Technical Architecture Overview

Grailed Plus uses a modular, lifecycle-driven architecture:
- **Bootstrapping:** Features are loaded based on URL and DOM state via a central registry.
- **Lifecycles:** Each feature (insights, currency, dark mode, etc.) is encapsulated in its own lifecycle module for maintainability and extensibility.
- **Settings & Storage:** User preferences are managed via a browser storage abstraction, supporting easy configuration and persistence.

## Why Grailed Plus

Grailed Plus is built for in-flow browsing. Instead of opening extra tabs or doing manual lookups, it surfaces practical listing context directly where you already shop:

- Price movement signals to evaluate value quickly
- Seller account age for trust context
- One-click listing metadata inspection
- Optional USD conversion into your selected currency
- Local MobileCLIP-S1 visual similarity for small-set Depop reranking
- Grailed-wide dark mode with configurable primary color


## 🧩 Extensibility & Contribution

- Add new features by creating a new lifecycle module in `src/content/` and registering it in the bootstrapper.
- UI components are modular and styled via `src/ui.css` for consistency.
- Settings and storage utilities are reusable for new feature toggles.


# Grailed Plus

A browser extension that enhances your Grailed experience with powerful pricing insights, cross-market comparisons, and a clean, native UI.


## 🌟 Features (Detailed)

## Recent Changes

This session shipped the first real ML image-matching upgrade for Market Compare:

- MobileCLIP-S1 ONNX embeddings are now the primary image-similarity signal for Depop reranking.
- ONNX Runtime Web and the MobileCLIP-S1 vision model are bundled with the extension package and loaded locally.
- The old thumbnail fingerprint path remains as the automatic fallback, with the legacy URL heuristic retained as a last resort.
- The options page now includes `Use ML visual similarity when available`, enabled by default.
- The Market Compare panel can show `ML Sorted` when the displayed results were all ranked through the embedding path.

Supporting documentation:

- [docs/market-compare-image-similarity.md](/Users/dexteryoung/Git%20Repos/grailed-plus/docs/market-compare-image-similarity.md)
- [src/vendor/THIRD_PARTY_NOTICES.md](/Users/dexteryoung/Git%20Repos/grailed-plus/src/vendor/THIRD_PARTY_NOTICES.md)

- **Depop Price Comparison (NEW)**
  - Instantly compare Grailed listings with similar items on Depop.
  - Local MobileCLIP-S1 image embeddings rerank Depop search-result thumbnails inside the browser.
  - Falls back to local thumbnail fingerprints and then a URL heuristic if ML inference is cold or unavailable.
  - Make smarter buying and selling decisions with cross-market context.

- **Seller and Metadata Context**
  - Seller account creation date for trust context.
  - View historical price trends for any listing.
  - Listing metadata inspection.

- **Currency Conversion**
  - Conversion from USD to selected currency.
  - Original USD value preserved in hover tooltip.
  - Configurable in settings.

- **Site-wide Dark Mode**
  - Applies across Grailed pages.
  - Match device theme or set permanent dark mode.
  - Customizable primary color.


## 🧪 Testing & Debugging

- **Unit tests:** Run with `npm run test` (see `tests/` for coverage of core modules).
- **Linting:** Run with `npm run lint` for code quality.
- **Live E2E validation:** Use `npm run e2e:live:grailed` to verify extension behavior on real Grailed listings.
- **Debugging:** Use browser devtools and extension logs for troubleshooting.

## 🔌 API & Integration Details

- **Frankfurter API** for currency conversion: https://api.frankfurter.app/latest?base=USD
- **Depop integration** for cross-market price comparison (see `src/domain/depopProvider.ts`).

1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Build the extension with `npm run build`.
4. Load the extension into your browser (see your browser’s extension documentation).

## Usage

- Browse Grailed as usual.
- On any listing page, view Depop price comparisons and enhanced market insights.
- All features are available in both light and dark mode.
- Market Compare uses only the Grailed listing image and Depop search-result thumbnails; it does not fetch each candidate listing page just to score similarity.
- When all displayed Market Compare results were ranked by the embedding pipeline, the panel shows `ML Sorted`.


## ⚙️ Settings Reference

| Setting           | Description                                 | Location/How to Change                |
|-------------------|---------------------------------------------|---------------------------------------|
| Currency          | Select or enter 3-letter code, enable/disable| Extension popup > Settings            |
| Dark Mode         | Enable, match device, or permanent, color   | Extension popup > Settings            |
| Depop Comparison  | Toggle feature, formula, strict mode, count | Extension popup > Settings            |
| Market Compare ML | Toggle local MobileCLIP similarity with fallback | Extension popup > Settings        |


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

### Market Compare Image Similarity
1. Open Grailed Plus Settings.
2. Enable market compare and leave `Use ML visual similarity when available` on to use the local MobileCLIP-S1 reranker.
3. Trigger compare from a Grailed listing page.
4. The first compare in a cold tab may use the fingerprint fallback while the model warms in the background.

*The model and ONNX Runtime WASM assets are bundled with the extension. No CDN or remote model download is used.*


## 🗂️ Project Layout

- src/manifest.json: Generated Chrome MV3 manifest
- src/manifest.firefox.json: Generated Firefox MV3 manifest
- src/content/boot.js: Lifecycle and route transition handling
- src/data/listingExtractor.js: NEXT data extraction and listing normalization
- src/domain/pricingInsights.js: Pricing trend and expected-drop calculations
- scripts/release-lib.mjs: Shared manifest generation, staging, and package validation
- src/domain/settings.js: Selected currency persistence helpers
- src/domain/currency.js: Exchange-rate cache and conversion helpers
- src/domain/imageSimilarity.ts: MobileCLIP-S1 embeddings, fingerprint fallback, and image preprocessing
- src/domain/url.js: Listing URL parsing helpers
- src/ui/renderInsightsPanel.js: Insights panel rendering and mount heuristics
- src/ui/theme.js: Dark-mode attribute and CSS variable application
- src/ui.css: Shared extension UI styles
- src/options.html: Extension settings page
- src/options.js: Settings UI logic
- src/vendor/mobileclip-s1/: Vendored MobileCLIP-S1 ONNX vision model assets
- src/vendor/onnxruntime/: Vendored ONNX Runtime Web JS/WASM assets
- src/vendor/THIRD_PARTY_NOTICES.md: Provenance and license notes for vendored assets
- src/contentScript.js: Generated content-script bundle


## 🛠️ Scripts

- `npm run build` – Rebuilds src/contentScript.js from modules.
- `npm run test` – Runs unit tests.
- `npm run lint` – Runs syntax checks for source and tests.
- `npm run zip:chrome` – Builds, stages, validates, and packages a Chrome zip into artifacts.
- `npm run zip:firefox` – Builds, stages, validates, and packages a Firefox XPI into artifacts.
- `npm run source:firefox` – Stages a Firefox AMO source archive that excludes generated first-party build outputs.
- `npm run verify:firefox` – Runs `web-ext lint` against the staged Firefox package.
- `npm run release:chrome` – Runs lint and tests, then builds/packages a Chrome release zip.
- `npm run release:firefox` – Runs lint, tests, Firefox packaging, and Firefox verification.

Firefox add-on identity is sourced from `package.json` `firefoxExtensionId`. Use a unique value for the AMO listing you intend to publish.


## 🔧 Build Environment

Exact toolchain used to reproduce the Firefox release package:

- Operating system: macOS or Linux with a POSIX shell and `zip` available on `PATH`
- Node.js: `22.18.0` (see `.nvmrc`)
- npm: `11.11.0` (see `package.json` `packageManager` and `engines`)
- Firefox validation tool: `web-ext` is optional and only required for `npm run verify:firefox`

Installation notes:

1. Install Node.js `22.18.0`. If you use `nvm`, run `nvm install 22.18.0 && nvm use 22.18.0`.
2. Install npm `11.11.0` with `npm install -g npm@11.11.0` if your Node install ships a different npm version.
3. Ensure the `zip` CLI is installed. On macOS it is preinstalled; on Ubuntu/Debian use `sudo apt install zip`.
4. Optional AMO validation: install `web-ext` with `npm install -g web-ext` or add it locally before `npm run verify:firefox`.


## 🦊 Firefox AMO Source Submission

The AMO source upload should use the source archive created by `npm run source:firefox`, not the built `.xpi`.

The source archive intentionally excludes generated first-party build outputs:

- `src/contentScript.js`
- `src/contentScript.css`
- `src/background.js`
- `src/options.js`
- `src/popup.js`
- `src/domain/browserStorage.js`
- `src/domain/settings.js`
- `src/domain/currency.js`
- `src/manifest.json`
- `src/manifest.firefox.json`

These files are recreated from the original source and build scripts.

The source archive also includes the vendored MobileCLIP-S1 model assets, ONNX Runtime Web assets, and `[src/vendor/THIRD_PARTY_NOTICES.md](/Users/dexteryoung/Git Repos/grailed-plus/src/vendor/THIRD_PARTY_NOTICES.md)` for provenance and licensing.

Step-by-step exact Firefox build:

1. Clone the repository.
2. Install the required toolchain from the Build Environment section above.
3. Run `npm ci`.
4. Run `npm run lint`.
5. Run `npm test`.
6. Run `npm run zip:firefox`.
7. Optional but recommended: run `npm run verify:firefox`.

Expected Firefox build outputs:

- `artifacts/staging/firefox/`
- `artifacts/grailed-plus-firefox.xpi`

AMO source-upload package:

1. Run `npm run source:firefox`.
2. Upload `artifacts/grailed-plus-firefox-source.zip` as the source package.


## 🧑‍💻 Chrome Sideload Setup

1. Run `npm run build`.
2. Open chrome://extensions.
3. Enable Developer mode.
4. Click Load unpacked and select the src directory.
5. Open a Grailed listing URL like https://www.grailed.com/listings/... and verify panel rendering.


## 🌐 Browser Support

- Chrome Manifest V3 sideload packaging is supported.
- Firefox desktop packaging is supported with a dedicated MV3 manifest and XPI output.
- Firefox verification requires a local or global `web-ext` install.


## 🤝 Contributing

1. Fork the repo and create your branch: `git checkout -b feature/your-feature`
2. Commit your changes: `git commit -am 'Add new feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Open a pull request.


## 📝 Roadmap & Known Limitations

- [ ] Capture fresh Firefox AMO screenshots before store submission
- [ ] Additional cross-market integrations (e.g., eBay)
- [ ] Collapsible menus and auto collapse price history when no data available.
- [ ] auto prefetch depop comparisons toggle
