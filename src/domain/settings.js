(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusSettings = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULT_CURRENCY = "USD";
  var DEFAULT_CONVERSION_ENABLED = false;
  var CURATED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
  var CURRENCY_STORAGE_KEY = "grailed_plus_selected_currency_v1";
  var CONVERSION_ENABLED_STORAGE_KEY = "grailed_plus_currency_enabled_v1";

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

  function getSelectedCurrency() {
    var storage = getStorageLocal();
    if (!storage) {
      return Promise.resolve(DEFAULT_CURRENCY);
    }

    return storageGet(storage, CURRENCY_STORAGE_KEY)
      .then(function (data) {
        var normalized = normalizeCurrencyCode(data && data[CURRENCY_STORAGE_KEY]);
        return normalized || DEFAULT_CURRENCY;
      })
      .catch(function () {
        return DEFAULT_CURRENCY;
      });
  }

  function setSelectedCurrency(code) {
    var normalized = normalizeCurrencyCode(code);
    if (!normalized) {
      return Promise.resolve({
        ok: false,
        error: "Currency must be a 3-letter code."
      });
    }

    var storage = getStorageLocal();
    if (!storage) {
      return Promise.resolve({
        ok: false,
        error: "Storage unavailable."
      });
    }

    var payload = {};
    payload[CURRENCY_STORAGE_KEY] = normalized;

    return storageSet(storage, payload)
      .then(function (ok) {
        if (!ok) {
          return {
            ok: false,
            error: "Failed to persist currency."
          };
        }
        return {
          ok: true
        };
      })
      .catch(function () {
        return {
          ok: false,
          error: "Failed to persist currency."
        };
      });
  }

  function getCurrencyConversionEnabled() {
    var storage = getStorageLocal();
    if (!storage) {
      return Promise.resolve(DEFAULT_CONVERSION_ENABLED);
    }

    return storageGet(storage, CONVERSION_ENABLED_STORAGE_KEY)
      .then(function (data) {
        return Boolean(data && data[CONVERSION_ENABLED_STORAGE_KEY]);
      })
      .catch(function () {
        return DEFAULT_CONVERSION_ENABLED;
      });
  }

  function setCurrencyConversionEnabled(enabled) {
    var storage = getStorageLocal();
    if (!storage) {
      return Promise.resolve({
        ok: false,
        error: "Storage unavailable."
      });
    }

    var payload = {};
    payload[CONVERSION_ENABLED_STORAGE_KEY] = Boolean(enabled);

    return storageSet(storage, payload)
      .then(function (ok) {
        if (!ok) {
          return {
            ok: false,
            error: "Failed to persist conversion status."
          };
        }
        return {
          ok: true
        };
      })
      .catch(function () {
        return {
          ok: false,
          error: "Failed to persist conversion status."
        };
      });
  }

  return {
    DEFAULT_CURRENCY: DEFAULT_CURRENCY,
    DEFAULT_CONVERSION_ENABLED: DEFAULT_CONVERSION_ENABLED,
    CURATED_CURRENCIES: CURATED_CURRENCIES,
    CURRENCY_STORAGE_KEY: CURRENCY_STORAGE_KEY,
    CONVERSION_ENABLED_STORAGE_KEY: CONVERSION_ENABLED_STORAGE_KEY,
    STORAGE_KEY: CURRENCY_STORAGE_KEY,
    normalizeCurrencyCode: normalizeCurrencyCode,
    getSelectedCurrency: getSelectedCurrency,
    setSelectedCurrency: setSelectedCurrency,
    getCurrencyConversionEnabled: getCurrencyConversionEnabled,
    setCurrencyConversionEnabled: setCurrencyConversionEnabled
  };
});
