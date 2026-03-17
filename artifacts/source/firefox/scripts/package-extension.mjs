import path from "node:path";
import { createExtensionArchive, rootDir, stageExtension } from "./release-lib.mjs";

const browser = process.argv[2];

if (browser !== "chrome" && browser !== "firefox") {
  throw new Error('Usage: node scripts/package-extension.mjs <chrome|firefox>');
}

const staged = stageExtension(browser);
const packaged = createExtensionArchive(browser, staged.stageDir);

console.log(`Staged ${browser} extension at ${path.relative(rootDir, staged.stageDir)}`);
console.log(`Packaged ${browser} extension at ${path.relative(rootDir, packaged.outputFile)}`);
