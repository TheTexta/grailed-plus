## Depop Expansion: What Was Actually Implemented (v1 Retrospective)

This document replaces the original v1 plan with what was eventually shipped in code, plus a clear list of work that still needs implementation.

Date: 2026-03-14

## Outcome Summary

Status: Partially shipped.

Implemented:
- A real Depop comparison flow exists and is user-triggered from the listing panel.
- Hybrid retrieval works (HTML parse first, API fallback, and runtime background bridge path).
- Ranking, score display, and price-delta output are live.
- Strict single-flight behavior per listing is implemented.
- Core error mapping and retry messaging are implemented.
- Host permissions and background fetch guardrails are implemented.

Not yet fully implemented:
- No dedicated market-compare settings keys in settings/options UI.
- No standalone market cache module with planned schema-version keying.
- No disabled-by-default rollout kill switch dedicated to market compare.
- v1.1 UX items (sorting/filtering/why-this-match popover) remain unimplemented.

## Implemented Architecture (Actual)

### Shipped modules

Implemented:
- src/domain/marketProviders.ts
  - Provider registry, provider normalization, search cache, and in-flight de-duplication.
- src/domain/depopProvider.ts
  - Depop hybrid adapter, parser/versioning, HTML + API fallback, runtime bridge support.
- src/domain/providerFilters.ts
  - Candidate filtering by blocked terms/sellers, size allow-list, and min/max price.
- src/domain/querySynthesis.ts
  - Deterministic query synthesis, token normalization, category-aware fallback path.
- src/domain/matchScoring.ts
  - Weighted score, metadata fallback behavior, currency-aware delta calculations.
- src/domain/marketCompareController.ts
  - Single-flight orchestration, state transitions, error mapping, and result shaping.
- src/content/marketCompareLifecycle.ts
  - Controller lifecycle integration and panel-trigger wiring.
- src/ui/renderInsightsPanel.ts
  - Other Markets section with Depop trigger and compact result list.
- src/background.ts
  - Controlled bridge fetch endpoint for Depop search URLs/API URLs.

Partially implemented:
- src/domain/settings.ts
  - General settings exist, but market-compare-specific keys from the original plan were not added.

Not implemented:
- src/domain/marketCache.js
  - This planned module does not exist as a dedicated file.

## How the Implemented Flow Works

1. The listing panel renders an Other Markets section.
2. User clicks Compare on Depop (manual trigger only).
3. Controller synthesizes deterministic queries from listing data.
4. Provider runs Depop search with hybrid strategy:
   - HTML parse path first.
   - API v3 fallback when HTML is empty/unstable.
   - Runtime message bridge path available through background fetch.
5. Candidate list is filtered, scored, and ranked.
6. Top results return with score and delta labels.
7. Controller updates panel state: loading, results, no-results, or error.

## Original Plan vs Implemented Behavior

### 1) Product model and trigger

Implemented:
- Manual trigger exists in panel.
- Compact result list exists.
- Score + price delta are shown.
- Conservative request behavior is present.

Still needs code:
- Dedicated feature-flag setting for market compare default-off launch behavior.

### 2) Provider contract and result shape

Implemented:
- Provider responses include:
  - ok, candidates, fetchedAt, partial, sourceType, parserVersion, errorCode, retryAfterMs, requestCount.
- Candidate normalization includes market, id, title, url, imageUrl, price, currency, raw.

Partially implemented:
- nextCursor/cursor pagination support is not wired through as a first-class result flow.

### 3) Query synthesis and category strategy

Implemented:
- Deterministic tokenization and stable dedupe are implemented.
- Query variants are generated in stable order.
- Category signals are inspected.
- Category fallback path is explicitly surfaced with reason category_fallback.

Partially implemented:
- Category gating is not strict-by-default in runtime behavior.
  - Current behavior can fall back to broad queries instead of hard-stop in many cases.

Still needs code:
- Enforce strict subset-only behavior behind a dedicated rollout flag when required.

### 4) Similarity scoring and thresholding

Implemented:
- Weighted final scoring exists.
- Metadata-only fallback path exists when image scoring cannot be used.
- usedImage and imageUnavailableReason are surfaced.
- Thresholding is enforced in ranking.

Partially implemented:
- Image score is heuristic URL/token overlap, not true pHash distance.

Still needs code:
- Replace heuristic image scoring with actual perceptual hash pipeline if that level of precision is required.

### 5) Price delta

Implemented:
- Currency conversion-aware deltaAbsolute and deltaPercent logic exists.
- Output labels such as cheaper/higher are shown.

Partially implemented:
- Display policy is applied, but not all formatting rules from the original spec are centralized in one shared policy module.

### 6) Request policy and resilience

Implemented:
- Manual trigger only.
- Cooldown and jitter are used.
- Retry/backoff-style waits are present.
- Forbidden/block/rate-limit mapping is implemented.
- Runtime bridge is URL-restricted to Depop search/API prefixes.
- Host permissions for Depop search/API are present in both manifests.

Partially implemented:
- Lifecycle wiring currently instantiates provider with maxRequests: 5, while the original v1 target was max 3 per trigger.

Still needs code:
- Align configured request budget with spec decision, or update policy docs and telemetry to formalize the new value.

### 7) UI v1-core

Implemented:
- Other Markets section with provider label Depop.
- Status chip states: Ready/Searching/Results/No Results/Error.
- Last checked timestamp.
- Compare on Depop action.
- Compact result rows with title link, price, score, delta label.

Partially implemented:
- Result rows currently do not render thumbnail images.

Still needs code:
- Add thumbnail rendering to match original v1-core row spec.

### 8) Minimal settings spec

Still needs code:
- Add and wire these keys end-to-end:
  - grailed_plus_market_compare_enabled_v1
  - grailed_plus_market_compare_min_score_v1
  - grailed_plus_market_compare_strict_mode_v1
- Expose controls in options page and consume values in market compare lifecycle/controller.

### 9) Boot lifecycle and SPA safety

Implemented:
- Listing-page scoped integration.
- One active in-flight request per listing.
- Stale async completion protection via request token/render token logic.
- No auto-fetch behavior.
- Renders on explicit trigger and lifecycle refresh paths.

### 10) Error model

Implemented:
- NO_RESULTS
- NETWORK_ERROR
- RATE_LIMITED
- FORBIDDEN_OR_BLOCKED
- PARSE_ERROR
- MISSING_LISTING_DATA

Implemented:
- Error-to-UX mapping for retryable state, cooldown, and user-facing messaging.
- Parser mismatch signaling supported and surfaced for parse errors.

### 11) Privacy/compliance guardrails

Implemented:
- User-triggered low-volume flow.
- Restricted background URL allowlist.
- No broad all-urls host scope.

Still needs code:
- Explicit runtime kill-switch tied to market-compare feature key.

## Testing Status (What Is Covered)

Implemented:
- Unit and behavior tests for:
  - query synthesis determinism and fallback behavior.
  - scoring/threshold and metadata fallback behavior.
  - provider parsing and fallback branches.
  - controller state transitions and single-flight logic.
- Depop provider tests cover:
  - JSON-LD and Next flight parsing.
  - API fallback.
  - blocked/rate/no-results behavior.
  - loading-shell retry behavior.
  - bridge/fetch behavior and credentials include.

Still needs code:
- Golden ranking fixture set for fixed listing+candidate snapshots across category subsets.
- UI tests for thumbnail rendering (after thumbnails are added).
- Dedicated rollout-gate metrics instrumentation docs/code path.

## What Still Requires Implementation (Consolidated Checklist)

Still needs code:
- Dedicated market compare settings model + options UI integration.
- Dedicated feature kill switch and disabled-by-default rollout control.
- Standalone market cache module matching original schemaVersion/providerVersion key strategy.
- Thumbnail rendering in market result rows.
- True image pHash scoring pipeline (if kept as a quality requirement).
- Final decision and alignment on request budget (3 vs current 5 from lifecycle wiring).
- Golden ranking fixture calibration for the launch category subset.
- v1.1 UX: sorting/filtering/why-this-match popover.

## Recommended Next Slice Order

1. Add market-compare settings keys and wire runtime gating.
2. Add rollout kill switch and disabled-by-default launch path.
3. Add thumbnail rendering and UI tests.
4. Add dedicated cache module or formally ratify current registry cache design.
5. Add golden ranking fixtures and subset calibration pass.
6. Implement v1.1 UX enhancements.
