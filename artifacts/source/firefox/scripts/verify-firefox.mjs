import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  getStageDir,
  rootDir,
  stageExtension,
  validateStagedExtension
} from "./release-lib.mjs";

const stageDir = getStageDir("firefox");
const manifestPath = `${stageDir}/manifest.json`;
const staged = fs.existsSync(manifestPath)
  ? validateStagedExtension("firefox", stageDir)
  : stageExtension("firefox");

function resolveWebExtCommand() {
  const localBinary = path.join(
    rootDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "web-ext.cmd" : "web-ext"
  );
  if (fs.existsSync(localBinary)) {
    return localBinary;
  }

  const systemCommand = process.platform === "win32" ? "web-ext.cmd" : "web-ext";
  const probe = spawnSync(systemCommand, ["--version"], {
    cwd: rootDir,
    stdio: "ignore"
  });

  if (!probe.error && probe.status === 0) {
    return systemCommand;
  }

  return null;
}

const webExtCommand = resolveWebExtCommand();
if (!webExtCommand) {
  throw new Error(
    'web-ext is not installed. Install it locally or globally before running "npm run verify:firefox".'
  );
}

const lintResult = spawnSync(webExtCommand, ["lint", "--source-dir", staged.stageDir], {
  cwd: rootDir,
  stdio: "inherit"
});

if (lintResult.error) {
  throw lintResult.error;
}

if (lintResult.status !== 0) {
  process.exit(lintResult.status || 1);
}

console.log("Firefox staged package passed web-ext lint.");
