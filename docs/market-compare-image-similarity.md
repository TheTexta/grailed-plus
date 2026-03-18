# Market Compare Image Similarity: Current Architecture

Date: 2026-03-17

## Outcome Summary

Current status:
- Market Compare now has a real ML-based visual similarity path.
- The primary image signal is local MobileCLIP-S1 ONNX image embeddings computed inside the extension.
- The visual pipeline is layered:
  1. MobileCLIP-S1 embedding similarity
  2. local dHash-style thumbnail fingerprint similarity
  3. legacy URL heuristic
- The extension still reranks only a small fetched candidate set and still uses only the Grailed listing image plus Depop search-result thumbnails.

## Implemented This Session

Shipped in this session:
- Added a bundled MobileCLIP-S1 ONNX image-embedding path as the primary Market Compare image signal.
- Bundled ONNX Runtime Web JS/WASM assets into the extension package and exposed the required runtime assets through the manifest.
- Kept the existing thumbnail fingerprint path as the automatic fallback and preserved the legacy URL heuristic as the last-resort fallback.
- Added a real `mlSimilarityEnabled` setting in the options page, enabled by default.
- Added non-blocking model warmup so later compares in the same tab can use ML after a cold start.
- Added more honest image-signal reporting through `imageSimilarityScore`, `imageSignalType`, and `usedImage` semantics.
- Added a Market Compare panel status chip, `ML Sorted`, that appears when all displayed results were ranked with the embedding path.
- Updated README, reviewer docs, privacy copy, and third-party notices to document the ML rollout.

## What Is Implemented Today

### 1) Current image score pipeline

Implemented in:
- `src/domain/imageSimilarity.ts`
- `src/domain/matchScoring.ts`

Current behavior:
- The Grailed listing image and each Depop thumbnail are fetched locally inside the extension.
- Images are preprocessed for the MobileCLIP-S1 vision encoder by:
  - converting to RGB
  - resizing the shortest edge to `256`
  - center-cropping to `256x256`
  - rescaling pixel values by `1/255`
- The preprocessed tensor is passed to the MobileCLIP-S1 ONNX vision model.
- The output embedding vectors are L2-normalized.
- Cosine similarity is computed between the Grailed target embedding and the Depop candidate embedding.
- The cosine result is mapped into the reranker’s `0..100` range as `max(0, cosine) * 100`, then rounded and clamped.

Important detail:
- This is now a real image-content similarity signal, not a URL-token comparison.

### 2) Fallback order

Implemented in:
- `src/domain/imageSimilarity.ts`

Current behavior:
- If ML similarity is enabled and the model session is warm within the cold-start budget, the scorer uses MobileCLIP embeddings.
- If ML is disabled, still warming, or unavailable, the scorer falls back to local thumbnail fingerprints.
- If thumbnail fingerprinting also fails, the synchronous scorer falls back to the existing URL heuristic.
- If all image paths fail, ranking falls back to metadata-only scoring.

Implication:
- The extension keeps a usable image signal even when the ML path is cold or unavailable.
- First use in a fresh tab may fall back once while the model warms in the background.

### 3) Where image inputs come from

Implemented in:
- `src/domain/depopProvider.ts`
- `src/content/marketCompareLifecycle.ts`

Current behavior:
- The Grailed source image comes from the current listing page.
- Depop candidates use the thumbnail already present in Depop search results.
- The extension does not fetch each Depop candidate listing page just to score similarity.
- Only a single candidate thumbnail is used for each Depop result.

Implication:
- The architecture still respects the search-page-only constraint.
- Relevance depends on thumbnail quality, crop quality, and whether the chosen thumbnail is representative.

### 4) Ranking integration

Implemented in:
- `src/domain/matchScoring.ts`
- `src/domain/marketCompareController.ts`

Current behavior:
- Async market-compare ranking now feeds `imageSimilarityScore` into the weighted scoring system.
- Scored candidates also expose `imageSignalType` with one of:
  - `ml_embedding`
  - `thumbnail_fingerprint`
  - `url_heuristic`
  - `""`
- `usedImage = true` now means an image signal actually contributed to ranking.
- `imageUnavailableReason` is populated only when no usable image signal was available.

Implication:
- Debugging output is more honest about which image path actually ran.
- The weighted reranker did not need architectural redesign to accept the ML score.

### 5) Settings and warmup behavior

Implemented in:
- `src/domain/settings.ts`
- `src/options.ts`
- `src/content/marketCompareLifecycle.ts`

Current behavior:
- Market Compare now has a real user setting: `mlSimilarityEnabled`.
- Default value is `true`.
- The options page describes the image signal as local MobileCLIP similarity with fingerprint fallback.
- When the listing insights panel renders and Market Compare is enabled, the extension starts a non-blocking model warmup in the background.
- v1 does not rerender in two passes. A cold compare can use fallback once; later compares in the same tab can use ML after warmup.

### 6) Panel status and user-visible labeling

Implemented in:
- `src/ui/renderInsightsPanel.ts`

Current behavior:
- Market Compare still shows the existing `Results` status chip for successful compare output.
- When every displayed result in the current panel view has `imageSignalType = "ml_embedding"`, the panel also shows `ML Sorted`.
- If any displayed result used fingerprint fallback, URL heuristic fallback, or had no usable image signal, the extra ML status chip is omitted.

Implication:
- The panel is more honest about when the ML ranking path was actually active for the results the user is seeing.
- The label avoids overstating partial or mixed-signal result sets as fully ML-ranked.

## Runtime and Packaging

Implemented in:
- `src/vendor/mobileclip-s1/`
- `src/vendor/onnxruntime/`
- `scripts/release-lib.mjs`

Current behavior:
- The MobileCLIP-S1 ONNX vision model is bundled with the extension package.
- ONNX Runtime Web JavaScript and WASM assets are bundled with the extension package.
- The extension uses ONNX Runtime Web in WASM mode only for v1.
- `web_accessible_resources` now expose the model and WASM binary to the extension runtime.
- The release pipeline stages and validates those assets so Firefox and Chrome packages include them.

Important detail:
- No CDN is used.
- No remote model download is used.
- Remote responses are treated as data only.

## Third-Party Provenance

Documented in:
- `src/vendor/THIRD_PARTY_NOTICES.md`

Current bundled assets:
- `onnxruntime-web` `1.23.2` with vendored JS/WASM runtime files
- MobileCLIP-S1 ONNX vision model assets from the `Xenova/mobileclip_s1` export lineage, with upstream Apple license text retained

## Performance Envelope

Implemented in:
- `src/content/marketCompareLifecycle.ts`
- `src/domain/marketProviders.ts`

Current behavior:
- The extension reranks a small fetched result set.
- Default compare limit is `5`.
- Expanded mode raises that to `10`.
- Provider results are cached for `45s`.
- In-flight identical searches are deduplicated.

Implication:
- ML embedding similarity is being used as a local reranking signal, not a retrieval system.
- The main cost is bounded browser-side inference on a very small candidate set.

## Current Strengths

- The image component is now a real ML-based visual signal.
- The search-page-only constraint is preserved.
- No backend or vector index is required.
- The layered fallback path keeps the feature resilient.
- The scorer now reports which image path actually contributed.

## Current Limitations

- This is still thumbnail-based reranking, not full catalog retrieval.
- Only one candidate thumbnail is used per Depop result.
- MobileCLIP-S1 is a general compact vision-language model, not a fashion-specialized retrieval model.
- Background clutter, aggressive crops, small logos, and subtle color differences can still hurt precision.
- A cold tab may use fingerprint fallback on the first compare before the model is warm.

## Recommendation

Near term:
- Keep the current layered pipeline and measure ranking quality on real Grailed-to-Depop examples.
- Track warm latency and first-compare fallback frequency before changing cold-start behavior.

Later, if quality still plateaus:
- consider multi-image candidate scoring
- consider fashion-tuned embedding models
- consider backend retrieval only if Market Compare becomes a much larger product investment
