# Firefox Release Guide

Last updated: March 17, 2026

## Prerequisites

1. Use Node.js `22.18.0` (`nvm install 22.18.0 && nvm use 22.18.0` if you use `nvm`).
2. Use npm `11.11.0` (`npm install -g npm@11.11.0` if needed).
3. Ensure the `zip` CLI is installed and available on `PATH`.
4. Install project dependencies with `npm ci`.
5. Install Firefox Desktop locally.
6. Install `web-ext` locally or globally before running `npm run verify:firefox`.
7. Confirm `package.json` `firefoxExtensionId` is unique for the AMO listing you are submitting.

## Build And Validate

1. Run `npm run lint`.
2. Run `npm test`.
3. Run `npm run zip:firefox`.
4. Run `npm run verify:firefox`.

Expected outputs:

- `artifacts/staging/firefox/`
- `artifacts/grailed-plus-firefox.xpi`

## Source Submission Package

1. Run `npm run source:firefox`.
2. Upload `artifacts/grailed-plus-firefox-source.zip` in the AMO source-code field.
3. Do not upload the built `.xpi` as source code.

The source archive excludes generated first-party files such as `src/contentScript.js`, `src/contentScript.css`, `src/background.js`, `src/options.js`, `src/popup.js`, `src/domain/browserStorage.js`, `src/domain/settings.js`, `src/domain/currency.js`, and the generated manifest files. Reviewers can recreate them with the build steps above.

The source archive includes the vendored MobileCLIP-S1 model assets, ONNX Runtime Web assets, and third-party notices used by the Market Compare ML image-similarity feature.

## Temporary Install For QA

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on...`.
3. Select `[manifest.json](/Users/dexteryoung/Git Repos/grailed-plus/artifacts/staging/firefox/manifest.json)`.
4. Open a Grailed listing page and verify the extension loads without console errors.

## Manual QA Checklist

- Listing insights panel renders on Grailed listing pages.
- Popup opens the options page from Firefox browser action.
- Currency conversion settings persist and re-apply after refresh.
- Dark mode toggles between system and permanent modes.
- Options page shows `Use ML visual similarity when available` and keeps it enabled by default.
- Depop market compare search works end to end, including MobileCLIP image similarity with fallback behavior.
- When all displayed results use the embedding path, the Market Compare panel shows `ML Sorted`.
- A cold first compare can still fall back once while the model warms, without breaking the compare flow.
- Expected fallback states still render correctly for no-results, blocked, and fetch-failure cases.

## AMO Submission Flow

1. Upload `artifacts/grailed-plus-firefox.xpi` to AMO as a listed add-on.
2. Upload `artifacts/grailed-plus-firefox-source.zip` as the source package.
3. Use the copy in `[firefox-amo-listing.md](/Users/dexteryoung/Git Repos/grailed-plus/docs/firefox-amo-listing.md)` for the listing page.
4. Link the public privacy policy at `[privacy-policy.html](/Users/dexteryoung/Git Repos/grailed-plus/docs/privacy-policy.html)`.
5. Attach fresh Firefox desktop screenshots following `[docs/firefox-screenshots/README.md](/Users/dexteryoung/Git Repos/grailed-plus/docs/firefox-screenshots/README.md)`.
6. Paste the reviewer notes below into the AMO submission form.

## Reviewer Notes

Exact release build environment:

- OS: macOS or Linux with `zip` installed
- Node.js: `22.18.0`
- npm: `11.11.0`

Exact Firefox build steps:

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run zip:firefox`
5. Optional verification: `npm run verify:firefox`

Exact source package:

- `npm run source:firefox`
- Upload `artifacts/grailed-plus-firefox-source.zip`

Grailed Plus enhances Grailed listing pages with:

- listing insights rendered on `grailed.com` listing pages
- optional currency conversion using `api.frankfurter.app`
- optional Depop market compare requests to `*.depop.com`
- thumbnail fetches used only to score visual similarity for market compare results
- bundled MobileCLIP-S1 and ONNX Runtime assets loaded locally from the extension package
- a panel-level `ML Sorted` status label when the displayed result set was fully embedding-ranked

The extension does not execute remote code. All remote requests are data fetches for page enhancement and comparison results.

Firefox `data_collection_permissions.required` mapping:

- `searchTerms`: derived from the current Grailed listing title to build Depop comparison queries
- `websiteActivity`: current Grailed page context and navigation state used to decide when to render extension features
- `websiteContent`: listing price, title, metadata, and thumbnail inputs used to render insights and market compare output
