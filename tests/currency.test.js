"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { CACHE_KEY, CACHE_TTL_MS, getRates, convert } = require("../src/domain/currency.js");

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

function setTestGlobals(chromeMock, fetchMock) {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;
  const previousFetch = global.fetch;

  global.chrome = chromeMock;
  global.browser = undefined;
  global.fetch = fetchMock;

  return function restore() {
    global.chrome = previousChrome;
    global.browser = previousBrowser;
    global.fetch = previousFetch;
  };
}

test("getRates returns fresh cached rates without network fetch", async () => {
  const now = Date.now();
  const chromeMock = createChromeStorage({
    [CACHE_KEY]: {
      base: "USD",
      timestamp: now - 5000,
      rates: { EUR: 0.9 }
    }
  });

  let fetchCalls = 0;
  const restoreGlobals = setTestGlobals(chromeMock, async function () {
    fetchCalls += 1;
    throw new Error("should not fetch");
  });

  try {
    const result = await getRates("USD");
    assert.equal(result.source, "cache_fresh");
    assert.equal(result.base, "USD");
    assert.equal(result.rates.EUR, 0.9);
    assert.equal(fetchCalls, 0);
  } finally {
    restoreGlobals();
  }
});

test("getRates fetches and stores fresh rates when cache is stale", async () => {
  const now = Date.now();
  const chromeMock = createChromeStorage({
    [CACHE_KEY]: {
      base: "USD",
      timestamp: now - CACHE_TTL_MS - 1000,
      rates: { EUR: 0.8 }
    }
  });

  let fetchCalls = 0;
  const restoreGlobals = setTestGlobals(chromeMock, async function () {
    fetchCalls += 1;
    return {
      ok: true,
      json: async function () {
        return {
          rates: { EUR: 0.91, GBP: 0.77 }
        };
      }
    };
  });

  try {
    const result = await getRates("USD");
    assert.equal(result.source, "network");
    assert.equal(result.rates.EUR, 0.91);
    assert.equal(fetchCalls, 1);
    assert.equal(chromeMock.__state[CACHE_KEY].base, "USD");
    assert.equal(chromeMock.__state[CACHE_KEY].rates.GBP, 0.77);
    assert.ok(Number.isFinite(chromeMock.__state[CACHE_KEY].timestamp));
  } finally {
    restoreGlobals();
  }
});

test("getRates falls back to stale cache when fetch fails", async () => {
  const now = Date.now();
  const chromeMock = createChromeStorage({
    [CACHE_KEY]: {
      base: "USD",
      timestamp: now - CACHE_TTL_MS - 1000,
      rates: { EUR: 0.89 }
    }
  });

  const restoreGlobals = setTestGlobals(chromeMock, async function () {
    throw new Error("network down");
  });

  try {
    const result = await getRates("USD");
    assert.equal(result.source, "cache_stale");
    assert.equal(result.rates.EUR, 0.89);
  } finally {
    restoreGlobals();
  }
});

test("convert returns original amount when currencies match", async () => {
  const chromeMock = createChromeStorage({});
  let fetchCalls = 0;
  const restoreGlobals = setTestGlobals(chromeMock, async function () {
    fetchCalls += 1;
    throw new Error("should not fetch");
  });

  try {
    const result = await convert(100, "USD", "USD");
    assert.equal(result, 100);
    assert.equal(fetchCalls, 0);
  } finally {
    restoreGlobals();
  }
});

test("convert returns null when target currency is missing in rates", async () => {
  const now = Date.now();
  const chromeMock = createChromeStorage({
    [CACHE_KEY]: {
      base: "USD",
      timestamp: now - 3000,
      rates: { EUR: 0.92 }
    }
  });

  const restoreGlobals = setTestGlobals(chromeMock, async function () {
    throw new Error("should not fetch");
  });

  try {
    const result = await convert(100, "USD", "JPY");
    assert.equal(result, null);
  } finally {
    restoreGlobals();
  }
});
