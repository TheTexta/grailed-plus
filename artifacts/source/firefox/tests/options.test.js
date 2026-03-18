"use strict";

const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const { MockDocument } = require("./helpers/mockDocument");

function flushAsync() {
  return Promise.resolve().then(function () {
    return Promise.resolve();
  });
}

function createNode(doc, tagName, id) {
  const node = doc.createElement(tagName);
  if (id) {
    node.id = id;
    doc.registerElementById(id, node);
  }
  return node;
}

function createOptionsDocument() {
  const doc = new MockDocument();
  doc.readyState = "complete";
  doc.addEventListener = function () {};

  const form = createNode(doc, "form", "currency-form");
  const status = createNode(doc, "p", "status");
  const resetButton = createNode(doc, "button", "reset-button");

  const idsByTag = [
    ["input", "conversion-enabled"],
    ["input", "listing-insights-enabled"],
    ["input", "listing-metadata-button-enabled"],
    ["input", "market-compare-enabled"],
    ["select", "market-compare-ranking-formula"],
    ["div", "market-compare-ranking-formula-description"],
    ["input", "market-compare-strict-mode"],
    ["input", "market-compare-expanded-amount-enabled"],
    ["input", "market-compare-ml-similarity-enabled"],
    ["select", "currency-select"],
    ["input", "currency-custom"],
    ["input", "dark-mode-enabled"],
    ["select", "dark-mode-behavior"],
    ["input", "dark-mode-legacy-color-enabled"],
    ["div", "dark-mode-legacy-color-controls"],
    ["input", "dark-mode-primary"],
    ["input", "dark-mode-primary-hex"]
  ];

  const nodes = {
    form,
    status,
    resetButton
  };

  idsByTag.forEach(function (entry) {
    const node = createNode(doc, entry[0], entry[1]);
    form.appendChild(node);
    nodes[entry[1]] = node;
  });

  doc.body.appendChild(form);
  doc.body.appendChild(resetButton);
  doc.body.appendChild(status);

  nodes["currency-custom"].value = "";
  nodes["currency-select"].value = "USD";
  nodes["market-compare-ranking-formula"].value = "balanced";
  nodes["dark-mode-behavior"].value = "system";
  nodes["dark-mode-primary"].value = "#000000";
  nodes["dark-mode-primary-hex"].value = "#000000";
  nodes["market-compare-ml-similarity-enabled"].checked = false;

  return {
    document: doc,
    nodes
  };
}

function createSettingsMock(overrides) {
  const state = {
    marketCompare: {
      enabled: true,
      rankingFormula: "balanced",
      strictMode: false,
      expandedAmountEnabled: false,
      mlSimilarityEnabled: true
    }
  };
  const saveCalls = [];
  const settings = {
    CURATED_CURRENCIES: ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"],
    MARKET_COMPARE_RANKING_FORMULA_OPTIONS: ["balanced", "visual", "metadata", "variant"],
    DEFAULT_CURRENCY: "USD",
    DEFAULT_CONVERSION_ENABLED: false,
    DEFAULT_LISTING_INSIGHTS_ENABLED: true,
    DEFAULT_LISTING_METADATA_BUTTON_ENABLED: true,
    DEFAULT_MARKET_COMPARE_ENABLED: true,
    DEFAULT_MARKET_COMPARE_RANKING_FORMULA: "balanced",
    DEFAULT_MARKET_COMPARE_STRICT_MODE: false,
    DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED: false,
    DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED: true,
    DEFAULT_DARK_MODE_ENABLED: true,
    DEFAULT_DARK_MODE_BEHAVIOR: "system",
    DEFAULT_DARK_MODE_PRIMARY_COLOR: "#000000",
    DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED: false,
    normalizeCurrencyCode: function (input) {
      if (typeof input !== "string") {
        return null;
      }
      const trimmed = input.trim().toUpperCase();
      return /^[A-Z]{3}$/.test(trimmed) ? trimmed : null;
    },
    normalizeHexColor: function (input) {
      if (typeof input !== "string") {
        return null;
      }
      const trimmed = input.trim().toUpperCase();
      return /^#[0-9A-F]{6}$/.test(trimmed) ? trimmed : null;
    },
    normalizeDarkModeBehavior: function (input) {
      if (typeof input !== "string") {
        return null;
      }
      const trimmed = input.trim().toLowerCase();
      return trimmed === "system" || trimmed === "permanent" ? trimmed : null;
    },
    normalizeMarketCompareRankingFormula: function (input) {
      if (typeof input !== "string") {
        return null;
      }
      const normalized = input.trim().toLowerCase();
      return ["balanced", "visual", "metadata", "variant"].includes(normalized)
        ? normalized
        : null;
    },
    getSelectedCurrency: () => Promise.resolve("USD"),
    setSelectedCurrency: function (value) {
      saveCalls.push(["currency", value]);
      return Promise.resolve({ ok: true });
    },
    getCurrencyConversionEnabled: () => Promise.resolve(false),
    setCurrencyConversionEnabled: function (value) {
      saveCalls.push(["conversion", value]);
      return Promise.resolve({ ok: true });
    },
    getListingInsightsEnabled: () => Promise.resolve(true),
    setListingInsightsEnabled: function (value) {
      saveCalls.push(["listingInsights", value]);
      return Promise.resolve({ ok: true });
    },
    getListingMetadataButtonEnabled: () => Promise.resolve(true),
    setListingMetadataButtonEnabled: function (value) {
      saveCalls.push(["metadataButton", value]);
      return Promise.resolve({ ok: true });
    },
    getMarketCompareSettings: function () {
      return Promise.resolve(Object.assign({}, state.marketCompare));
    },
    setMarketCompareEnabled: function (value) {
      saveCalls.push(["marketCompareEnabled", value]);
      state.marketCompare.enabled = Boolean(value);
      return Promise.resolve({ ok: true });
    },
    setMarketCompareRankingFormula: function (value) {
      saveCalls.push(["marketCompareRankingFormula", value]);
      state.marketCompare.rankingFormula = String(value);
      return Promise.resolve({ ok: true });
    },
    setMarketCompareStrictMode: function (value) {
      saveCalls.push(["marketCompareStrictMode", value]);
      state.marketCompare.strictMode = Boolean(value);
      return Promise.resolve({ ok: true });
    },
    getMarketCompareExpandedAmountEnabled: () => Promise.resolve(false),
    setMarketCompareExpandedAmountEnabled: function (value) {
      saveCalls.push(["marketCompareExpandedAmountEnabled", value]);
      state.marketCompare.expandedAmountEnabled = Boolean(value);
      return Promise.resolve({ ok: true });
    },
    setMarketCompareMlSimilarityEnabled: function (value) {
      saveCalls.push(["marketCompareMlSimilarityEnabled", value]);
      state.marketCompare.mlSimilarityEnabled = Boolean(value);
      return Promise.resolve({ ok: true });
    },
    getDarkModeEnabled: () => Promise.resolve(true),
    setDarkModeEnabled: function (value) {
      saveCalls.push(["darkModeEnabled", value]);
      return Promise.resolve({ ok: true });
    },
    getDarkModeBehavior: () => Promise.resolve("system"),
    setDarkModeBehavior: function (value) {
      saveCalls.push(["darkModeBehavior", value]);
      return Promise.resolve({ ok: true });
    },
    getDarkModePrimaryColor: () => Promise.resolve("#000000"),
    setDarkModePrimaryColor: function (value) {
      saveCalls.push(["darkModePrimaryColor", value]);
      return Promise.resolve({ ok: true });
    },
    getDarkModeLegacyColorCustomizationEnabled: () => Promise.resolve(false),
    setDarkModeLegacyColorCustomizationEnabled: function (value) {
      saveCalls.push(["darkModeLegacyColorCustomizationEnabled", value]);
      return Promise.resolve({ ok: true });
    }
  };

  return {
    settings: Object.assign(settings, overrides || {}),
    state,
    saveCalls
  };
}

function loadOptionsModule(documentObj, settings, currency) {
  const previousDocument = global.document;
  const previousCurrency = global.GrailedPlusCurrency;
  const previousSettings = global.GrailedPlusSettings;
  const modulePath = require.resolve("../.tmp/ts-build/src/options");

  delete require.cache[modulePath];
  global.document = documentObj;
  global.GrailedPlusSettings = settings;
  global.GrailedPlusCurrency =
    currency ||
    {
      getRates: () => Promise.resolve({ rates: { USD: 1 } }),
      hasCurrencyCode: () => true
    };

  require(modulePath);

  return function cleanup() {
    delete require.cache[modulePath];
    global.document = previousDocument;
    global.GrailedPlusSettings = previousSettings;
    global.GrailedPlusCurrency = previousCurrency;
  };
}

test("options page loads market compare settings and keeps saved subordinate values while disabled", async () => {
  const { document, nodes } = createOptionsDocument();
  const env = createSettingsMock({
    getMarketCompareSettings: () =>
      Promise.resolve({
        enabled: false,
        rankingFormula: "visual",
        strictMode: true,
        expandedAmountEnabled: true,
        mlSimilarityEnabled: false
      })
  });
  const cleanup = loadOptionsModule(document, env.settings);

  try {
    await flushAsync();

    assert.equal(nodes["market-compare-enabled"].checked, false);
    assert.equal(nodes["market-compare-ranking-formula"].value, "visual");
    assert.match(
      nodes["market-compare-ranking-formula-description"].textContent,
      /Thumbnail-first: score = 0\.50\*image similarity \+ 0\.20\*title/i
    );
    assert.equal(nodes["market-compare-strict-mode"].checked, true);
    assert.equal(nodes["market-compare-expanded-amount-enabled"].checked, true);
    assert.equal(nodes["market-compare-ml-similarity-enabled"].checked, false);
    assert.equal(nodes["market-compare-ranking-formula"].disabled, true);
    assert.equal(nodes["market-compare-strict-mode"].disabled, true);
    assert.equal(nodes["market-compare-expanded-amount-enabled"].disabled, true);
    assert.equal(nodes["market-compare-ml-similarity-enabled"].disabled, true);
  } finally {
    cleanup();
  }
});

test("options page exposes the ML similarity toggle and updated image-similarity copy", async () => {
  const { document, nodes } = createOptionsDocument();
  const env = createSettingsMock();
  const cleanup = loadOptionsModule(document, env.settings);

  try {
    await flushAsync();

    const mlToggle = nodes["market-compare-ml-similarity-enabled"];
    assert.equal(mlToggle.disabled, false);
    assert.equal(mlToggle.checked, true);
    const html = fs.readFileSync("src/options.html", "utf8");
    const css = fs.readFileSync("src/ui.css", "utf8");
    assert.match(html, /market-compare-ranking-formula-description/);
    assert.match(html, /market-compare-ml-similarity-enabled/);
    assert.match(html, /Image similarity uses local MobileCLIP thumbnail embeddings/i);
    assert.match(html, /falls back to fast local thumbnail fingerprints/i);
    assert.match(html, /Use ML visual similarity when available/i);
    assert.match(
      html,
      /Uses local MobileCLIP thumbnail embeddings and falls back to fast thumbnail fingerprints when the model is cold or unavailable\./i
    );
    assert.match(css, /\.gp-options__section\s*\{[^}]*border-radius:\s*0;/s);
    assert.match(css, /\.gp-options__setting-card\s*\{[^}]*border-radius:\s*0;/s);
    assert.match(css, /\.gp-options__control\s*\{[^}]*border-radius:\s*0;/s);
    assert.match(css, /\.gp-options__formula-note\s*\{[^}]*border-radius:\s*0;/s);
    assert.match(css, /\.gp-options__legacy-group\s*\{[^}]*border-radius:\s*0;/s);
  } finally {
    cleanup();
  }
});

test("options page saves live market compare settings including ML similarity", async () => {
  const { document, nodes } = createOptionsDocument();
  const env = createSettingsMock();
  const cleanup = loadOptionsModule(document, env.settings);

  try {
    await flushAsync();

    nodes["market-compare-enabled"].checked = true;
    nodes["market-compare-enabled"]._listeners.change();
    nodes["market-compare-ranking-formula"].value = "metadata";
    nodes["market-compare-strict-mode"].checked = true;
    nodes["market-compare-expanded-amount-enabled"].checked = true;
    nodes["market-compare-ml-similarity-enabled"].checked = false;

    nodes.form._listeners.submit({
      preventDefault() {}
    });

    await flushAsync();

    assert.deepEqual(
      env.saveCalls.filter(function (entry) {
        return String(entry[0]).indexOf("marketCompare") === 0;
      }),
      [
        ["marketCompareEnabled", true],
        ["marketCompareRankingFormula", "metadata"],
        ["marketCompareStrictMode", true],
        ["marketCompareExpandedAmountEnabled", true],
        ["marketCompareMlSimilarityEnabled", false]
      ]
    );
    assert.match(nodes.status.textContent, /Saved/);
  } finally {
    cleanup();
  }
});

test("options page updates the ranking formula description when the selection changes", async () => {
  const { document, nodes } = createOptionsDocument();
  const env = createSettingsMock();
  const cleanup = loadOptionsModule(document, env.settings);

  try {
    await flushAsync();

    assert.match(
      nodes["market-compare-ranking-formula-description"].textContent,
      /0\.22\*image similarity \+ 0\.34\*title/i
    );

    nodes["market-compare-ranking-formula"].value = "variant";
    nodes["market-compare-ranking-formula"]._listeners.change();

    assert.match(
      nodes["market-compare-ranking-formula-description"].textContent,
      /0\.30\*size \+ 0\.18\*condition/i
    );
  } finally {
    cleanup();
  }
});

test("options page reset restores default market compare values and keeps subordinate controls available", async () => {
  const { document, nodes } = createOptionsDocument();
  const env = createSettingsMock({
    DEFAULT_MARKET_COMPARE_ENABLED: true,
    DEFAULT_MARKET_COMPARE_RANKING_FORMULA: "balanced",
    DEFAULT_MARKET_COMPARE_STRICT_MODE: false,
    DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED: false,
    DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED: true,
    getMarketCompareSettings: () =>
      Promise.resolve({
        enabled: true,
        rankingFormula: "visual",
        strictMode: true,
        expandedAmountEnabled: true,
        mlSimilarityEnabled: false
      })
  });
  const cleanup = loadOptionsModule(document, env.settings);

  try {
    await flushAsync();
    nodes.resetButton._listeners.click();
    await flushAsync();

    assert.equal(nodes["market-compare-enabled"].checked, true);
    assert.equal(nodes["market-compare-ranking-formula"].value, "balanced");
    assert.equal(nodes["market-compare-strict-mode"].checked, false);
    assert.equal(nodes["market-compare-expanded-amount-enabled"].checked, false);
    assert.equal(nodes["market-compare-ml-similarity-enabled"].checked, true);
    assert.equal(nodes["market-compare-ranking-formula"].disabled, false);
    assert.equal(nodes["market-compare-strict-mode"].disabled, false);
    assert.equal(nodes["market-compare-expanded-amount-enabled"].disabled, false);
    assert.equal(nodes["market-compare-ml-similarity-enabled"].disabled, false);
    assert.match(nodes.status.textContent, /Reset to defaults/);
  } finally {
    cleanup();
  }
});
