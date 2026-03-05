"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_CURRENCY,
  STORAGE_KEY,
  normalizeCurrencyCode,
  getSelectedCurrency,
  setSelectedCurrency
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

test("getSelectedCurrency falls back to USD when unset or invalid", async () => {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;

  const chromeMock = createChromeStorage({});
  global.chrome = chromeMock;
  global.browser = undefined;

  try {
    const unsetValue = await getSelectedCurrency();
    assert.equal(unsetValue, DEFAULT_CURRENCY);

    chromeMock.__state[STORAGE_KEY] = "not-valid";
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
    assert.equal(chromeMock.__state[STORAGE_KEY], "EUR");

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
    assert.equal(chromeMock.__state[STORAGE_KEY], undefined);
  } finally {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
  }
});
