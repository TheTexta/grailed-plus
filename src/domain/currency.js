(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusCurrency = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CACHE_KEY = "grailed_plus_exchange_rates_v1";
  var CACHE_TTL_MS = 60 * 60 * 1000;

  function normalizeCurrencyCode(input) {
    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  function getStorageLocal() {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local &&
      typeof chrome.storage.local.get === "function" &&
      typeof chrome.storage.local.set === "function"
    ) {
      return chrome.storage.local;
    }

    if (
      typeof browser !== "undefined" &&
      browser.storage &&
      browser.storage.local &&
      typeof browser.storage.local.get === "function" &&
      typeof browser.storage.local.set === "function"
    ) {
      return browser.storage.local;
    }

    return null;
  }

  function storageGet(storage, key) {
    if (!storage) {
      return Promise.resolve({});
    }

    try {
      var result = storage.get(key);
      if (result && typeof result.then === "function") {
        return result;
      }
    } catch (_) {
      // Try callback style below.
    }

    return new Promise(function (resolve) {
      try {
        storage.get(key, function (data) {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
            resolve({});
            return;
          }
          resolve(data || {});
        });
      } catch (_) {
        resolve({});
      }
    });
  }

  function storageSet(storage, payload) {
    if (!storage) {
      return Promise.resolve(false);
    }

    try {
      var result = storage.set(payload);
      if (result && typeof result.then === "function") {
        return result.then(function () {
          return true;
        });
      }
    } catch (_) {
      // Try callback style below.
    }

    return new Promise(function (resolve) {
      try {
        storage.set(payload, function () {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(true);
        });
      } catch (_) {
        resolve(false);
      }
    });
  }

  function isCacheUsable(cache, baseCurrency, nowMs) {
    if (!cache || typeof cache !== "object") {
      return false;
    }

    if (cache.base !== baseCurrency) {
      return false;
    }

    if (!cache.rates || typeof cache.rates !== "object") {
      return false;
    }

    if (!Number.isFinite(cache.timestamp) || cache.timestamp <= 0) {
      return false;
    }

    return nowMs - cache.timestamp < CACHE_TTL_MS;
  }

  function isCacheStaleButCompatible(cache, baseCurrency) {
    if (!cache || typeof cache !== "object") {
      return false;
    }
    if (cache.base !== baseCurrency) {
      return false;
    }
    if (!cache.rates || typeof cache.rates !== "object") {
      return false;
    }
    return true;
  }

  function buildPayload(baseCurrency, timestamp, rates) {
    return {
      base: baseCurrency,
      timestamp: timestamp,
      rates: rates
    };
  }

  function buildResponse(payload, source) {
    var safePayload = payload || {};
    return {
      rates: safePayload.rates && typeof safePayload.rates === "object" ? safePayload.rates : {},
      base: safePayload.base || "USD",
      timestamp: Number.isFinite(safePayload.timestamp) ? safePayload.timestamp : Date.now(),
      source: source || "unknown"
    };
  }

  function fetchLatestRates(baseCurrency) {
    if (typeof fetch !== "function") {
      return Promise.reject(new Error("fetch unavailable"));
    }

    var endpoint = "https://api.frankfurter.app/latest?base=" + encodeURIComponent(baseCurrency);
    return fetch(endpoint)
      .then(function (res) {
        if (!res || !res.ok) {
          throw new Error("failed to fetch currency rates");
        }
        return res.json();
      })
      .then(function (json) {
        var rates = json && json.rates && typeof json.rates === "object" ? json.rates : {};
        return buildPayload(baseCurrency, Date.now(), rates);
      });
  }

  function getRates(baseCurrency) {
    var normalizedBase = normalizeCurrencyCode(baseCurrency) || "USD";
    var nowMs = Date.now();
    var storage = getStorageLocal();

    return storageGet(storage, CACHE_KEY)
      .then(function (data) {
        var cache = data && data[CACHE_KEY];
        if (isCacheUsable(cache, normalizedBase, nowMs)) {
          return buildResponse(cache, "cache_fresh");
        }

        return fetchLatestRates(normalizedBase)
          .then(function (payload) {
            var wrapper = {};
            wrapper[CACHE_KEY] = payload;
            return storageSet(storage, wrapper).then(function () {
              return buildResponse(payload, "network");
            });
          })
          .catch(function () {
            if (isCacheStaleButCompatible(cache, normalizedBase)) {
              return buildResponse(cache, "cache_stale");
            }
            return buildResponse(buildPayload(normalizedBase, nowMs, {}), "fallback_empty");
          });
      })
      .catch(function () {
        return fetchLatestRates(normalizedBase)
          .then(function (payload) {
            return buildResponse(payload, "network");
          })
          .catch(function () {
            return buildResponse(buildPayload(normalizedBase, nowMs, {}), "fallback_empty");
          });
      });
  }

  function hasCurrencyCode(code, rates) {
    var normalized = normalizeCurrencyCode(code);
    if (!normalized || !rates || typeof rates !== "object") {
      return false;
    }

    return Number.isFinite(Number(rates[normalized])) && Number(rates[normalized]) > 0;
  }

  function convert(amount, from, to) {
    var amountNumber = Number(amount);
    var fromCurrency = normalizeCurrencyCode(from);
    var toCurrency = normalizeCurrencyCode(to);

    if (!Number.isFinite(amountNumber) || !fromCurrency || !toCurrency) {
      return Promise.resolve(null);
    }

    if (fromCurrency === toCurrency) {
      return Promise.resolve(amountNumber);
    }

    return getRates(fromCurrency).then(function (result) {
      var rates = result && result.rates ? result.rates : {};
      if (!hasCurrencyCode(toCurrency, rates)) {
        return null;
      }

      return amountNumber * Number(rates[toCurrency]);
    });
  }

  return {
    CACHE_KEY: CACHE_KEY,
    CACHE_TTL_MS: CACHE_TTL_MS,
    normalizeCurrencyCode: normalizeCurrencyCode,
    getRates: getRates,
    convert: convert,
    hasCurrencyCode: hasCurrencyCode
  };
});
