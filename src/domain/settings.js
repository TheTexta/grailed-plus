"use strict";
(function (root, factory) {
    if (typeof module === "object" && module && module.exports) {
        module.exports = factory();
    }
    else {
        root.GrailedPlusSettings = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : {}, function () {
    "use strict";
    const DEFAULT_CURRENCY = "USD";
    const DEFAULT_CONVERSION_ENABLED = false;
    const DEFAULT_LISTING_INSIGHTS_ENABLED = true;
    const DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED = false;
    const DEFAULT_DARK_MODE_ENABLED = true;
    const DEFAULT_DARK_MODE_BEHAVIOR = "system";
    const DEFAULT_DARK_MODE_PRIMARY_COLOR = "#000000";
    const CURATED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
    const CURRENCY_STORAGE_KEY = "grailed_plus_selected_currency_v1";
    const CONVERSION_ENABLED_STORAGE_KEY = "grailed_plus_currency_enabled_v1";
    const LISTING_INSIGHTS_ENABLED_STORAGE_KEY = "grailed_plus_listing_insights_enabled_v1";
    const MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY = "grailed_plus_market_compare_expanded_amount_enabled_v1";
    const DARK_MODE_ENABLED_STORAGE_KEY = "grailed_plus_dark_mode_enabled_v1";
    const DARK_MODE_BEHAVIOR_STORAGE_KEY = "grailed_plus_dark_mode_behavior_v1";
    const DARK_MODE_PRIMARY_COLOR_STORAGE_KEY = "grailed_plus_dark_mode_primary_color_v1";
    function normalizeCurrencyCode(input) {
        if (typeof input !== "string") {
            return null;
        }
        const trimmed = input.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(trimmed)) {
            return null;
        }
        return trimmed;
    }
    function normalizeHexColor(input) {
        if (typeof input !== "string") {
            return null;
        }
        const trimmed = input.trim();
        if (!trimmed) {
            return null;
        }
        const shortMatch = trimmed.match(/^#?([0-9a-fA-F]{3})$/);
        if (shortMatch && shortMatch[1]) {
            const shortHex = shortMatch[1].toUpperCase();
            return ("#" +
                shortHex.charAt(0) +
                shortHex.charAt(0) +
                shortHex.charAt(1) +
                shortHex.charAt(1) +
                shortHex.charAt(2) +
                shortHex.charAt(2));
        }
        const longMatch = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
        if (longMatch && longMatch[1]) {
            return "#" + longMatch[1].toUpperCase();
        }
        return null;
    }
    function normalizeDarkModeBehavior(input) {
        if (typeof input !== "string") {
            return null;
        }
        const trimmed = input.trim().toLowerCase();
        if (trimmed !== "system" && trimmed !== "permanent") {
            return null;
        }
        return trimmed;
    }
    function getStorageLocal() {
        if (typeof chrome !== "undefined" &&
            chrome.storage &&
            chrome.storage.local &&
            typeof chrome.storage.local.get === "function" &&
            typeof chrome.storage.local.set === "function") {
            return chrome.storage.local;
        }
        if (typeof browser !== "undefined" &&
            browser.storage &&
            browser.storage.local &&
            typeof browser.storage.local.get === "function" &&
            typeof browser.storage.local.set === "function") {
            return browser.storage.local;
        }
        return null;
    }
    function storageGet(storage, key) {
        if (!storage) {
            return Promise.resolve({});
        }
        try {
            const result = storage.get(key);
            if (result && typeof result.then === "function") {
                return result;
            }
        }
        catch (_) {
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
            }
            catch (_) {
                resolve({});
            }
        });
    }
    function storageSet(storage, payload) {
        if (!storage) {
            return Promise.resolve(false);
        }
        try {
            const result = storage.set(payload);
            if (result && typeof result.then === "function") {
                return result.then(function () {
                    return true;
                });
            }
        }
        catch (_) {
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
            }
            catch (_) {
                resolve(false);
            }
        });
    }
    function getSelectedCurrency() {
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve(DEFAULT_CURRENCY);
        }
        return storageGet(storage, CURRENCY_STORAGE_KEY)
            .then(function (data) {
            const normalized = normalizeCurrencyCode(data && data[CURRENCY_STORAGE_KEY]);
            return normalized || DEFAULT_CURRENCY;
        })
            .catch(function () {
            return DEFAULT_CURRENCY;
        });
    }
    function setSelectedCurrency(code) {
        const normalized = normalizeCurrencyCode(code);
        if (!normalized) {
            return Promise.resolve({
                ok: false,
                error: "Currency must be a 3-letter code."
            });
        }
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve({
                ok: false,
                error: "Storage unavailable."
            });
        }
        const payload = {};
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
    function _persistBooleanSetting(storageKey, enabled, settingDescription) {
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve({
                ok: false,
                error: "Storage unavailable."
            });
        }
        const payload = {};
        payload[storageKey] = Boolean(enabled);
        return storageSet(storage, payload)
            .then(function (ok) {
            if (!ok) {
                return {
                    ok: false,
                    error: "Failed to persist " + settingDescription + "."
                };
            }
            return {
                ok: true
            };
        })
            .catch(function () {
            return {
                ok: false,
                error: "Failed to persist " + settingDescription + "."
            };
        });
    }
    function getCurrencyConversionEnabled() {
        const storage = getStorageLocal();
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
        return _persistBooleanSetting(CONVERSION_ENABLED_STORAGE_KEY, enabled, "conversion status");
    }
    function getListingInsightsEnabled() {
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve(DEFAULT_LISTING_INSIGHTS_ENABLED);
        }
        return storageGet(storage, LISTING_INSIGHTS_ENABLED_STORAGE_KEY)
            .then(function (data) {
            const storedValue = data && data[LISTING_INSIGHTS_ENABLED_STORAGE_KEY];
            return typeof storedValue === "boolean" ? storedValue : DEFAULT_LISTING_INSIGHTS_ENABLED;
        })
            .catch(function () {
            return DEFAULT_LISTING_INSIGHTS_ENABLED;
        });
    }
    function setListingInsightsEnabled(enabled) {
        return _persistBooleanSetting(LISTING_INSIGHTS_ENABLED_STORAGE_KEY, enabled, "listing insights status");
    }
    function getMarketCompareExpandedAmountEnabled() {
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve(DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED);
        }
        return storageGet(storage, MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY)
            .then(function (data) {
            const storedValue = data && data[MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY];
            return typeof storedValue === "boolean"
                ? storedValue
                : DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED;
        })
            .catch(function () {
            return DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED;
        });
    }
    function setMarketCompareExpandedAmountEnabled(enabled) {
        return _persistBooleanSetting(MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY, enabled, "market compare expanded amount status");
    }
    function getDarkModeEnabled() {
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve(DEFAULT_DARK_MODE_ENABLED);
        }
        return storageGet(storage, DARK_MODE_ENABLED_STORAGE_KEY)
            .then(function (data) {
            const storedValue = data && data[DARK_MODE_ENABLED_STORAGE_KEY];
            return typeof storedValue === "boolean" ? storedValue : DEFAULT_DARK_MODE_ENABLED;
        })
            .catch(function () {
            return DEFAULT_DARK_MODE_ENABLED;
        });
    }
    function setDarkModeEnabled(enabled) {
        return _persistBooleanSetting(DARK_MODE_ENABLED_STORAGE_KEY, enabled, "dark mode status");
    }
    function getDarkModePrimaryColor() {
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve(DEFAULT_DARK_MODE_PRIMARY_COLOR);
        }
        return storageGet(storage, DARK_MODE_PRIMARY_COLOR_STORAGE_KEY)
            .then(function (data) {
            const normalized = normalizeHexColor(data && data[DARK_MODE_PRIMARY_COLOR_STORAGE_KEY]);
            return normalized || DEFAULT_DARK_MODE_PRIMARY_COLOR;
        })
            .catch(function () {
            return DEFAULT_DARK_MODE_PRIMARY_COLOR;
        });
    }
    function getDarkModeBehavior() {
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve(DEFAULT_DARK_MODE_BEHAVIOR);
        }
        return storageGet(storage, DARK_MODE_BEHAVIOR_STORAGE_KEY)
            .then(function (data) {
            const normalized = normalizeDarkModeBehavior(data && data[DARK_MODE_BEHAVIOR_STORAGE_KEY]);
            return normalized || DEFAULT_DARK_MODE_BEHAVIOR;
        })
            .catch(function () {
            return DEFAULT_DARK_MODE_BEHAVIOR;
        });
    }
    function setDarkModeBehavior(behavior) {
        const normalized = normalizeDarkModeBehavior(behavior);
        if (!normalized) {
            return Promise.resolve({
                ok: false,
                error: "Dark mode behavior must be either 'system' or 'permanent'."
            });
        }
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve({
                ok: false,
                error: "Storage unavailable."
            });
        }
        const payload = {};
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
        const normalized = normalizeHexColor(color);
        if (!normalized) {
            return Promise.resolve({
                ok: false,
                error: "Primary color must be a valid hex value."
            });
        }
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve({
                ok: false,
                error: "Storage unavailable."
            });
        }
        const payload = {};
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
        DEFAULT_CURRENCY,
        DEFAULT_CONVERSION_ENABLED,
        DEFAULT_LISTING_INSIGHTS_ENABLED,
        DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED,
        DEFAULT_DARK_MODE_ENABLED,
        DEFAULT_DARK_MODE_BEHAVIOR,
        DEFAULT_DARK_MODE_PRIMARY_COLOR,
        CURATED_CURRENCIES,
        CURRENCY_STORAGE_KEY,
        CONVERSION_ENABLED_STORAGE_KEY,
        LISTING_INSIGHTS_ENABLED_STORAGE_KEY,
        MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY,
        DARK_MODE_ENABLED_STORAGE_KEY,
        DARK_MODE_BEHAVIOR_STORAGE_KEY,
        DARK_MODE_PRIMARY_COLOR_STORAGE_KEY,
        STORAGE_KEY: CURRENCY_STORAGE_KEY,
        normalizeCurrencyCode,
        normalizeHexColor,
        normalizeDarkModeBehavior,
        getSelectedCurrency,
        setSelectedCurrency,
        getCurrencyConversionEnabled,
        setCurrencyConversionEnabled,
        getListingInsightsEnabled,
        setListingInsightsEnabled,
        getMarketCompareExpandedAmountEnabled,
        setMarketCompareExpandedAmountEnabled,
        getDarkModeEnabled,
        setDarkModeEnabled,
        getDarkModeBehavior,
        setDarkModeBehavior,
        getDarkModePrimaryColor,
        setDarkModePrimaryColor
    };
});