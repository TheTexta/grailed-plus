"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const MESSAGE_TYPE = "grailed-plus:depop-search-fetch";
const VALID_SEARCH_URL = "https://www.depop.com/search/?q=archive+jacket";
const VALID_SENDER = { tab: { url: "https://www.grailed.com/listings/123" } };
const TIMEOUT_OVERRIDE_KEY = "__grailedPlusBackgroundFetchTimeoutMs";

function loadBackgroundWithMocks(options = {}) {
  const previousChrome = global.chrome;
  const previousFetch = global.fetch;
  const previousTimeoutOverride = global[TIMEOUT_OVERRIDE_KEY];

  let listener = null;

  global.chrome = {
    runtime: {
      onMessage: {
        addListener(fn) {
          listener = fn;
        }
      }
    }
  };

  const fetchCalls = [];
  global.fetch =
    typeof options.fetchImpl === "function"
      ? options.fetchImpl
      : async function (url, options) {
          fetchCalls.push({ url, options });
          return {
            ok: true,
            status: 200,
            async text() {
              return "<html>ok</html>";
            }
          };
        };

  if (Number.isFinite(Number(options.timeoutMs))) {
    global[TIMEOUT_OVERRIDE_KEY] = Number(options.timeoutMs);
  } else {
    delete global[TIMEOUT_OVERRIDE_KEY];
  }

  const modulePath = require.resolve("../src/background.js");
  delete require.cache[modulePath];
  require(modulePath);

  function restore() {
    if (previousChrome === undefined) {
      delete global.chrome;
    } else {
      global.chrome = previousChrome;
    }

    if (previousFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = previousFetch;
    }

    if (previousTimeoutOverride === undefined) {
      delete global[TIMEOUT_OVERRIDE_KEY];
    } else {
      global[TIMEOUT_OVERRIDE_KEY] = previousTimeoutOverride;
    }

    delete require.cache[modulePath];
  }

  return {
    listener,
    fetchCalls,
    restore
  };
}

function waitForResponse(invokeListener) {
  return new Promise((resolve) => {
    invokeListener((payload) => {
      resolve(payload);
    });
  });
}

test("background listener rejects mismatched message version", async () => {
  const { listener, fetchCalls, restore } = loadBackgroundWithMocks();

  try {
    assert.equal(typeof listener, "function");

    const response = await waitForResponse((sendResponse) => {
      const keepAlive = listener(
        {
          type: MESSAGE_TYPE,
          url: VALID_SEARCH_URL,
          v: 999
        },
        VALID_SENDER,
        sendResponse
      );

      assert.equal(keepAlive, true);
    });

    assert.equal(response.ok, false);
    assert.equal(response.status, 400);
    assert.equal(response.error, "invalid_request");
    assert.equal(fetchCalls.length, 0);
  } finally {
    restore();
  }
});

test("background listener falls back to default accept header when custom value is too long", async () => {
  const { listener, fetchCalls, restore } = loadBackgroundWithMocks();

  try {
    assert.equal(typeof listener, "function");

    const response = await waitForResponse((sendResponse) => {
      const keepAlive = listener(
        {
          type: MESSAGE_TYPE,
          url: VALID_SEARCH_URL,
          accept: "text/plain;" + "x".repeat(300)
        },
        VALID_SENDER,
        sendResponse
      );

      assert.equal(keepAlive, true);
    });

    assert.equal(response.ok, true);
    assert.equal(response.status, 200);
    assert.equal(fetchCalls.length, 1);

    const headers = fetchCalls[0].options.headers;
    assert.equal(
      headers.Accept,
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    );
    assert.match(String(headers["Accept-Language"] || ""), /en-US,en;q=0\.9$/);
  } finally {
    restore();
  }
});

test("background listener rejects non-grailed sender", async () => {
  const { listener, fetchCalls, restore } = loadBackgroundWithMocks();

  try {
    assert.equal(typeof listener, "function");

    const response = await waitForResponse((sendResponse) => {
      const keepAlive = listener(
        {
          type: MESSAGE_TYPE,
          url: VALID_SEARCH_URL
        },
        { tab: { url: "https://example.com/" } },
        sendResponse
      );

      assert.equal(keepAlive, true);
    });

    assert.equal(response.ok, false);
    assert.equal(response.status, 400);
    assert.equal(response.error, "invalid_request");
    assert.equal(fetchCalls.length, 0);
  } finally {
    restore();
  }
});

test("background listener returns timeout when depop fetch exceeds timeout", async () => {
  const { listener, restore } = loadBackgroundWithMocks({
    timeoutMs: 10,
    fetchImpl: async function (_url, options) {
      return new Promise(function (_resolve, reject) {
        const signal = options && options.signal;
        if (!signal || typeof signal.addEventListener !== "function") {
          return;
        }

        signal.addEventListener("abort", function () {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    }
  });

  try {
    assert.equal(typeof listener, "function");

    const response = await waitForResponse((sendResponse) => {
      const keepAlive = listener(
        {
          type: MESSAGE_TYPE,
          url: VALID_SEARCH_URL
        },
        VALID_SENDER,
        sendResponse
      );

      assert.equal(keepAlive, true);
    });

    assert.equal(response.ok, false);
    assert.equal(response.status, 0);
    assert.equal(response.error, "timeout");
  } finally {
    restore();
  }
});
