"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_CURRENCY,
  DEFAULT_CONVERSION_ENABLED,
  DEFAULT_DARK_MODE_ENABLED,
  DEFAULT_DARK_MODE_BEHAVIOR,
  DEFAULT_DARK_MODE_PRIMARY_COLOR,
  CURRENCY_STORAGE_KEY,
  CONVERSION_ENABLED_STORAGE_KEY,
  DARK_MODE_ENABLED_STORAGE_KEY,
  DARK_MODE_BEHAVIOR_STORAGE_KEY,
  DARK_MODE_PRIMARY_COLOR_STORAGE_KEY,
  normalizeCurrencyCode,
  normalizeHexColor,
  normalizeDarkModeBehavior,
  getSelectedCurrency,
  setSelectedCurrency,
  getCurrencyConversionEnabled,
  setCurrencyConversionEnabled,
  getDarkModeEnabled,
  setDarkModeEnabled,
  getDarkModeBehavior,
  setDarkModeBehavior,
  getDarkModePrimaryColor,
  setDarkModePrimaryColor
} = require("../src/domain/settings.js");

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
