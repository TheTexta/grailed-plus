import path from "node:path";
import {
  createSourceSubmissionArchive,
  rootDir,
  stageSourceSubmission
} from "./release-lib.mjs";

const browser = process.argv[2];

if (browser !== "firefox") {
  throw new Error('Usage: node scripts/package-source.mjs <firefox>');
}

const staged = stageSourceSubmission(browser);
const packaged = createSourceSubmissionArchive(browser, staged.stageDir);

console.log(`Staged ${browser} source submission at ${path.relative(rootDir, staged.stageDir)}`);
console.log(`Packaged ${browser} source submission at ${path.relative(rootDir, packaged.outputFile)}`);
console.log(`Source archive size: ${packaged.archiveSize} bytes`);
