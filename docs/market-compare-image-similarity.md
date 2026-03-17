# Market Compare Image Similarity: Current State and Upgrade Plans

Date: 2026-03-15

## Outcome Summary

Current status:
- The extension does not perform true visual similarity.
- "Image similarity" is currently a heuristic score based on token overlap between image URLs.
- The implementation is cheap and operationally fine for reranking a small candidate set, but its relevance quality is limited.

## What Is Implemented Today

### 1) Current image score

Implemented in:
- `src/domain/matchScoring.ts`

Current behavior:
- The listing image URL and candidate image URL are normalized into lowercase tokens.
- Non-alphanumeric characters are stripped to spaces.
- Token overlap is computed as:

`score = overlap_count / max(token_count_left, token_count_right) * 100`

- The result is rounded and clamped to `0..100`.

Important detail:
- This compares URL strings, not image pixels, embeddings, or perceptual hashes.

Implication:
- This is a little useful for now but a renaming of this feature and how its described in the settings ui is high priority

### 2) Where image URLs come from

Implemented in:
- `src/domain/depopProvider.ts`

Current behavior:
- Only one candidate image URL is used.
- The provider typically takes the first available image-like field such as:
  - `photo.url`
  - `photos[0].url`
  - `primary_photo.url`
  - `cover_photo.url`

Implication:
- Multi-photo listings are reduced to a single representative URL.
  - This is ok and not going to a be priority fix until well down the line

### 3) How image score affects ranking

Implemented in:
- `src/domain/matchScoring.ts`

Current behavior:
- Final ranking score is a weighted sum of:
  - image
  - title
  - brand
  - size
  - condition

Current weights when an image score exists:
- `visual`: `0.62*image + 0.16*title + 0.10*brand + 0.08*size + 0.04*condition`
- `balanced`: `0.45*image + 0.25*title + 0.15*brand + 0.10*size + 0.05*condition`
- `metadata`: `0.18*image + 0.40*title + 0.20*brand + 0.14*size + 0.08*condition`
- `variant`: `0.08*image + 0.24*title + 0.24*brand + 0.28*size + 0.16*condition`

Fallback when image URL is missing:
- The system does not attempt any visual comparison.
- It falls back to metadata-only weighted scoring.
- Comparing brands is flawed for depop specifically as many non mainstream items do not have their own brand within the site listed due to limited custom brand support from depop

### 4) Ranking scope and performance envelope

Implemented in:
- `src/content/marketCompareLifecycle.ts`
- `src/content/boot.ts`
- `src/domain/marketProviders.ts`

Current behavior:
- The extension reranks a small fetched result set.
- Default compare limit is `5`.
- Expanded mode raises that to `10`.
- Provider results are cached for `45s`.
- In-flight identical searches are deduplicated.

Implication:
- Compute cost is currently small.
- Most scaling pressure is in retrieval quality and network behavior, not in local scoring cost.
- high priority is to ensure that each listing we are checking from depop is not queried throughout this process. all the information we need can come from the search page results (thumbnail, link, title, price).

## What I Learned

### Strengths

- The current approach is simple, deterministic, and cheap.
- It works inside the extension without extra infrastructure.
- The fallback path is explicit and stable when image URLs are missing.
- The scoring system already exposes enough structure to swap in a better image score later.

### Weaknesses

- The current image score is not visual similarity.
- Two visually identical items can score poorly if their CDN filenames differ.
- Two visually unrelated items can score well if their image URLs share similar path tokens.
- A listing with strong brand/title overlap can hide image-score weakness, which can make ranking appear better than the image logic actually is.
- Only one image is considered, so alternate angles, labels, and detail shots are ignored.
- `usedImage = true` currently means "both image URLs were present", not "a real image comparison succeeded".

## Three Possible Plans

### Plan 1: Reframe and Harden the Current Reranker

Goal:
- Fix the product framing first, then make the current search-page-only reranker more honest and more reliable.

Changes:
- Rename the feature and settings copy so it no longer implies true visual similarity.
- Keep the current "search page only" architecture and do not fetch each candidate listing page.
- Replace raw URL-token overlap with a narrower heuristic:
  - strip CDN boilerplate and hash-like tokens
  - compare normalized filename/path stems only
  - separate thumbnail/url heuristic score from metadata score in naming and debugging output
  - tighten `usedImage` semantics so it means "usable image heuristic signal" rather than merely "two URLs existed"
- Reduce or conditionally downweight brand for Depop-specific ranking when brand is missing, generic, or unreliable.
- Lean more on title, size, condition, and price delta for the default Depop ranking path.

Pros:
- Fastest path.
- No new services.
- No extra network pressure.
- Directly addresses the highest-priority problem: the feature is currently oversold.

Cons:
- Still not true image similarity.
- Quality ceiling remains low.
- Gains are corrective, not transformative.

Best for:
- Immediate next release.

### Plan 2: Add Search-Page-Only Thumbnail Fingerprints

Goal:
- Add a real visual signal without leaving the "all data comes from search results" constraint.

Changes:
- Keep retrieval limited to the Depop search page results: thumbnail, link, title, and price only.
- Compute a lightweight thumbnail fingerprint locally from the source listing image and each search-result thumbnail.
- Replace URL-token overlap with fingerprint distance as the image component.
- Keep metadata reranking, but treat brand as a weak or optional Depop feature rather than a trusted match key.
- Preserve the no-follow-up-fetch rule for candidate listings.

Pros:
- Real visual signal.
- Better robustness than URL overlap while staying inside the extension.
- Respects the current request policy and avoids per-listing candidate fetches.

Cons:
- More engineering work.
- More image decode and compute work in the extension.
- Thumbnail quality may limit precision.
- Still below embedding-based retrieval in relevance ceiling.

Best for:
- The best near-to-medium-term quality upgrade if the search-page-only constraint holds.

### Plan 3: Build a Real Retrieval Stack

Goal:
- Build true scalable similarity only if Market Compare becomes a deeper product investment.

Changes:
- Move to perceptual-hash-at-scale or embedding-based retrieval with an index.
- Treat the current scorer as a reranker rather than the main retrieval mechanism.
- Model Depop brand as a weak prior, not a hard ranking anchor.
- Keep candidate detail-page requests optional rather than part of the default ranking path.
- Potentially replace search-result recall entirely if a dedicated index exists.

Pros:
- Best relevance ceiling.
- Most scalable for large catalogs and diverse image sources.
- Supports future hybrid search and cross-market ranking much better.

Cons:
- Highest complexity.
- Requires backend infrastructure, ingestion, index management, and monitoring.
- Hardest to ship within a pure extension model.
- Probably unnecessary until the simpler plans are proven insufficient.

Best for:
- A future version where similarity quality is a core product differentiator.

## Recommendation

If the goal is:

- `fastest practical improvement`: choose Plan 1
- `best quality without backend`: choose Plan 2
- `true scalable image retrieval`: choose Plan 3

My recommendation:
- Plan 1 should happen first because the naming/UI accuracy and request-policy constraints are now the highest-priority issues.
- Plan 2 is the best next step if you want better quality without violating the "search page results only" constraint.
- Plan 3 should stay long-term only and should not drive near-term architecture unless Market Compare becomes a major product bet.

## Implementation Note

Implemented on 2026-03-16:
- Plan 1 is now partially shipped.
- The current image signal was reframed in the options UI as an `image heuristic` rather than true visual similarity.
- URL scoring now uses normalized filename/path stems, strips CDN/hash noise, and only sets `usedImage` when a usable heuristic signal exists.
- Ranking now redistributes missing signals instead of treating them as hard mismatches, reduces unreliable brand influence, and adds price-delta weighting to the default balanced path.

Plan 2 follow-up implemented on 2026-03-16:
- Market Compare now has an async thumbnail-similarity path that computes local dHash-style fingerprints from the listing image and Depop search-result thumbnails.
- The controller now awaits async ranking, the extension background worker can fetch image bytes for fingerprinting, and the options copy now describes the image signal as `thumbnail similarity`.
- The original synchronous scorer remains as the fallback path when the real visual pipeline is unavailable.
