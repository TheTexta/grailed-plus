"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");

async function loadReleaseLib() {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, "../scripts/release-lib.mjs")).href;
  return import(moduleUrl + "?t=" + Date.now());
}

test("generated manifests stay in sync with extensionVersion and Firefox requirements", async () => {
  const releaseLib = await loadReleaseLib();
  const chromeManifest = JSON.parse(
    fs.readFileSync(path.join(releaseLib.sourceDir, "manifest.json"), "utf8")
  );
  const firefoxManifest = JSON.parse(
    fs.readFileSync(path.join(releaseLib.sourceDir, "manifest.firefox.json"), "utf8")
  );

  assert.equal(chromeManifest.version, releaseLib.getExtensionVersion());
  assert.equal(firefoxManifest.version, releaseLib.getExtensionVersion());
  assert.equal(
    firefoxManifest.browser_specific_settings.gecko.id,
    releaseLib.getFirefoxExtensionId()
  );
  assert.equal(chromeManifest.background.service_worker, "background.js");
  assert.equal(firefoxManifest.background.service_worker, undefined);
  assert.deepEqual(firefoxManifest.background.scripts, ["background.js"]);
  assert.deepEqual(
    firefoxManifest.browser_specific_settings.gecko.data_collection_permissions.required,
    ["searchTerms", "websiteActivity", "websiteContent"]
  );
});

test("staged Firefox package includes required runtime files and validation fails when one is missing", async () => {
  const releaseLib = await loadReleaseLib();
  const staged = releaseLib.stageExtension("firefox");
  const browserStoragePath = path.join(staged.stageDir, "domain", "browserStorage.js");
  const backgroundPath = path.join(staged.stageDir, "background.js");
  const ortRuntimePath = path.join(staged.stageDir, "vendor", "onnxruntime", "ort.wasm.min.js");
  const ortWasmPath = path.join(
    staged.stageDir,
    "vendor",
    "onnxruntime",
    "ort-wasm-simd-threaded.wasm"
  );
  const modelPath = path.join(
    staged.stageDir,
    "vendor",
    "mobileclip-s1",
    "vision_model_uint8.onnx"
  );
  const brokenStageDir = path.join(releaseLib.artifactsDir, "staging", "firefox-broken");

  assert.equal(fs.existsSync(backgroundPath), true);
  assert.equal(fs.existsSync(browserStoragePath), true);
  assert.equal(fs.existsSync(ortRuntimePath), true);
  assert.equal(fs.existsSync(ortWasmPath), true);
  assert.equal(fs.existsSync(modelPath), true);

  fs.rmSync(brokenStageDir, { recursive: true, force: true });
  fs.cpSync(staged.stageDir, brokenStageDir, { recursive: true });
  fs.unlinkSync(path.join(brokenStageDir, "vendor", "mobileclip-s1", "vision_model_uint8.onnx"));

  try {
    assert.throws(
      function () {
        releaseLib.validateStagedExtension("firefox", brokenStageDir);
      },
      /missing referenced asset vendor\/mobileclip-s1\/vision_model_uint8\.onnx/i
    );
  } finally {
    fs.rmSync(brokenStageDir, { recursive: true, force: true });
  }
});

test("Firefox source submission stage excludes generated first-party files and keeps reproducible build docs", async () => {
  const releaseLib = await loadReleaseLib();
  const staged = releaseLib.stageSourceSubmission("firefox");
  const readme = fs.readFileSync(path.join(staged.stageDir, "README.md"), "utf8");

  assert.equal(fs.existsSync(path.join(staged.stageDir, "package-lock.json")), true);
  assert.equal(fs.existsSync(path.join(staged.stageDir, "scripts", "build.mjs")), true);
  assert.equal(fs.existsSync(path.join(staged.stageDir, "src", "background.ts")), true);
  assert.equal(fs.existsSync(path.join(staged.stageDir, "src", "background.js")), false);
  assert.equal(fs.existsSync(path.join(staged.stageDir, "src", "contentScript.js")), false);
  assert.equal(fs.existsSync(path.join(staged.stageDir, "src", "manifest.firefox.json")), false);
  assert.equal(
    fs.existsSync(path.join(staged.stageDir, "src", "vendor", "THIRD_PARTY_NOTICES.md")),
    true
  );
  assert.match(readme, /npm run zip:firefox/);
  assert.match(readme, /npm run source:firefox/);
  assert.match(readme, /Node\.js[:\s`]*22\.18\.0/);
  assert.match(readme, /npm[:\s`]*11\.11\.0/);
});
