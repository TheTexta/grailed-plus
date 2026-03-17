import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, "..");
export const sourceDir = path.join(rootDir, "src");
export const artifactsDir = path.join(rootDir, "artifacts");
export const stagingRootDir = path.join(artifactsDir, "staging");

const packageJsonPath = path.join(rootDir, "package.json");
const firefoxDataCollectionPermissions = ["searchTerms", "websiteActivity", "websiteContent"];
const firefoxStrictMinVersion = "121.0";
const sourceSubmissionSizeLimitBytes = 200 * 1024 * 1024;
const sourceSubmissionEntries = [
  ".nvmrc",
  "LICENSE",
  "README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "scripts",
  "src",
  "tests",
  "types",
  "docs/firefox-release.md",
  "docs/firefox-amo-listing.md",
  "docs/privacy-policy.html"
];
const generatedFirstPartySourceFiles = [
  "src/background.js",
  "src/contentScript.css",
  "src/contentScript.js",
  "src/domain/browserStorage.js",
  "src/domain/currency.js",
  "src/domain/settings.js",
  "src/manifest.firefox.json",
  "src/manifest.json",
  "src/options.js",
  "src/popup.js"
];
const sourceSubmissionRequiredFiles = [
  ".nvmrc",
  "README.md",
  "LICENSE",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "scripts/build.mjs",
  "scripts/package-extension.mjs",
  "scripts/package-source.mjs",
  "scripts/release-lib.mjs",
  "src/background.ts",
  "src/options.ts",
  "src/popup.ts",
  "src/content/boot.ts",
  "tests/releaseArtifacts.test.js",
  "docs/firefox-release.md"
];

function ensureDirectoryFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyPath(sourcePath, destinationPath) {
  const stats = fs.statSync(sourcePath);
  if (stats.isDirectory()) {
    ensureDirectoryFor(destinationPath);
    fs.cpSync(sourcePath, destinationPath, { recursive: true });
    return;
  }

  ensureDirectoryFor(destinationPath);
  fs.copyFileSync(sourcePath, destinationPath);
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

function normalizeRelativeAssetPath(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }

  if (/^[a-z]+:/i.test(raw) || raw.startsWith("//") || raw.startsWith("#")) {
    return null;
  }

  return raw
    .replace(/[?#].*$/, "")
    .replace(/^\.\//, "")
    .replace(/\\/g, "/");
}

function addNormalizedAssetPath(set, value) {
  const normalized = normalizeRelativeAssetPath(value);
  if (normalized) {
    set.add(normalized);
  }
}

function collectManifestAssetPaths(manifest) {
  const assetPaths = new Set();
  const safeManifest = manifest && typeof manifest === "object" ? manifest : {};
  const icons = safeManifest.icons && typeof safeManifest.icons === "object" ? safeManifest.icons : {};
  const background =
    safeManifest.background && typeof safeManifest.background === "object" ? safeManifest.background : {};

  Object.keys(icons).forEach(function (key) {
    addNormalizedAssetPath(assetPaths, icons[key]);
  });

  if (typeof background.service_worker === "string") {
    addNormalizedAssetPath(assetPaths, background.service_worker);
  }

  if (Array.isArray(background.scripts)) {
    background.scripts.forEach(function (value) {
      addNormalizedAssetPath(assetPaths, value);
    });
  }

  if (safeManifest.action && typeof safeManifest.action.default_popup === "string") {
    addNormalizedAssetPath(assetPaths, safeManifest.action.default_popup);
  }

  if (safeManifest.options_ui && typeof safeManifest.options_ui.page === "string") {
    addNormalizedAssetPath(assetPaths, safeManifest.options_ui.page);
  }

  (Array.isArray(safeManifest.content_scripts) ? safeManifest.content_scripts : []).forEach(function (entry) {
    (Array.isArray(entry && entry.js) ? entry.js : []).forEach(function (value) {
      addNormalizedAssetPath(assetPaths, value);
    });
    (Array.isArray(entry && entry.css) ? entry.css : []).forEach(function (value) {
      addNormalizedAssetPath(assetPaths, value);
    });
  });

  return assetPaths;
}

function collectHtmlAssetPaths(rootPath, htmlRelativePath) {
  const htmlPath = path.join(rootPath, htmlRelativePath);
  const html = fs.readFileSync(htmlPath, "utf8");
  const assetPaths = new Set();
  const patterns = [
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi
  ];

  patterns.forEach(function (pattern) {
    let match = pattern.exec(html);
    while (match) {
      addNormalizedAssetPath(assetPaths, match[1]);
      match = pattern.exec(html);
    }
  });

  return assetPaths;
}

function collectReferencedAssetPaths(manifest, rootPath) {
  const assetPaths = collectManifestAssetPaths(manifest);
  const pendingHtml = Array.from(assetPaths).filter(function (value) {
    return value.endsWith(".html");
  });
  const visitedHtml = new Set();

  while (pendingHtml.length > 0) {
    const htmlRelativePath = pendingHtml.shift();
    if (!htmlRelativePath || visitedHtml.has(htmlRelativePath)) {
      continue;
    }

    visitedHtml.add(htmlRelativePath);

    collectHtmlAssetPaths(rootPath, htmlRelativePath).forEach(function (value) {
      if (!assetPaths.has(value)) {
        assetPaths.add(value);
        if (value.endsWith(".html")) {
          pendingHtml.push(value);
        }
      }
    });
  }

  return Array.from(assetPaths).sort();
}

export function getExtensionVersion() {
  const rawVersion = String(readPackageJson().extensionVersion || "").trim();
  if (!/^\d+(?:\.\d+){0,3}$/.test(rawVersion)) {
    throw new Error(
      'package.json "extensionVersion" must be a Firefox/Chrome-safe numeric version string with 1-4 dot-separated parts.'
    );
  }
  return rawVersion;
}

export function getFirefoxExtensionId() {
  const rawId = String(readPackageJson().firefoxExtensionId || "").trim();
  const isGuid = /^\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/.test(rawId);
  const isEmailStyle = /^[a-zA-Z0-9._-]{1,80}@[a-zA-Z0-9._-]+$/.test(rawId);

  if (!isGuid && !isEmailStyle) {
    throw new Error(
      'package.json "firefoxExtensionId" must be a unique Firefox add-on ID in GUID or email-like format.'
    );
  }

  return rawId;
}

export function buildManifest(browser) {
  const manifest = {
    manifest_version: 3,
    name: "Grailed Plus",
    version: getExtensionVersion(),
    description: "Listing insights, currency conversion, and dark mode for grailed.com.",
    icons: {
      "64": "icons/Logo0.5x.png",
      "128": "icons/Logo1x.png",
      "256": "icons/Logo2x.png",
      "512": "icons/Logo4x.png"
    },
    permissions: ["storage"],
    host_permissions: [
      "https://*.grailed.com/*",
      "https://*.depop.com/*",
      "https://api.frankfurter.app/latest*"
    ],
    action: {
      default_title: "Grailed Plus",
      default_popup: "popup.html"
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true
    },
    content_scripts: [
      {
        matches: ["https://*.grailed.com/*"],
        js: ["contentScript.js"],
        css: ["contentScript.css"],
        run_at: "document_idle"
      }
    ]
  };

  if (browser === "chrome") {
    manifest.background = {
      service_worker: "background.js"
    };
    return manifest;
  }

  if (browser === "firefox") {
    manifest.background = {
      scripts: ["background.js"]
    };
    manifest.browser_specific_settings = {
      gecko: {
        id: getFirefoxExtensionId(),
        strict_min_version: firefoxStrictMinVersion,
        data_collection_permissions: {
          required: firefoxDataCollectionPermissions.slice()
        }
      }
    };
    return manifest;
  }

  throw new Error(`Unsupported browser target: ${browser}`);
}

export function getGeneratedManifestPath(browser) {
  if (browser === "chrome") {
    return path.join(sourceDir, "manifest.json");
  }

  if (browser === "firefox") {
    return path.join(sourceDir, "manifest.firefox.json");
  }

  throw new Error(`Unsupported browser target: ${browser}`);
}

export function writeGeneratedManifests() {
  ["chrome", "firefox"].forEach(function (browser) {
    const manifestPath = getGeneratedManifestPath(browser);
    const manifest = buildManifest(browser);
    ensureDirectoryFor(manifestPath);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  });
}

export function getStageDir(browser) {
  return path.join(stagingRootDir, browser);
}

export function getArtifactPath(browser) {
  if (browser === "chrome") {
    return path.join(artifactsDir, "grailed-plus-chrome.zip");
  }

  if (browser === "firefox") {
    return path.join(artifactsDir, "grailed-plus-firefox.xpi");
  }

  throw new Error(`Unsupported browser target: ${browser}`);
}

export function getSourceSubmissionStageDir(browser) {
  if (browser !== "firefox") {
    throw new Error(`Unsupported source submission target: ${browser}`);
  }

  return path.join(artifactsDir, "source", browser);
}

export function getSourceSubmissionArtifactPath(browser) {
  if (browser !== "firefox") {
    throw new Error(`Unsupported source submission target: ${browser}`);
  }

  return path.join(artifactsDir, `grailed-plus-${browser}-source.zip`);
}

export function validateStagedExtension(browser, explicitStageDir) {
  const stageDir = explicitStageDir || getStageDir(browser);
  const manifestPath = path.join(stageDir, "manifest.json");
  const errors = [];

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing staged manifest: ${path.relative(rootDir, manifestPath)}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const assetPaths = collectReferencedAssetPaths(manifest, stageDir);
  const hostPermissions = Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];

  if (manifest.version !== getExtensionVersion()) {
    errors.push(
      `manifest version ${JSON.stringify(manifest.version)} does not match package extensionVersion ${JSON.stringify(getExtensionVersion())}.`
    );
  }

  if (new Set(hostPermissions).size !== hostPermissions.length) {
    errors.push("host_permissions contains duplicate entries.");
  }

  assetPaths.forEach(function (relativePath) {
    const absolutePath = path.join(stageDir, relativePath);
    if (!fs.existsSync(absolutePath)) {
      errors.push(`missing referenced asset ${relativePath}`);
    }
  });

  if (browser === "chrome") {
    if (!manifest.background || manifest.background.service_worker !== "background.js") {
      errors.push('Chrome manifest must declare background.service_worker = "background.js".');
    }

    if (manifest.background && Object.prototype.hasOwnProperty.call(manifest.background, "scripts")) {
      errors.push("Chrome manifest must not declare background.scripts.");
    }
  }

  if (browser === "firefox") {
    if (!manifest.background || !Array.isArray(manifest.background.scripts)) {
      errors.push("Firefox manifest must declare background.scripts.");
    } else if (manifest.background.scripts.indexOf("background.js") === -1) {
      errors.push('Firefox background.scripts must include "background.js".');
    }

    if (manifest.background && Object.prototype.hasOwnProperty.call(manifest.background, "service_worker")) {
      errors.push("Firefox manifest must not declare background.service_worker.");
    }

    const gecko =
      manifest.browser_specific_settings && manifest.browser_specific_settings.gecko
        ? manifest.browser_specific_settings.gecko
        : null;

    if (!gecko || typeof gecko.id !== "string" || !gecko.id.trim()) {
      errors.push("Firefox manifest must declare browser_specific_settings.gecko.id.");
    } else if (gecko.id !== getFirefoxExtensionId()) {
      errors.push(
        `Firefox manifest gecko.id ${JSON.stringify(gecko.id)} does not match package firefoxExtensionId ${JSON.stringify(getFirefoxExtensionId())}.`
      );
    }

    if (!gecko || gecko.strict_min_version !== firefoxStrictMinVersion) {
      errors.push(
        `Firefox manifest must declare browser_specific_settings.gecko.strict_min_version = "${firefoxStrictMinVersion}".`
      );
    }

    const requiredPermissions =
      gecko &&
      gecko.data_collection_permissions &&
      Array.isArray(gecko.data_collection_permissions.required)
        ? gecko.data_collection_permissions.required
        : [];

    firefoxDataCollectionPermissions.forEach(function (value) {
      if (requiredPermissions.indexOf(value) === -1) {
        errors.push(
          `Firefox manifest must declare browser_specific_settings.gecko.data_collection_permissions.required including "${value}".`
        );
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(
      `Staged ${browser} package validation failed:\n- ${errors.join("\n- ")}`
    );
  }

  return {
    browser,
    stageDir,
    manifest,
    assetPaths
  };
}

export function stageExtension(browser) {
  writeGeneratedManifests();

  const stageDir = getStageDir(browser);
  const manifest = buildManifest(browser);
  const assetPaths = collectReferencedAssetPaths(manifest, sourceDir);

  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

  assetPaths.forEach(function (relativePath) {
    const sourcePath = path.join(sourceDir, relativePath);
    const destinationPath = path.join(stageDir, relativePath);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Cannot stage missing source asset: ${relativePath}`);
    }

    ensureDirectoryFor(destinationPath);
    fs.copyFileSync(sourcePath, destinationPath);
  });

  return validateStagedExtension(browser, stageDir);
}

export function createExtensionArchive(browser, explicitStageDir) {
  const stageDir = explicitStageDir || getStageDir(browser);
  const outputFile = getArtifactPath(browser);

  fs.mkdirSync(artifactsDir, { recursive: true });
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }

  const result = spawnSync(
    "zip",
    ["-rq", outputFile, ".", "-x", "*.DS_Store", "__MACOSX/*"],
    {
      cwd: stageDir,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to package ${browser} archive.`);
  }

  return {
    browser,
    stageDir,
    outputFile
  };
}

export function validateSourceSubmissionStage(browser, explicitStageDir) {
  const stageDir = explicitStageDir || getSourceSubmissionStageDir(browser);
  const errors = [];

  sourceSubmissionRequiredFiles.forEach(function (relativePath) {
    if (!fs.existsSync(path.join(stageDir, relativePath))) {
      errors.push(`missing source submission file ${relativePath}`);
    }
  });

  generatedFirstPartySourceFiles.forEach(function (relativePath) {
    if (fs.existsSync(path.join(stageDir, relativePath))) {
      errors.push(`generated first-party file must be excluded from source submission: ${relativePath}`);
    }
  });

  const readmePath = path.join(stageDir, "README.md");
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, "utf8");
    if (!readme.includes("npm run zip:firefox")) {
      errors.push('README.md must document the exact Firefox build command "npm run zip:firefox".');
    }
    if (!readme.includes("npm run source:firefox")) {
      errors.push('README.md must document the AMO source packaging command "npm run source:firefox".');
    }
    if (!/Node\.js[:\s`]*22\.18\.0/.test(readme)) {
      errors.push('README.md must document the required Node.js version "22.18.0".');
    }
    if (!/npm[:\s`]*11\.11\.0/.test(readme)) {
      errors.push('README.md must document the required npm version "11.11.0".');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Source submission validation failed:\n- ${errors.join("\n- ")}`
    );
  }

  return {
    browser,
    stageDir
  };
}

export function stageSourceSubmission(browser) {
  const stageDir = getSourceSubmissionStageDir(browser);

  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  sourceSubmissionEntries.forEach(function (relativePath) {
    const sourcePath = path.join(rootDir, relativePath);
    const destinationPath = path.join(stageDir, relativePath);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Cannot stage missing source submission path: ${relativePath}`);
    }

    copyPath(sourcePath, destinationPath);
  });

  generatedFirstPartySourceFiles.forEach(function (relativePath) {
    fs.rmSync(path.join(stageDir, relativePath), { recursive: true, force: true });
  });

  return validateSourceSubmissionStage(browser, stageDir);
}

export function createSourceSubmissionArchive(browser, explicitStageDir) {
  const stageDir = explicitStageDir || getSourceSubmissionStageDir(browser);
  const outputFile = getSourceSubmissionArtifactPath(browser);

  fs.mkdirSync(artifactsDir, { recursive: true });
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }

  const result = spawnSync(
    "zip",
    ["-rq", outputFile, ".", "-x", "*.DS_Store", "__MACOSX/*"],
    {
      cwd: stageDir,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to package ${browser} source archive.`);
  }

  const archiveSize = fs.statSync(outputFile).size;
  if (archiveSize > sourceSubmissionSizeLimitBytes) {
    throw new Error(
      `Source archive is ${archiveSize} bytes, which exceeds the AMO 200 MB limit.`
    );
  }

  return {
    browser,
    stageDir,
    outputFile,
    archiveSize
  };
}
