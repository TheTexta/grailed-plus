# Firefox AMO Listing Copy

Last updated: March 17, 2026

## Summary

Grailed listing insights, Depop comparison, local ML visual reranking, currency conversion, and dark mode in one Firefox add-on.

## Description

Grailed Plus adds decision-ready context directly to Grailed listing pages:

- listing price history and expected drop signals
- seller account age and listing metadata access
- Depop market compare results with local MobileCLIP thumbnail-embedding reranking
- a visible `ML Sorted` panel label when the displayed results all used the embedding path
- optional currency conversion using Frankfurter exchange rates
- Grailed-wide dark mode controls

The extension is built for in-flow browsing. It keeps pricing context, cross-market checks, and display controls inside the Grailed page instead of sending you through extra tabs and manual lookups.

## Permissions Justification

- `storage`: save user settings for currency, dark mode, and market compare preferences
- `https://*.grailed.com/*`: read the active Grailed listing page and render extension UI
- `https://*.depop.com/*`: fetch Depop search results and thumbnails for market compare
- `https://api.frankfurter.app/latest*`: fetch exchange rates for optional currency conversion

## Reviewer Notes

Grailed Plus does not inject or execute remote code.

Remote requests are limited to:

- Grailed page context already visible in the active tab
- Depop search HTML/API responses used for market compare
- Depop thumbnail bytes used for local similarity scoring
- Frankfurter exchange-rate JSON for optional currency conversion

Market Compare image similarity runs locally in the content script with bundled assets:

- MobileCLIP-S1 ONNX vision model shipped inside the extension package
- ONNX Runtime Web JavaScript/WASM files shipped inside the extension package
- fallback to local thumbnail fingerprints when the ML session is still cold or unavailable
- `ML Sorted` is shown only when the displayed results were actually embedding-ranked

No model files or runtime code are downloaded from a CDN at runtime.

## Screenshot Checklist

Capture fresh Firefox desktop screenshots for:

1. A Grailed listing page with the insights panel visible.
2. The browser action popup with the settings button visible.
3. The options page with market compare and dark mode settings visible.

Planned filenames are documented in `[docs/firefox-screenshots/README.md](/Users/dexteryoung/Git Repos/grailed-plus/docs/firefox-screenshots/README.md)`.
