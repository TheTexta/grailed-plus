## Depop Expansion Plan and V1 Technical Spec

This document defines a quality-first, implementation-streamlined plan for adding a SIH-inspired cross-market comparison module to Grailed Plus, with Depop as the first provider.

## Product Decisions (Locked)
- `Use a hybrid fetch strategy in v1:` content-context parsing first, with controlled background bridge fallback for network/API retrieval when needed.
- `Best match quality is prioritized over speed-to-ship.`
- `v1 starts with a single category subset first` (to tune quality before generalization).

## Goals
- Let users compare a Grailed listing against likely matching Depop items.
- Keep v1 conservative: manual trigger, low request volume, local-only matching.
- Keep architecture provider-agnostic for future marketplaces.

## Non-Goals (v1)
- Autonomous crawling.
- Backend ML inference.
- Multi-market enablement at launch.
- Advanced results UI (drawer/sorting/filtering popover) in initial release.

## Delivery Model

### v1-core (ship first)
1. Manual `Compare on Depop` trigger in listing panel.
2. Compact result list (top matches only).
3. Local score (`0-100`) + price delta.
4. Strict throttling, deterministic caching, clear errors.
5. Category-limited rollout.

### v1.1 (after metrics)
1. Expanded UI (sorting/filtering/why-this-match).
2. Broader category support.
3. Optional advanced controls surfaced in settings.

## Reference Findings (Depop Snapshot + Legacy Ref Audit)

### Snapshot-backed observations
1. Archived Depop API response under `ref/www.depop.com (1)/www.depop.com/api/v3/search/products/index.html` contains stable listing primitives needed by our adapter:
  - `meta.total_count`, `meta.result_count`, `meta.has_more`
  - `products[].id`, `products[].slug`, `products[].status`
  - `products[].pricing.*`, `products[].preview`, `products[].pictures`, `products[].sizes`, `products[].brand_name`
2. Archived search HTML under `ref/www.depop.com (1)/www.depop.com/search/index.html` is a Next.js shell (heavy `__next_f` hydration and hashed chunk assets), confirming that static selector scraping is brittle over time.
3. Practical implication: maintain dual-path extraction where possible:
  - Parse HTML signals when available and cheap.
  - Fall back to API retrieval when HTML extraction is incomplete or unstable.

### Legacy scraper reference status
1. `ref/Steam Inventory Helper/` is deprecated for this project and not an authoritative implementation source.
2. Any old scraping-extension patterns from that folder should be treated as historical context only, not as current architecture guidance.

## Implementation Sequence (Quality-First Vertical Slices)

### Slice A: Skeleton + Contracts
1. Add provider interfaces and normalized models.
2. Add panel states with mock provider (`idle`, `loading`, `results`, `no-results`, `error`).
3. Add strict controller state machine for one active request per listing.

Exit criteria:
- Stable UI state transitions with no duplicate panel mounts across SPA navigation.

### Slice B: Real Fetch Path (Depop)
1. Implement Depop hybrid adapter (HTML parse path + API fallback path).
2. Implement deterministic query synthesis and category gating.
3. Add error mapping + retryability classification.
4. Add parser selector fallbacks and parser-version tagging so markup changes fail gracefully.

Exit criteria:
- Adapter returns normalized candidates and stable errors from fixtures.

### Slice C: Ranking + Delta
1. Implement scoring with image+metadata and metadata-only fallback.
2. Add ranking and threshold filter.
3. Add converted price delta output.

Exit criteria:
- Golden test fixtures produce stable ranked output.

### Slice D: Hardening + Rollout Controls
1. Add minimal settings controls.
2. Add cache invalidation and schema versioning.
3. Add rollout gates and launch disabled-by-default.

Exit criteria:
- Passes lint/test matrix and meets rollout metrics.

## V1 Technical Spec

### 1) Architecture

#### 1.1 Core modules (new)
- `src/domain/marketProviders.js`
  - Provider registry + strict interface validation.
- `src/domain/depopProvider.js`
  - Depop search adapter and normalization.
- `src/domain/providerFilters.js`
  - Query-level and global exclusion filters (desc terms, seller blacklist, size gating).
- `src/domain/querySynthesis.js`
  - Deterministic tokenization and query construction.
- `src/domain/matchScoring.js`
  - Score components + weighted rank output.
- `src/domain/marketCache.js`
  - Cache keying, TTL, stale handling, schema invalidation.
- `src/domain/marketCompareController.js`
  - Single-flight request orchestration and UI-state reducer.

#### 1.2 Existing modules to extend
- `src/ui/renderInsightsPanel.js`
  - Add compact `Other Markets` section and v1-core states.
- `src/content/boot.js`
  - Attach manual trigger wiring with token-safe cancellation.
- `src/domain/settings.js`
  - Minimal v1 settings keys.
- `src/options.html`, `src/options.js`
  - Minimal settings controls.
- `src/manifest.json`, `src/manifest.firefox.json`
  - Least-privilege Depop host permissions.
- `scripts/build.mjs`
  - Include new modules in deterministic order.

### 2) Provider Contract

#### 2.1 Interface
- `search(input) -> Promise<ProviderResult>`

#### 2.2 Search input
- `listingId: string`
- `title: string`
- `brand?: string`
- `size?: string`
- `category?: string`
- `primaryImageUrl?: string`
- `queries: string[]`
- `limit: number`
- `currency: string`
- `cursor?: string`

#### 2.3 Provider result
- `ok: boolean`
- `candidates: Candidate[]`
- `fetchedAt: number`
- `nextCursor?: string`
- `requestCount: number`
- `partial: boolean`
- `sourceType: "json" | "html"`
- `parserVersion?: string`
- `errorCode?: "NETWORK_ERROR" | "RATE_LIMITED" | "FORBIDDEN_OR_BLOCKED" | "PARSE_ERROR"`
- `retryAfterMs?: number`

#### 2.4 Candidate schema
- `market: "depop"`
- `id: string`
- `title: string`
- `url: string`
- `imageUrl?: string`
- `price: number`
- `currency: string`
- `size?: string`
- `brand?: string`
- `condition?: string`
- `postedAt?: string`
- `location?: string`
- `raw?: object`

### 3) Query Synthesis (Deterministic)

#### 3.1 Canonical normalization
1. Lowercase.
2. Remove punctuation and duplicate whitespace.
3. Remove stopwords and platform noise terms.
4. Cap token length and query token count.
5. Stable dedupe and stable ordering.

#### 3.2 Query order
1. `brand + model + key descriptor`
2. `brand + title core tokens`
3. `title core tokens + size`
4. `brand + size + category`

#### 3.3 Category-first rollout
- Only produce queries for approved v1 category subset.
- Return `MISSING_LISTING_DATA` if listing lacks required category signals.

#### 3.4 Query-level filtering
- Apply per-query constraints before scoring:
  - size allow-list
  - min/max price prefilter
  - description blocked terms
  - seller blacklist
- Support global filters plus optional query-specific filters for later v1.1 controls.

### 4) Similarity Scoring

#### 4.1 Components
- `imageScore` (0-100): pHash distance normalized.
- `titleScore` (0-100): token overlap + important token bonus.
- `brandScore` (0 or 100): exact/alias match.
- `sizeScore` (0-100): exact/compatible mapping.
- `conditionScore` (0-100): condition distance.

#### 4.2 Default weighting
- `finalScore = 0.45*imageScore + 0.25*titleScore + 0.15*brandScore + 0.10*sizeScore + 0.05*conditionScore`

#### 4.3 Missing image fallback
- If image cannot be fetched/decoded, switch to metadata-only scoring.
- Include:
  - `usedImage: false`
  - `imageUnavailableReason: "missing_url" | "fetch_failed" | "decode_failed" | "cross_origin_blocked"`
  - confidence penalty before thresholding.

#### 4.4 Threshold policy
- Initial exclusion threshold is configurable (`default 40`).
- Final threshold can be adjusted after fixture calibration in category subset.

### 5) Price Delta Logic
1. Convert both prices into selected currency.
2. Compute:
  - `deltaAbsolute = depopConverted - grailedConverted`
  - `deltaPercent = (deltaAbsolute / grailedConverted) * 100`
3. Apply consistent display rounding policy:
  - currency: 2 decimals max
  - percent: 1 decimal

### 6) Caching and Request Policy

#### 6.1 Cache keys
- `market_compare_v1:{schemaVersion}:{providerVersion}:{market}:{listingId}:{queryHash}:{currency}`

#### 6.2 TTL
- Fresh: 10 minutes.
- Stale-while-revalidate: +20 minutes.
- Keep a short-lived `seenCandidateIds` set per listing session to avoid duplicate resurfacing on repeated manual triggers.

#### 6.3 Invalidation
- Invalidate when:
  - `schemaVersion` changes.
  - scoring or query synthesis version changes.
  - category rollout set changes.

#### 6.4 Request policy
- Manual trigger only.
- Primary path: content-context/HTML extraction.
- Fallback path: controlled background bridge request for Depop search API when needed.
- Max requests per trigger: `3`.
- Cooldown: `1200ms`.
- Backoff: `1.5x` capped at `8000ms`.
- Stop on forbidden/anti-bot signatures and surface actionable UI state.
- Add small jitter (`+/-10%`) to cooldown to avoid deterministic request cadence.
- Add an optional fast-path check: fetch lightweight first-page marker/fingerprint before deep parsing to skip unnecessary work when results are unchanged.

### 7) UI Specification (v1-core)

#### 7.1 Panel section
- Header: `Other Markets`.
- Provider row: `Depop`.
- Status chip: `Ready`, `Searching`, `Error`, `Last checked ...`.
- Button: `Compare on Depop`.

#### 7.2 Result row fields
- Thumbnail.
- Title link.
- Converted price.
- Confidence score (`0-100`).
- Delta badge (`cheaper` or `higher`).

#### 7.3 Deferred to v1.1
- Expanded mini-window.
- Sort/filter controls.
- Full `Why this match` popover.

### 8) Settings Specification (Minimal v1)

Expose only:
- `grailed_plus_market_compare_enabled_v1` (boolean, default `false`)
- `grailed_plus_market_compare_min_score_v1` (number, default `40`)
- `grailed_plus_market_compare_strict_mode_v1` (boolean, default `true`)

Keep internal constants (not user-exposed in v1):
- max requests
- cooldown ms
- max candidates
- filter defaults (blocked terms/seller blacklist) seeded in code

### 9) Boot Lifecycle Integration
1. Initialize on listing pages only.
2. One in-flight request per listing route.
3. Cancel/ignore stale async completions by render token.
4. No auto-fetch.
5. Re-render only on explicit user trigger or route change.

### 10) Error Model

Error codes:
- `NO_RESULTS`
- `NETWORK_ERROR`
- `RATE_LIMITED`
- `FORBIDDEN_OR_BLOCKED`
- `PARSE_ERROR`
- `MISSING_LISTING_DATA`

Each code must map to:
- `retryable: boolean`
- `cooldownMs?: number`
- user message
- UI action (`retry` | `wait` | `adjust listing filters`)
- parser health signal (`parserMismatchLikely: boolean`) for diagnostics when markup drift breaks extraction.

### 11) Privacy and Compliance Guardrails
- Publicly accessible Depop content only.
- No account/session scraping.
- No personal data persistence beyond comparison artifacts.
- Low-volume, user-triggered requests only.
- Runtime kill switch through settings.
- Maintain least-privilege extension permissions; avoid broad host scopes (`<all_urls>`) and unnecessary high-risk permissions.

### 12) Testing Plan (Quality-Focused)

#### 12.1 Unit tests
- query determinism
- scoring math
- fallback scoring
- cache lifecycle
- price delta math

#### 12.2 Adapter tests
- success fixtures
- empty responses
- malformed payloads
- blocked/rate-limited responses
- selector drift fixtures (same listing shape across multiple DOM variants)

#### 12.3 Golden ranking fixtures
- fixed listing + fixed candidate set -> fixed ranked output snapshot.

#### 12.4 UI tests
- state transitions
- no duplicate sections across SPA navigation
- trigger debouncing / single-flight behavior
- duplicate suppression checks for repeated manual searches

#### 12.5 Manual checks
- CORS and host permissions
- request cadence
- no jank before trigger

## Rollout Gates
1. Disabled-by-default launch.
2. Quality gate: acceptable precision on category subset manual review.
3. Stability gate: acceptable error rate and median response time.
4. Expand categories only after gate pass.

## Delivery Sequence Recommendation
1. Contracts + mock provider + UI state skeleton.
2. Real Depop adapter (hybrid HTML parse + API fallback via background bridge).
3. Ranking + price delta + fixture calibration.
4. Minimal settings + rollout gates.
5. v1.1 UX enhancements after metric validation.
