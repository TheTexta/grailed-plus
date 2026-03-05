import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const filesToCheck = [
  "src/domain/url.js",
  "src/data/listingAdapter.js",
  "src/data/extractListing.js",
  "src/domain/metrics.js",
  "src/domain/settings.js",
  "src/domain/currency.js",
  "src/ui/renderPanel.js",
  "src/content/boot.js",
  "src/options.js",
  "tests/url.test.js",
  "tests/extractListing.test.js",
  "tests/extractListing.snapshot.test.js",
  "tests/listingAdapter.test.js",
  "tests/metrics.test.js",
  "tests/ui.test.js",
  "tests/settings.test.js",
  "tests/currency.test.js"
];

let hasFailure = false;

for (const relativePath of filesToCheck) {
  const result = spawnSync(process.execPath, ["--check", relativePath], {
    cwd: rootDir,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    hasFailure = true;
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log("Lint checks passed.");
