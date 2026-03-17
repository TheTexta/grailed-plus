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
    const DEFAULT_LISTING_METADATA_BUTTON_ENABLED = true;
    const DEFAULT_MARKET_COMPARE_ENABLED = true;
    const DEFAULT_MARKET_COMPARE_RANKING_FORMULA = "balanced";
    const DEFAULT_MARKET_COMPARE_STRICT_MODE = false;
    const DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED = false;
    const DEFAULT_DARK_MODE_ENABLED = true;
    const DEFAULT_DARK_MODE_BEHAVIOR = "system";
    const DEFAULT_DARK_MODE_PRIMARY_COLOR = "#000000";
    const DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED = false;
    const CURATED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
    const MARKET_COMPARE_RANKING_FORMULA_OPTIONS = [
        "balanced",
        "visual",
        "metadata",
        "variant"
    ];
    const CURRENCY_STORAGE_KEY = "grailed_plus_selected_currency_v1";
    const CONVERSION_ENABLED_STORAGE_KEY = "grailed_plus_currency_enabled_v1";
    const LISTING_INSIGHTS_ENABLED_STORAGE_KEY = "grailed_plus_listing_insights_enabled_v1";
    const LISTING_METADATA_BUTTON_STORAGE_KEY = "grailed_plus_listing_metadata_button_enabled_v1";
    const MARKET_COMPARE_ENABLED_STORAGE_KEY = "grailed_plus_market_compare_enabled_v1";
    const MARKET_COMPARE_RANKING_FORMULA_STORAGE_KEY = "grailed_plus_market_compare_ranking_formula_v1";
    const MARKET_COMPARE_STRICT_MODE_STORAGE_KEY = "grailed_plus_market_compare_strict_mode_v1";
    const MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY = "grailed_plus_market_compare_expanded_amount_enabled_v1";
    const DARK_MODE_ENABLED_STORAGE_KEY = "grailed_plus_dark_mode_enabled_v1";
    const DARK_MODE_BEHAVIOR_STORAGE_KEY = "grailed_plus_dark_mode_behavior_v1";
    const DARK_MODE_PRIMARY_COLOR_STORAGE_KEY = "grailed_plus_dark_mode_primary_color_v1";
    const DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_STORAGE_KEY = "grailed_plus_dark_mode_legacy_color_customization_enabled_v1";
    let BrowserStorage = null;
    if (typeof globalThis !== "undefined" && globalThis.GrailedPlusBrowserStorage) {
        BrowserStorage = globalThis.GrailedPlusBrowserStorage || null;
    }
    if (!BrowserStorage && typeof require === "function") {
        try {
            BrowserStorage = require("./browserStorage");
        }
        catch (_) {
            BrowserStorage = null;
        }
    }
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
    function normalizeMarketCompareRankingFormula(input) {
        if (typeof input !== "string") {
            return null;
        }
        const normalized = input.trim().toLowerCase();
        return MARKET_COMPARE_RANKING_FORMULA_OPTIONS.indexOf(normalized) >= 0 ? normalized : null;
    }
    function getStorageLocal() {
        return BrowserStorage && typeof BrowserStorage.getStorageLocal === "function"
            ? BrowserStorage.getStorageLocal()
            : null;
    }
    function storageGet(storage, key) {
        return BrowserStorage && typeof BrowserStorage.storageGet === "function"
            ? BrowserStorage.storageGet(storage, key)
            : Promise.resolve({});
    }
    function storageSet(storage, payload) {
        return BrowserStorage && typeof BrowserStorage.storageSet === "function"
            ? BrowserStorage.storageSet(storage, payload)
            : Promise.resolve(false);
    }
    function readSetting(storageKey, fallback, normalize) {
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve(fallback);
        }
        return storageGet(storage, storageKey)
            .then(function (data) {
            return normalize(data && data[storageKey]);
        })
            .catch(function () {
            return fallback;
        });
    }
    function persistSetting(storageKey, value, failureMessage) {
        const storage = getStorageLocal();
        if (!storage) {
            return Promise.resolve({
                ok: false,
                error: "Storage unavailable."
            });
        }
        const payload = {};
        payload[storageKey] = value;
        return storageSet(storage, payload)
            .then(function (ok) {
            if (!ok) {
                return {
                    ok: false,
                    error: failureMessage
                };
            }
            return {
                ok: true
            };
        })
            .catch(function () {
            return {
                ok: false,
                error: failureMessage
            };
        });
    }
    function createBooleanSetting(storageKey, fallback, settingDescription) {
        return {
            get: function () {
                return readSetting(storageKey, fallback, function (value) {
                    return typeof value === "boolean" ? value : fallback;
                });
            },
            set: function (enabled) {
                return persistSetting(storageKey, Boolean(enabled), "Failed to persist " + settingDescription + ".");
            }
        };
    }
    function createValidatedSetting(storageKey, fallback, normalize, invalidMessage, failureMessage) {
        return {
            get: function () {
                return readSetting(storageKey, fallback, function (value) {
                    const normalized = normalize(value);
                    return normalized == null ? fallback : normalized;
                });
            },
            set: function (value) {
                const normalized = normalize(value);
                if (normalized == null) {
                    return Promise.resolve({
                        ok: false,
                        error: invalidMessage
                    });
                }
                return persistSetting(storageKey, normalized, failureMessage);
            }
        };
    }
    const selectedCurrencySetting = createValidatedSetting(CURRENCY_STORAGE_KEY, DEFAULT_CURRENCY, normalizeCurrencyCode, "Currency must be a 3-letter code.", "Failed to persist currency.");
    const currencyConversionSetting = createBooleanSetting(CONVERSION_ENABLED_STORAGE_KEY, DEFAULT_CONVERSION_ENABLED, "conversion status");
    const listingInsightsSetting = createBooleanSetting(LISTING_INSIGHTS_ENABLED_STORAGE_KEY, DEFAULT_LISTING_INSIGHTS_ENABLED, "listing insights status");
    const listingMetadataButtonSetting = createBooleanSetting(LISTING_METADATA_BUTTON_STORAGE_KEY, DEFAULT_LISTING_METADATA_BUTTON_ENABLED, "listing metadata button status");
    const marketCompareEnabledSetting = createBooleanSetting(MARKET_COMPARE_ENABLED_STORAGE_KEY, DEFAULT_MARKET_COMPARE_ENABLED, "market compare status");
    const marketCompareRankingFormulaSetting = createValidatedSetting(MARKET_COMPARE_RANKING_FORMULA_STORAGE_KEY, DEFAULT_MARKET_COMPARE_RANKING_FORMULA, normalizeMarketCompareRankingFormula, "Market compare ranking formula must match a supported option.", "Failed to persist market compare ranking formula.");
    const marketCompareStrictModeSetting = createBooleanSetting(MARKET_COMPARE_STRICT_MODE_STORAGE_KEY, DEFAULT_MARKET_COMPARE_STRICT_MODE, "market compare strict mode status");
    const marketCompareExpandedAmountSetting = createBooleanSetting(MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY, DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED, "market compare expanded amount status");
    const darkModeEnabledSetting = createBooleanSetting(DARK_MODE_ENABLED_STORAGE_KEY, DEFAULT_DARK_MODE_ENABLED, "dark mode status");
    const darkModeBehaviorSetting = createValidatedSetting(DARK_MODE_BEHAVIOR_STORAGE_KEY, DEFAULT_DARK_MODE_BEHAVIOR, normalizeDarkModeBehavior, "Dark mode behavior must be either 'system' or 'permanent'.", "Failed to persist dark mode behavior.");
    const darkModePrimaryColorSetting = createValidatedSetting(DARK_MODE_PRIMARY_COLOR_STORAGE_KEY, DEFAULT_DARK_MODE_PRIMARY_COLOR, normalizeHexColor, "Primary color must be a valid hex value.", "Failed to persist dark mode primary color.");
    const darkModeLegacyColorCustomizationSetting = createBooleanSetting(DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_STORAGE_KEY, DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED, "dark mode legacy color customization status");
    function getSelectedCurrency() {
        return selectedCurrencySetting.get();
    }
    function setSelectedCurrency(code) {
        return selectedCurrencySetting.set(code);
    }
    function getCurrencyConversionEnabled() {
        return currencyConversionSetting.get();
    }
    function setCurrencyConversionEnabled(enabled) {
        return currencyConversionSetting.set(enabled);
    }
    function getListingInsightsEnabled() {
        return listingInsightsSetting.get();
    }
    function setListingInsightsEnabled(enabled) {
        return listingInsightsSetting.set(enabled);
    }
    function getListingMetadataButtonEnabled() {
        return listingMetadataButtonSetting.get();
    }
    function setListingMetadataButtonEnabled(enabled) {
        return listingMetadataButtonSetting.set(enabled);
    }
    function getMarketCompareEnabled() {
        return marketCompareEnabledSetting.get();
    }
    function setMarketCompareEnabled(enabled) {
        return marketCompareEnabledSetting.set(enabled);
    }
    function getMarketCompareRankingFormula() {
        return marketCompareRankingFormulaSetting.get();
    }
    function setMarketCompareRankingFormula(formula) {
        return marketCompareRankingFormulaSetting.set(formula);
    }
    function getMarketCompareStrictMode() {
        return marketCompareStrictModeSetting.get();
    }
    function setMarketCompareStrictMode(enabled) {
        return marketCompareStrictModeSetting.set(enabled);
    }
    function getMarketCompareExpandedAmountEnabled() {
        return marketCompareExpandedAmountSetting.get();
    }
    function setMarketCompareExpandedAmountEnabled(enabled) {
        return marketCompareExpandedAmountSetting.set(enabled);
    }
    function getMarketCompareSettings() {
        return Promise.all([
            getMarketCompareEnabled(),
            getMarketCompareRankingFormula(),
            getMarketCompareStrictMode(),
            getMarketCompareExpandedAmountEnabled()
        ]).then(function (values) {
            return {
                enabled: values[0],
                rankingFormula: values[1],
                strictMode: values[2],
                expandedAmountEnabled: values[3]
            };
        });
    }
    function getDarkModeEnabled() {
        return darkModeEnabledSetting.get();
    }
    function setDarkModeEnabled(enabled) {
        return darkModeEnabledSetting.set(enabled);
    }
    function getDarkModePrimaryColor() {
        return darkModePrimaryColorSetting.get();
    }
    function getDarkModeBehavior() {
        return darkModeBehaviorSetting.get();
    }
    function setDarkModeBehavior(behavior) {
        return darkModeBehaviorSetting.set(behavior);
    }
    function setDarkModePrimaryColor(color) {
        return darkModePrimaryColorSetting.set(color);
    }
    function getDarkModeLegacyColorCustomizationEnabled() {
        return darkModeLegacyColorCustomizationSetting.get();
    }
    function setDarkModeLegacyColorCustomizationEnabled(enabled) {
        return darkModeLegacyColorCustomizationSetting.set(enabled);
    }
    return {
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
        CURATED_CURRENCIES,
        MARKET_COMPARE_RANKING_FORMULA_OPTIONS,
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
        STORAGE_KEY: CURRENCY_STORAGE_KEY,
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
    };
});