# Grailed Plus 2.1.0-beta.0 Release Notes

Release date: March 5, 2026

## Highlights
- Reframed the extension around a broader **Listing Insights** experience.
- Renamed generated content assets to `contentScript.js` and `contentScript.css`.
- Updated listing panel terminology from **Price History** to **Price Trend**.

## Refactors
- Renamed core modules:
  - `listingAdapter` -> `listingModel`
  - `extractListing` -> `listingExtractor`
  - `metrics` -> `pricingInsights`
  - `renderPanel` -> `renderInsightsPanel`
- Updated normalized listing model shape:
  - `priceDrops` -> `pricing.history`
  - `priceUpdatedAt` -> `pricing.updatedAt`

## Settings and Storage
- Renamed settings toggle to **Listing Insights**.
- New storage key:
  - `grailed_plus_listing_insights_enabled_v1`
- Hard cutover behavior:
  - Legacy `grailed_plus_price_history_enabled_v1` is intentionally ignored.

## Runtime Stability
- Added compatibility fallbacks in boot/runtime wiring so content features still initialize when older/newer module names are mixed during extension reload transitions.

## Verification
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run zip:chrome`
