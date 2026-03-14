import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const tscEntry = path.join(rootDir, "node_modules", "typescript", "bin", "tsc");

const filesToCheck = [
  "src/domain/url.js",
  "src/data/listingModel.js",
  "src/data/listingExtractor.js",
  "src/domain/pricingInsights.js",
  "src/domain/settings.js",
  "src/domain/currency.js",
  "src/ui/renderInsightsPanel.js",
  "src/ui/theme.js",
  "src/content/boot.js",
  "src/options.js",
  "src/popup.js",
  "tests/url.test.js",
  "tests/listingExtractor.test.js",
  "tests/listingExtractor.snapshot.test.js",
  "tests/listingModel.test.js",
  "tests/pricingInsights.test.js",
  "tests/insightsPanel.test.js",
  "tests/theme.test.js",
  "tests/settings.test.js",
  "tests/currency.test.js"
];

let hasFailure = false;

for (const relativePath of filesToCheck) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    continue;
  }

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

const typecheckResult = spawnSync(process.execPath, [tscEntry, "--noEmit", "-p", "tsconfig.json"], {
  cwd: rootDir,
  stdio: "inherit"
});

if (typecheckResult.status !== 0) {
  process.exit(1);
}

console.log("Lint checks passed.");
