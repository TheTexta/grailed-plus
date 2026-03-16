"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_CURRENCY,
  DEFAULT_CONVERSION_ENABLED,
  DEFAULT_LISTING_INSIGHTS_ENABLED,
  DEFAULT_LISTING_METADATA_BUTTON_ENABLED,
  DEFAULT_MARKET_COMPARE_ENABLED,
  DEFAULT_MARKET_COMPARE_RANKING_FORMULA,
  DEFAULT_MARKET_COMPARE_STRICT_MODE,
  DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED,
  DEFAULT_DARK_MODE_ENABLED,
  DEFAULT_DARK_MODE_BEHAVIOR,
  DEFAULT_DARK_MODE_PRIMARY_COLOR,
  DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED,
  CURRENCY_STORAGE_KEY,
  CONVERSION_ENABLED_STORAGE_KEY,
  LISTING_INSIGHTS_ENABLED_STORAGE_KEY,
  LISTING_METADATA_BUTTON_STORAGE_KEY,
  MARKET_COMPARE_ENABLED_STORAGE_KEY,
  MARKET_COMPARE_RANKING_FORMULA_STORAGE_KEY,
  MARKET_COMPARE_STRICT_MODE_STORAGE_KEY,
  MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY,
  DARK_MODE_ENABLED_STORAGE_KEY,
  DARK_MODE_BEHAVIOR_STORAGE_KEY,
  DARK_MODE_PRIMARY_COLOR_STORAGE_KEY,
  DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_STORAGE_KEY,
  MARKET_COMPARE_RANKING_FORMULA_OPTIONS,
  normalizeCurrencyCode,
  normalizeHexColor,
  normalizeDarkModeBehavior,
  normalizeMarketCompareRankingFormula,
  getSelectedCurrency,
  setSelectedCurrency,
  getCurrencyConversionEnabled,
  setCurrencyConversionEnabled,
  getListingInsightsEnabled,
  setListingInsightsEnabled,
  getListingMetadataButtonEnabled,
  setListingMetadataButtonEnabled,
  getMarketCompareEnabled,
  setMarketCompareEnabled,
  getMarketCompareRankingFormula,
  setMarketCompareRankingFormula,
  getMarketCompareStrictMode,
  setMarketCompareStrictMode,
  getMarketCompareExpandedAmountEnabled,
  setMarketCompareExpandedAmountEnabled,
  getMarketCompareSettings,
  getDarkModeEnabled,
  setDarkModeEnabled,
  getDarkModeBehavior,
  setDarkModeBehavior,
  getDarkModePrimaryColor,
  setDarkModePrimaryColor,
  getDarkModeLegacyColorCustomizationEnabled,
  setDarkModeLegacyColorCustomizationEnabled
} = require("../.tmp/ts-build/src/domain/settings");

function createChromeStorage(initialState) {
  const state = Object.assign({}, initialState || {});

  return {
    runtime: {
      lastError: null
    },
    storage: {
      local: {
        get(key, callback) {
          const output = {};
          output[key] = state[key];
          callback(output);
        },
        set(payload, callback) {
          Object.assign(state, payload);
          callback();
        }
      }
    },
    __state: state
  };
}

test("normalizeCurrencyCode supports uppercase normalization for curated and custom codes", () => {
  assert.equal(normalizeCurrencyCode(" usd "), "USD");
  assert.equal(normalizeCurrencyCode("sek"), "SEK");
  assert.equal(normalizeCurrencyCode("US"), null);
  assert.equal(normalizeCurrencyCode("123"), null);
});

test("normalizeHexColor supports 3/6-digit values and uppercase normalization", () => {
  assert.equal(normalizeHexColor("#abc"), "#AABBCC");
  assert.equal(normalizeHexColor("a1b2c3"), "#A1B2C3");
  assert.equal(normalizeHexColor(" #0f0 "), "#00FF00");
  assert.equal(normalizeHexColor("xyz"), null);
  assert.equal(normalizeHexColor("#12345"), null);
});

test("normalizeDarkModeBehavior supports known behavior values", () => {
  assert.equal(normalizeDarkModeBehavior("system"), "system");
  assert.equal(normalizeDarkModeBehavior("PERMANENT"), "permanent");
  assert.equal(normalizeDarkModeBehavior("auto"), null);
});

test("normalizeMarketCompareRankingFormula only accepts curated formula options", () => {
  assert.equal(normalizeMarketCompareRankingFormula("balanced"), "balanced");
  assert.equal(normalizeMarketCompareRankingFormula(" VISUAL "), "visual");
  assert.equal(normalizeMarketCompareRankingFormula("metadata"), "metadata");
  assert.equal(normalizeMarketCompareRankingFormula("variant"), "variant");
  assert.equal(normalizeMarketCompareRankingFormula("random"), null);
  assert.equal(normalizeMarketCompareRankingFormula(40), null);
  assert.deepEqual(MARKET_COMPARE_RANKING_FORMULA_OPTIONS, [
    "balanced",
    "visual",
    "metadata",
    "variant"
  ]);
});

test("getSelectedCurrency falls back to USD when unset or invalid", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const unsetValue = await getSelectedCurrency();
    assert.equal(unsetValue, DEFAULT_CURRENCY);

    chromeMock.__state[CURRENCY_STORAGE_KEY] = "not-valid";
    const invalidValue = await getSelectedCurrency();
    assert.equal(invalidValue, DEFAULT_CURRENCY);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setSelectedCurrency stores normalized uppercase code", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const result = await setSelectedCurrency("eur");
    assert.deepEqual(result, { ok: true });
    assert.equal(chromeMock.__state[CURRENCY_STORAGE_KEY], "EUR");

    const selected = await getSelectedCurrency();
    assert.equal(selected, "EUR");
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setSelectedCurrency rejects invalid currency values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const result = await setSelectedCurrency("xx");
    assert.equal(result.ok, false);
    assert.match(result.error, /3-letter/);
    assert.equal(chromeMock.__state[CURRENCY_STORAGE_KEY], undefined);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getCurrencyConversionEnabled defaults to disabled", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const enabled = await getCurrencyConversionEnabled();
    assert.equal(enabled, DEFAULT_CONVERSION_ENABLED);
    assert.equal(enabled, false);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setCurrencyConversionEnabled persists boolean values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const onResult = await setCurrencyConversionEnabled(true);
    assert.deepEqual(onResult, { ok: true });
    assert.equal(chromeMock.__state[CONVERSION_ENABLED_STORAGE_KEY], true);
    assert.equal(await getCurrencyConversionEnabled(), true);

    const offResult = await setCurrencyConversionEnabled(false);
    assert.deepEqual(offResult, { ok: true });
    assert.equal(chromeMock.__state[CONVERSION_ENABLED_STORAGE_KEY], false);
    assert.equal(await getCurrencyConversionEnabled(), false);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getListingInsightsEnabled defaults to enabled", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const enabled = await getListingInsightsEnabled();
    assert.equal(enabled, DEFAULT_LISTING_INSIGHTS_ENABLED);
    assert.equal(enabled, true);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getListingInsightsEnabled ignores legacy key during hard cutover", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({
    grailed_plus_price_history_enabled_v1: false
  });
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const enabled = await getListingInsightsEnabled();
    assert.equal(enabled, DEFAULT_LISTING_INSIGHTS_ENABLED);
    assert.equal(enabled, true);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setListingInsightsEnabled persists boolean values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const offResult = await setListingInsightsEnabled(false);
    assert.deepEqual(offResult, { ok: true });
    assert.equal(chromeMock.__state[LISTING_INSIGHTS_ENABLED_STORAGE_KEY], false);
    assert.equal(await getListingInsightsEnabled(), false);

    const onResult = await setListingInsightsEnabled(true);
    assert.deepEqual(onResult, { ok: true });
    assert.equal(chromeMock.__state[LISTING_INSIGHTS_ENABLED_STORAGE_KEY], true);
    assert.equal(await getListingInsightsEnabled(), true);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getListingMetadataButtonEnabled defaults to enabled", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const enabled = await getListingMetadataButtonEnabled();
    assert.equal(enabled, DEFAULT_LISTING_METADATA_BUTTON_ENABLED);
    assert.equal(enabled, true);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setListingMetadataButtonEnabled persists boolean values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const offResult = await setListingMetadataButtonEnabled(false);
    assert.deepEqual(offResult, { ok: true });
    assert.equal(chromeMock.__state[LISTING_METADATA_BUTTON_STORAGE_KEY], false);
    assert.equal(await getListingMetadataButtonEnabled(), false);

    const onResult = await setListingMetadataButtonEnabled(true);
    assert.deepEqual(onResult, { ok: true });
    assert.equal(chromeMock.__state[LISTING_METADATA_BUTTON_STORAGE_KEY], true);
    assert.equal(await getListingMetadataButtonEnabled(), true);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getMarketCompareEnabled defaults to disabled", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const enabled = await getMarketCompareEnabled();
    assert.equal(enabled, DEFAULT_MARKET_COMPARE_ENABLED);
    assert.equal(enabled, false);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setMarketCompareEnabled persists boolean values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const onResult = await setMarketCompareEnabled(true);
    assert.deepEqual(onResult, { ok: true });
    assert.equal(chromeMock.__state[MARKET_COMPARE_ENABLED_STORAGE_KEY], true);
    assert.equal(await getMarketCompareEnabled(), true);

    const offResult = await setMarketCompareEnabled(false);
    assert.deepEqual(offResult, { ok: true });
    assert.equal(chromeMock.__state[MARKET_COMPARE_ENABLED_STORAGE_KEY], false);
    assert.equal(await getMarketCompareEnabled(), false);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getMarketCompareRankingFormula defaults to configured formula and ignores invalid stored values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const defaultFormula = await getMarketCompareRankingFormula();
    assert.equal(defaultFormula, DEFAULT_MARKET_COMPARE_RANKING_FORMULA);

    chromeMock.__state[MARKET_COMPARE_RANKING_FORMULA_STORAGE_KEY] = "random";
    const invalidFormula = await getMarketCompareRankingFormula();
    assert.equal(invalidFormula, DEFAULT_MARKET_COMPARE_RANKING_FORMULA);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setMarketCompareRankingFormula persists curated formula values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const result = await setMarketCompareRankingFormula("visual");
    assert.deepEqual(result, { ok: true });
    assert.equal(chromeMock.__state[MARKET_COMPARE_RANKING_FORMULA_STORAGE_KEY], "visual");
    assert.equal(await getMarketCompareRankingFormula(), "visual");
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setMarketCompareRankingFormula rejects unsupported formula values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const result = await setMarketCompareRankingFormula("random");
    assert.equal(result.ok, false);
    assert.match(result.error, /supported option/i);
    assert.equal(chromeMock.__state[MARKET_COMPARE_RANKING_FORMULA_STORAGE_KEY], undefined);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getMarketCompareStrictMode defaults to disabled", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const enabled = await getMarketCompareStrictMode();
    assert.equal(enabled, DEFAULT_MARKET_COMPARE_STRICT_MODE);
    assert.equal(enabled, false);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setMarketCompareStrictMode persists boolean values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const onResult = await setMarketCompareStrictMode(true);
    assert.deepEqual(onResult, { ok: true });
    assert.equal(chromeMock.__state[MARKET_COMPARE_STRICT_MODE_STORAGE_KEY], true);
    assert.equal(await getMarketCompareStrictMode(), true);

    const offResult = await setMarketCompareStrictMode(false);
    assert.deepEqual(offResult, { ok: true });
    assert.equal(chromeMock.__state[MARKET_COMPARE_STRICT_MODE_STORAGE_KEY], false);
    assert.equal(await getMarketCompareStrictMode(), false);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getMarketCompareExpandedAmountEnabled defaults to disabled", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const enabled = await getMarketCompareExpandedAmountEnabled();
    assert.equal(enabled, DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED);
    assert.equal(enabled, false);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setMarketCompareExpandedAmountEnabled persists boolean values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const onResult = await setMarketCompareExpandedAmountEnabled(true);
    assert.deepEqual(onResult, { ok: true });
    assert.equal(chromeMock.__state[MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY], true);
    assert.equal(await getMarketCompareExpandedAmountEnabled(), true);

    const offResult = await setMarketCompareExpandedAmountEnabled(false);
    assert.deepEqual(offResult, { ok: true });
    assert.equal(chromeMock.__state[MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY], false);
    assert.equal(await getMarketCompareExpandedAmountEnabled(), false);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getMarketCompareSettings returns the grouped market compare state", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({
    [MARKET_COMPARE_ENABLED_STORAGE_KEY]: true,
    [MARKET_COMPARE_RANKING_FORMULA_STORAGE_KEY]: "metadata",
    [MARKET_COMPARE_STRICT_MODE_STORAGE_KEY]: true,
    [MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY]: true
  });
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const settings = await getMarketCompareSettings();
    assert.deepEqual(settings, {
      enabled: true,
      rankingFormula: "metadata",
      strictMode: true,
      expandedAmountEnabled: true
    });
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getDarkModeEnabled defaults to enabled", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const enabled = await getDarkModeEnabled();
    assert.equal(enabled, DEFAULT_DARK_MODE_ENABLED);
    assert.equal(enabled, true);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getDarkModeBehavior defaults to system", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const behavior = await getDarkModeBehavior();
    assert.equal(behavior, DEFAULT_DARK_MODE_BEHAVIOR);
    assert.equal(behavior, "system");

    chromeMock.__state[DARK_MODE_BEHAVIOR_STORAGE_KEY] = "invalid";
    const invalidBehavior = await getDarkModeBehavior();
    assert.equal(invalidBehavior, "system");
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setDarkModeBehavior persists valid behavior values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const permanentResult = await setDarkModeBehavior("permanent");
    assert.deepEqual(permanentResult, { ok: true });
    assert.equal(chromeMock.__state[DARK_MODE_BEHAVIOR_STORAGE_KEY], "permanent");
    assert.equal(await getDarkModeBehavior(), "permanent");

    const systemResult = await setDarkModeBehavior("system");
    assert.deepEqual(systemResult, { ok: true });
    assert.equal(chromeMock.__state[DARK_MODE_BEHAVIOR_STORAGE_KEY], "system");
    assert.equal(await getDarkModeBehavior(), "system");
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setDarkModeBehavior rejects invalid values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const result = await setDarkModeBehavior("always");
    assert.equal(result.ok, false);
    assert.match(result.error, /system|permanent/i);
    assert.equal(chromeMock.__state[DARK_MODE_BEHAVIOR_STORAGE_KEY], undefined);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setDarkModeEnabled persists boolean values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const onResult = await setDarkModeEnabled(true);
    assert.deepEqual(onResult, { ok: true });
    assert.equal(chromeMock.__state[DARK_MODE_ENABLED_STORAGE_KEY], true);
    assert.equal(await getDarkModeEnabled(), true);

    const offResult = await setDarkModeEnabled(false);
    assert.deepEqual(offResult, { ok: true });
    assert.equal(chromeMock.__state[DARK_MODE_ENABLED_STORAGE_KEY], false);
    assert.equal(await getDarkModeEnabled(), false);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getDarkModePrimaryColor falls back to default when unset or invalid", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const unsetValue = await getDarkModePrimaryColor();
    assert.equal(unsetValue, DEFAULT_DARK_MODE_PRIMARY_COLOR);

    chromeMock.__state[DARK_MODE_PRIMARY_COLOR_STORAGE_KEY] = "not-a-color";
    const invalidValue = await getDarkModePrimaryColor();
    assert.equal(invalidValue, DEFAULT_DARK_MODE_PRIMARY_COLOR);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setDarkModePrimaryColor stores normalized hex color", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const result = await setDarkModePrimaryColor("#0f0");
    assert.deepEqual(result, { ok: true });
    assert.equal(chromeMock.__state[DARK_MODE_PRIMARY_COLOR_STORAGE_KEY], "#00FF00");

    const selected = await getDarkModePrimaryColor();
    assert.equal(selected, "#00FF00");
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setDarkModePrimaryColor rejects invalid hex values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const result = await setDarkModePrimaryColor("blue");
    assert.equal(result.ok, false);
    assert.match(result.error, /hex/i);
    assert.equal(chromeMock.__state[DARK_MODE_PRIMARY_COLOR_STORAGE_KEY], undefined);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("getDarkModeLegacyColorCustomizationEnabled defaults to disabled", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const enabled = await getDarkModeLegacyColorCustomizationEnabled();
    assert.equal(enabled, DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED);
    assert.equal(enabled, false);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});

test("setDarkModeLegacyColorCustomizationEnabled persists boolean values", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const onResult = await setDarkModeLegacyColorCustomizationEnabled(true);
    assert.deepEqual(onResult, { ok: true });
    assert.equal(chromeMock.__state[DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_STORAGE_KEY], true);
    assert.equal(await getDarkModeLegacyColorCustomizationEnabled(), true);

    const offResult = await setDarkModeLegacyColorCustomizationEnabled(false);
    assert.deepEqual(offResult, { ok: true });
    assert.equal(chromeMock.__state[DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_STORAGE_KEY], false);
    assert.equal(await getDarkModeLegacyColorCustomizationEnabled(), false);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});
