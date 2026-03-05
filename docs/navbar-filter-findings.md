# Navbar Filter Findings (So Far)

Date: March 4, 2026

## Goal
Apply the dark-mode inversion/filter treatment to the top navbar while preserving native Grailed overscroll behavior (especially upward rubber-band / sticky-top behavior).

## Current Stable State
- Dark-mode filtering is applied to non-header content in `#__next`.
- Header/nav/merch menu subtree is explicitly excluded from filtered ancestors.
- Result: native overscroll physics and sticky behavior are restored.

Relevant selector pattern in [`src/contentScript.css`](/Users/dexteryoung/Git Repos/grailed-plus/src/contentScript.css):
- `#__next > :not(header[class*="SiteHeader_"])... { filter: ... }`

## Findings
1. Filtering a navbar ancestor breaks native overscroll/sticky behavior.
- When `filter` was applied to `body` or full `#__next`, top nav behavior diverged from base site.
- Symptoms: fast upward drift, sticky/fixed misalignment, non-native rubber-band behavior.

2. Popper/dropdown positioning is also impacted by filtered ancestors.
- Radix popovers/search menus drifted when their positioning context lived in a filtered subtree.

3. JS compensation workarounds were fragile.
- Tried scroll-based `translate` correction on popper wrappers and header wrappers.
- Tried fixed-only, sticky+fixed, viewport-measured pinning, `visualViewport` listeners, and RAF loops.
- Outcome: partial improvements but still non-native behavior at high upward overscroll velocity.

4. Media counter-filtering can be over-applied.
- Filtering both `picture` and `img` caused hero carousel media issues.
- Keeping counter-filter on rendered media nodes (`img`, `video`, `canvas`, `iframe`) resolved it.

5. Architectural fix beat runtime patching.
- Excluding navbar/header subtree from filtered ancestors solved overscroll reliably.
- Removed the drift-fix runtime subsystem from `boot.js` after this change.

## Root Cause (Practical)
`filter` creates a new compositing/containing context. On Grailed’s fixed/sticky header + portal stack, this changes browser positioning/scroll behavior enough to diverge from the site’s native overscroll physics.

## What This Means
If we want the navbar "filtered" like the rest of the page, doing it by filtering an ancestor is currently incompatible with preserving native overscroll behavior.

## Safer Paths Forward
1. Navbar visual parity without ancestor filter (recommended)
- Keep navbar outside filtered tree.
- Recreate target appearance via explicit CSS tokens (text/icon/border/background treatment) instead of global invert.

2. Component-level filter only on non-positioned navbar internals
- Filter selected descendants (not the sticky/fixed container).
- Risk: brittle against Grailed class/hash changes; may still affect interaction layers.

3. Custom painted overlay approach
- Use pseudo-element/overlay gradients + color adjustments for navbar aesthetics.
- Avoid `filter` on positioning ancestors entirely.

## Suggested Next Experiment
- Build a dedicated "navbar theme layer" (no ancestor filter):
  - transparent background + preserved borders
  - explicit icon/text color mapping
  - menu trigger/caret states
  - search input/button visual alignment
- Validate on:
  - home page upward overscroll at high velocity
  - menu open/close
  - search dropdown positioning
  - mobile + desktop breakpoints
