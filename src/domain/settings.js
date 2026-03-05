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
  var DEFAULT_PRICE_HISTORY_ENABLED = true;
  var DEFAULT_DARK_MODE_ENABLED = true;
  var DEFAULT_DARK_MODE_BEHAVIOR = "system";
  var DEFAULT_DARK_MODE_PRIMARY_COLOR = "#000000";
  var CURATED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
  var CURRENCY_STORAGE_KEY = "grailed_plus_selected_currency_v1";
  var CONVERSION_ENABLED_STORAGE_KEY = "grailed_plus_currency_enabled_v1";
  var PRICE_HISTORY_ENABLED_STORAGE_KEY = "grailed_plus_price_history_enabled_v1";
  var DARK_MODE_ENABLED_STORAGE_KEY = "grailed_plus_dark_mode_enabled_v1";
  var DARK_MODE_BEHAVIOR_STORAGE_KEY = "grailed_plus_dark_mode_behavior_v1";
  var DARK_MODE_PRIMARY_COLOR_STORAGE_KEY = "grailed_plus_dark_mode_primary_color_v1";

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

  function normalizeHexColor(input) {
    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    var shortMatch = trimmed.match(/^#?([0-9a-fA-F]{3})$/);
    if (shortMatch && shortMatch[1]) {
      var shortHex = shortMatch[1].toUpperCase();
      return (
        "#" +
        shortHex.charAt(0) +
        shortHex.charAt(0) +
        shortHex.charAt(1) +
        shortHex.charAt(1) +
        shortHex.charAt(2) +
        shortHex.charAt(2)
      );
    }

    var longMatch = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
    if (longMatch && longMatch[1]) {
      return "#" + longMatch[1].toUpperCase();
    }

    return null;
  }

  function normalizeDarkModeBehavior(input) {
    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim().toLowerCase();
    if (trimmed !== "system" && trimmed !== "permanent") {
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

  function getPriceHistoryEnabled() {
    var storage = getStorageLocal();
    if (!storage) {
      return Promise.resolve(DEFAULT_PRICE_HISTORY_ENABLED);
    }

    return storageGet(storage, PRICE_HISTORY_ENABLED_STORAGE_KEY)
      .then(function (data) {
        var storedValue = data && data[PRICE_HISTORY_ENABLED_STORAGE_KEY];
        return typeof storedValue === "boolean" ? storedValue : DEFAULT_PRICE_HISTORY_ENABLED;
      })
      .catch(function () {
        return DEFAULT_PRICE_HISTORY_ENABLED;
      });
  }

  function setPriceHistoryEnabled(enabled) {
    var storage = getStorageLocal();
    if (!storage) {
      return Promise.resolve({
        ok: false,
        error: "Storage unavailable."
      });
    }

    var payload = {};
    payload[PRICE_HISTORY_ENABLED_STORAGE_KEY] = Boolean(enabled);

    return storageSet(storage, payload)
      .then(function (ok) {
        if (!ok) {
          return {
            ok: false,
            error: "Failed to persist price history status."
          };
        }
        return {
          ok: true
        };
      })
      .catch(function () {
        return {
          ok: false,
          error: "Failed to persist price history status."
        };
      });
  }

  function getDarkModeEnabled() {
    var storage = getStorageLocal();
    if (!storage) {
      return Promise.resolve(DEFAULT_DARK_MODE_ENABLED);
    }

    return storageGet(storage, DARK_MODE_ENABLED_STORAGE_KEY)
      .then(function (data) {
        var storedValue = data && data[DARK_MODE_ENABLED_STORAGE_KEY];
        return typeof storedValue === "boolean" ? storedValue : DEFAULT_DARK_MODE_ENABLED;
      })
      .catch(function () {
        return DEFAULT_DARK_MODE_ENABLED;
      });
  }

  function setDarkModeEnabled(enabled) {
    var storage = getStorageLocal();
    if (!storage) {
      return Promise.resolve({
        ok: false,
        error: "Storage unavailable."
      });
    }

    var payload = {};
    payload[DARK_MODE_ENABLED_STORAGE_KEY] = Boolean(enabled);

    return storageSet(storage, payload)
      .then(function (ok) {
        if (!ok) {
          return {
            ok: false,
            error: "Failed to persist dark mode status."
          };
        }
        return {
          ok: true
        };
      })
      .catch(function () {
        return {
          ok: false,
          error: "Failed to persist dark mode status."
        };
      });
  }

  function getDarkModePrimaryColor() {
    var storage = getStorageLocal();
    if (!storage) {
      return Promise.resolve(DEFAULT_DARK_MODE_PRIMARY_COLOR);
    }

    return storageGet(storage, DARK_MODE_PRIMARY_COLOR_STORAGE_KEY)
      .then(function (data) {
        var normalized = normalizeHexColor(data && data[DARK_MODE_PRIMARY_COLOR_STORAGE_KEY]);
        return normalized || DEFAULT_DARK_MODE_PRIMARY_COLOR;
      })
      .catch(function () {
        return DEFAULT_DARK_MODE_PRIMARY_COLOR;
      });
  }

  function getDarkModeBehavior() {
    var storage = getStorageLocal();
    if (!storage) {
      return Promise.resolve(DEFAULT_DARK_MODE_BEHAVIOR);
    }

    return storageGet(storage, DARK_MODE_BEHAVIOR_STORAGE_KEY)
      .then(function (data) {
        var normalized = normalizeDarkModeBehavior(data && data[DARK_MODE_BEHAVIOR_STORAGE_KEY]);
        return normalized || DEFAULT_DARK_MODE_BEHAVIOR;
      })
      .catch(function () {
        return DEFAULT_DARK_MODE_BEHAVIOR;
      });
  }

  function setDarkModeBehavior(behavior) {
    var normalized = normalizeDarkModeBehavior(behavior);
    if (!normalized) {
      return Promise.resolve({
        ok: false,
        error: "Dark mode behavior must be either 'system' or 'permanent'."
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
    payload[DARK_MODE_BEHAVIOR_STORAGE_KEY] = normalized;

    return storageSet(storage, payload)
      .then(function (ok) {
        if (!ok) {
          return {
            ok: false,
            error: "Failed to persist dark mode behavior."
          };
        }
        return {
          ok: true
        };
      })
      .catch(function () {
        return {
          ok: false,
          error: "Failed to persist dark mode behavior."
        };
      });
  }

  function setDarkModePrimaryColor(color) {
    var normalized = normalizeHexColor(color);
    if (!normalized) {
      return Promise.resolve({
        ok: false,
        error: "Primary color must be a valid hex value."
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
    payload[DARK_MODE_PRIMARY_COLOR_STORAGE_KEY] = normalized;

    return storageSet(storage, payload)
      .then(function (ok) {
        if (!ok) {
          return {
            ok: false,
            error: "Failed to persist dark mode primary color."
          };
        }
        return {
          ok: true
        };
      })
      .catch(function () {
        return {
          ok: false,
          error: "Failed to persist dark mode primary color."
        };
      });
  }

  return {
    DEFAULT_CURRENCY: DEFAULT_CURRENCY,
    DEFAULT_CONVERSION_ENABLED: DEFAULT_CONVERSION_ENABLED,
    DEFAULT_PRICE_HISTORY_ENABLED: DEFAULT_PRICE_HISTORY_ENABLED,
    DEFAULT_DARK_MODE_ENABLED: DEFAULT_DARK_MODE_ENABLED,
    DEFAULT_DARK_MODE_BEHAVIOR: DEFAULT_DARK_MODE_BEHAVIOR,
    DEFAULT_DARK_MODE_PRIMARY_COLOR: DEFAULT_DARK_MODE_PRIMARY_COLOR,
    CURATED_CURRENCIES: CURATED_CURRENCIES,
    CURRENCY_STORAGE_KEY: CURRENCY_STORAGE_KEY,
    CONVERSION_ENABLED_STORAGE_KEY: CONVERSION_ENABLED_STORAGE_KEY,
    PRICE_HISTORY_ENABLED_STORAGE_KEY: PRICE_HISTORY_ENABLED_STORAGE_KEY,
    DARK_MODE_ENABLED_STORAGE_KEY: DARK_MODE_ENABLED_STORAGE_KEY,
    DARK_MODE_BEHAVIOR_STORAGE_KEY: DARK_MODE_BEHAVIOR_STORAGE_KEY,
    DARK_MODE_PRIMARY_COLOR_STORAGE_KEY: DARK_MODE_PRIMARY_COLOR_STORAGE_KEY,
    STORAGE_KEY: CURRENCY_STORAGE_KEY,
    normalizeCurrencyCode: normalizeCurrencyCode,
    normalizeHexColor: normalizeHexColor,
    normalizeDarkModeBehavior: normalizeDarkModeBehavior,
    getSelectedCurrency: getSelectedCurrency,
    setSelectedCurrency: setSelectedCurrency,
    getCurrencyConversionEnabled: getCurrencyConversionEnabled,
    setCurrencyConversionEnabled: setCurrencyConversionEnabled,
    getPriceHistoryEnabled: getPriceHistoryEnabled,
    setPriceHistoryEnabled: setPriceHistoryEnabled,
    getDarkModeEnabled: getDarkModeEnabled,
    setDarkModeEnabled: setDarkModeEnabled,
    getDarkModeBehavior: getDarkModeBehavior,
    setDarkModeBehavior: setDarkModeBehavior,
    getDarkModePrimaryColor: getDarkModePrimaryColor,
    setDarkModePrimaryColor: setDarkModePrimaryColor
  };
});
