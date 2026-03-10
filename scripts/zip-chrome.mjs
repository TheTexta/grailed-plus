import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const artifactsDir = path.join(rootDir, "artifacts");
const outputFile = path.join(artifactsDir, "grailed-plus-chrome-beta.zip");

fs.mkdirSync(artifactsDir, { recursive: true });
if (fs.existsSync(outputFile)) {
  fs.unlinkSync(outputFile);
}

const result = spawnSync(
  "zip",
  [
    "-r",
    outputFile,
    "manifest.json",
    "contentScript.js",
    "contentScript.css",
    "options.html",
    "options.js",
    "popup.html",
    "popup.js",
    "ui.css",
    "domain/settings.js",
    "domain/currency.js",
    "icons"
  ],
  {
    cwd: path.join(rootDir, "src"),
    stdio: "inherit"
  }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`Packaged ${path.relative(rootDir, outputFile)}`);
