"use strict";
(function () {
    "use strict";
    var Settings = globalThis.GrailedPlusSettings;
    var Currency = globalThis.GrailedPlusCurrency;
    var DEFAULT_DARK_MODE_PRIMARY_COLOR = "#000000";
    var DEFAULT_DARK_MODE_BEHAVIOR = "system";
    var DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED = false;
    var CURRENCY_LABELS = {
        USD: "USD - US Dollar",
        EUR: "EUR - Euro",
        GBP: "GBP - British Pound",
        CAD: "CAD - Canadian Dollar",
        AUD: "AUD - Australian Dollar",
        JPY: "JPY - Japanese Yen"
    };
    function normalizeCurrencyCode(input) {
        if (Settings && typeof Settings.normalizeCurrencyCode === "function") {
            return Settings.normalizeCurrencyCode(input);
        }
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
        if (Settings && typeof Settings.normalizeHexColor === "function") {
            return Settings.normalizeHexColor(input);
        }
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
            return ("#" +
                shortHex.charAt(0) +
                shortHex.charAt(0) +
                shortHex.charAt(1) +
                shortHex.charAt(1) +
                shortHex.charAt(2) +
                shortHex.charAt(2));
        }
        var longMatch = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
        if (longMatch && longMatch[1]) {
            return "#" + longMatch[1].toUpperCase();
        }
        return null;
    }
    function normalizeDarkModeBehavior(input) {
        if (Settings && typeof Settings.normalizeDarkModeBehavior === "function") {
            return Settings.normalizeDarkModeBehavior(input);
        }
        if (typeof input !== "string") {
            return null;
        }
        var trimmed = input.trim().toLowerCase();
        if (trimmed !== "system" && trimmed !== "permanent") {
            return null;
        }
        return trimmed;
    }
    function setStatus(node, tone, message) {
        if (!node) {
            return;
        }
        node.textContent = message || "";
        if (!tone) {
            if (typeof node.removeAttribute === "function") {
                node.removeAttribute("data-tone");
            }
            return;
        }
        if (typeof node.setAttribute === "function") {
            node.setAttribute("data-tone", tone);
        }
    }
    function loadSelectedCurrency() {
        if (!Settings || typeof Settings.getSelectedCurrency !== "function") {
            return Promise.resolve("USD");
        }
        return Settings.getSelectedCurrency().then(function (value) {
            return normalizeCurrencyCode(value) || "USD";
        });
    }
    function loadConversionEnabled() {
        if (!Settings || typeof Settings.getCurrencyConversionEnabled !== "function") {
            return Promise.resolve(false);
        }
        return Settings.getCurrencyConversionEnabled().then(function (value) {
            return Boolean(value);
        });
    }
    function saveSelectedCurrency(code) {
        if (!Settings || typeof Settings.setSelectedCurrency !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setSelectedCurrency(code);
    }
    function saveConversionEnabled(enabled) {
        if (!Settings || typeof Settings.setCurrencyConversionEnabled !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setCurrencyConversionEnabled(Boolean(enabled));
    }
    function loadListingInsightsEnabled() {
        var fallbackEnabled = Settings && typeof Settings.DEFAULT_LISTING_INSIGHTS_ENABLED === "boolean"
            ? Settings.DEFAULT_LISTING_INSIGHTS_ENABLED
            : true;
        if (!Settings || typeof Settings.getListingInsightsEnabled !== "function") {
            return Promise.resolve(fallbackEnabled);
        }
        return Settings.getListingInsightsEnabled().then(function (value) {
            return typeof value === "boolean" ? value : fallbackEnabled;
        });
    }
    function saveListingInsightsEnabled(enabled) {
        if (!Settings || typeof Settings.setListingInsightsEnabled !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setListingInsightsEnabled(Boolean(enabled));
    }
    function loadListingMetadataButtonEnabled() {
        var fallbackEnabled = Settings && typeof Settings.DEFAULT_LISTING_METADATA_BUTTON_ENABLED === "boolean"
            ? Settings.DEFAULT_LISTING_METADATA_BUTTON_ENABLED
            : true;
        if (!Settings || typeof Settings.getListingMetadataButtonEnabled !== "function") {
            return Promise.resolve(fallbackEnabled);
        }
        return Settings.getListingMetadataButtonEnabled().then(function (value) {
            return typeof value === "boolean" ? value : fallbackEnabled;
        });
    }
    function saveListingMetadataButtonEnabled(enabled) {
        if (!Settings || typeof Settings.setListingMetadataButtonEnabled !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setListingMetadataButtonEnabled(Boolean(enabled));
    }
    function loadMarketCompareExpandedAmountEnabled() {
        var fallbackEnabled = Settings && typeof Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED === "boolean"
            ? Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED
            : false;
        if (!Settings || typeof Settings.getMarketCompareExpandedAmountEnabled !== "function") {
            return Promise.resolve(fallbackEnabled);
        }
        return Settings.getMarketCompareExpandedAmountEnabled().then(function (value) {
            return typeof value === "boolean" ? value : fallbackEnabled;
        });
    }
    function saveMarketCompareExpandedAmountEnabled(enabled) {
        if (!Settings || typeof Settings.setMarketCompareExpandedAmountEnabled !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setMarketCompareExpandedAmountEnabled(Boolean(enabled));
    }
    function loadDarkModeEnabled() {
        var fallbackEnabled = Settings && typeof Settings.DEFAULT_DARK_MODE_ENABLED === "boolean"
            ? Settings.DEFAULT_DARK_MODE_ENABLED
            : true;
        if (!Settings || typeof Settings.getDarkModeEnabled !== "function") {
            return Promise.resolve(fallbackEnabled);
        }
        return Settings.getDarkModeEnabled().then(function (value) {
            return typeof value === "boolean" ? value : fallbackEnabled;
        });
    }
    function loadDarkModePrimaryColor() {
        var fallbackColor = normalizeHexColor(Settings && Settings.DEFAULT_DARK_MODE_PRIMARY_COLOR) || DEFAULT_DARK_MODE_PRIMARY_COLOR;
        if (!Settings || typeof Settings.getDarkModePrimaryColor !== "function") {
            return Promise.resolve(fallbackColor);
        }
        return Settings.getDarkModePrimaryColor().then(function (value) {
            return normalizeHexColor(value) || fallbackColor;
        });
    }
    function loadDarkModeLegacyColorCustomizationEnabled() {
        var fallbackEnabled = Settings && typeof Settings.DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED === "boolean"
            ? Settings.DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED
            : DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED;
        if (!Settings ||
            typeof Settings.getDarkModeLegacyColorCustomizationEnabled !== "function") {
            return Promise.resolve(fallbackEnabled);
        }
        return Settings.getDarkModeLegacyColorCustomizationEnabled().then(function (value) {
            return typeof value === "boolean" ? value : fallbackEnabled;
        });
    }
    function loadDarkModeBehavior() {
        var fallbackBehavior = normalizeDarkModeBehavior(Settings && Settings.DEFAULT_DARK_MODE_BEHAVIOR) || DEFAULT_DARK_MODE_BEHAVIOR;
        if (!Settings || typeof Settings.getDarkModeBehavior !== "function") {
            return Promise.resolve(fallbackBehavior);
        }
        return Settings.getDarkModeBehavior().then(function (value) {
            return normalizeDarkModeBehavior(value) || fallbackBehavior;
        });
    }
    function saveDarkModeEnabled(enabled) {
        if (!Settings || typeof Settings.setDarkModeEnabled !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setDarkModeEnabled(Boolean(enabled));
    }
    function saveDarkModePrimaryColor(color) {
        if (!Settings || typeof Settings.setDarkModePrimaryColor !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setDarkModePrimaryColor(color);
    }
    function saveDarkModeLegacyColorCustomizationEnabled(enabled) {
        if (!Settings ||
            typeof Settings.setDarkModeLegacyColorCustomizationEnabled !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setDarkModeLegacyColorCustomizationEnabled(Boolean(enabled));
    }
    function saveDarkModeBehavior(behavior) {
        if (!Settings || typeof Settings.setDarkModeBehavior !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setDarkModeBehavior(behavior);
    }
    function validateCustomCurrency(code) {
        if (!Currency || typeof Currency.getRates !== "function" || typeof Currency.hasCurrencyCode !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Currency validation unavailable."
            });
        }
        return Currency.getRates("USD")
            .then(function (response) {
            var rates = response && response.rates ? response.rates : {};
            if (!Currency.hasCurrencyCode(code, rates)) {
                return {
                    ok: false,
                    error: "Code is not available in current USD exchange rates."
                };
            }
            return {
                ok: true
            };
        })
            .catch(function () {
            return {
                ok: false,
                error: "Unable to validate custom code right now."
            };
        });
    }
    function buildCuratedOptions(selectNode, curatedCurrencies) {
        if (!selectNode || typeof selectNode.appendChild !== "function") {
            return;
        }
        curatedCurrencies.forEach(function (code) {
            var option = document.createElement("option");
            option.value = code;
            option.textContent = CURRENCY_LABELS[code] || code;
            selectNode.appendChild(option);
        });
        var customOption = document.createElement("option");
        customOption.value = "CUSTOM";
        customOption.textContent = "Custom code";
        selectNode.appendChild(customOption);
    }
    function syncCurrencyInputs(selectNode, customInputNode, isEnabled) {
        if (!selectNode || !customInputNode) {
            return;
        }
        selectNode.disabled = !isEnabled;
        var isCustom = selectNode.value === "CUSTOM";
        customInputNode.disabled = !isEnabled || !isCustom;
        if (!isCustom) {
            customInputNode.value = "";
        }
    }
    function applySelection(selectNode, customInputNode, selectedCurrency, curatedSet) {
        if (!selectNode || !customInputNode) {
            return;
        }
        if (curatedSet[selectedCurrency]) {
            selectNode.value = selectedCurrency;
            customInputNode.value = "";
            return;
        }
        selectNode.value = "CUSTOM";
        customInputNode.value = selectedCurrency;
    }
    function syncDarkModeInputs(enabledNode, behaviorNode, legacyColorEnabledNode, legacyColorControlsNode, colorPickerNode, colorHexNode) {
        if (!enabledNode ||
            !behaviorNode ||
            !legacyColorEnabledNode ||
            !legacyColorControlsNode ||
            !colorPickerNode ||
            !colorHexNode) {
            return;
        }
        var enabled = Boolean(enabledNode.checked);
        var legacyColorEnabled = Boolean(legacyColorEnabledNode.checked);
        behaviorNode.disabled = !enabled;
        legacyColorEnabledNode.disabled = !enabled;
        legacyColorControlsNode.hidden = !enabled || !legacyColorEnabled;
        colorPickerNode.disabled = !enabled || !legacyColorEnabled;
        colorHexNode.disabled = !enabled || !legacyColorEnabled;
    }
    function applyDarkModeColor(colorPickerNode, colorHexNode, color) {
        if (!colorPickerNode || !colorHexNode) {
            return;
        }
        var normalized = normalizeHexColor(color) || DEFAULT_DARK_MODE_PRIMARY_COLOR;
        colorPickerNode.value = normalized;
        colorHexNode.value = normalized;
    }
    function init() {
        var form = document.getElementById("currency-form");
        var enabledNode = document.getElementById("conversion-enabled");
        var listingInsightsEnabledNode = document.getElementById("listing-insights-enabled");
        var listingMetadataButtonEnabledNode = document.getElementById("listing-metadata-button-enabled");
        var marketCompareExpandedAmountEnabledNode = document.getElementById("market-compare-expanded-amount-enabled");
        var selectNode = document.getElementById("currency-select");
        var customInputNode = document.getElementById("currency-custom");
        var darkModeEnabledNode = document.getElementById("dark-mode-enabled");
        var darkModeBehaviorNode = document.getElementById("dark-mode-behavior");
        var darkModeLegacyColorEnabledNode = document.getElementById("dark-mode-legacy-color-enabled");
        var darkModeLegacyColorControlsNode = document.getElementById("dark-mode-legacy-color-controls");
        var darkModePrimaryNode = document.getElementById("dark-mode-primary");
        var darkModePrimaryHexNode = document.getElementById("dark-mode-primary-hex");
        var resetButton = document.getElementById("reset-button");
        var statusNode = document.getElementById("status");
        if (!form ||
            !enabledNode ||
            !listingInsightsEnabledNode ||
            !listingMetadataButtonEnabledNode ||
            !marketCompareExpandedAmountEnabledNode ||
            !selectNode ||
            !customInputNode ||
            !darkModeEnabledNode ||
            !darkModeBehaviorNode ||
            !darkModeLegacyColorEnabledNode ||
            !darkModeLegacyColorControlsNode ||
            !darkModePrimaryNode ||
            !darkModePrimaryHexNode ||
            !resetButton ||
            !statusNode) {
            return;
        }
        var curatedCurrencies = Settings && Array.isArray(Settings.CURATED_CURRENCIES) && Settings.CURATED_CURRENCIES.length > 0
            ? Settings.CURATED_CURRENCIES
            : ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
        var curatedSet = Object.create(null);
        curatedCurrencies.forEach(function (code) {
            curatedSet[code] = true;
        });
        buildCuratedOptions(selectNode, curatedCurrencies);
        Promise.all([
            loadSelectedCurrency(),
            loadConversionEnabled(),
            loadListingInsightsEnabled(),
            loadListingMetadataButtonEnabled(),
            loadMarketCompareExpandedAmountEnabled(),
            loadDarkModeEnabled(),
            loadDarkModeBehavior(),
            loadDarkModePrimaryColor(),
            loadDarkModeLegacyColorCustomizationEnabled()
        ]).then(function (values) {
            var selectedCurrency = values[0];
            var enabled = values[1];
            var listingInsightsEnabled = values[2];
            var listingMetadataButtonEnabled = values[3];
            var marketCompareExpandedAmountEnabled = values[4];
            var darkModeEnabled = values[5];
            var darkModeBehavior = values[6];
            var darkModePrimaryColor = values[7];
            var darkModeLegacyColorCustomizationEnabled = values[8];
            applySelection(selectNode, customInputNode, selectedCurrency, curatedSet);
            enabledNode.checked = enabled;
            syncCurrencyInputs(selectNode, customInputNode, enabled);
            listingInsightsEnabledNode.checked = listingInsightsEnabled;
            listingMetadataButtonEnabledNode.checked = listingMetadataButtonEnabled;
            marketCompareExpandedAmountEnabledNode.checked = marketCompareExpandedAmountEnabled;
            darkModeEnabledNode.checked = darkModeEnabled;
            darkModeBehaviorNode.value = darkModeBehavior;
            darkModeLegacyColorEnabledNode.checked = darkModeLegacyColorCustomizationEnabled;
            applyDarkModeColor(darkModePrimaryNode, darkModePrimaryHexNode, darkModePrimaryColor);
            syncDarkModeInputs(darkModeEnabledNode, darkModeBehaviorNode, darkModeLegacyColorEnabledNode, darkModeLegacyColorControlsNode, darkModePrimaryNode, darkModePrimaryHexNode);
        });
        if (typeof selectNode.addEventListener === "function") {
            selectNode.addEventListener("change", function () {
                syncCurrencyInputs(selectNode, customInputNode, enabledNode.checked);
                setStatus(statusNode, null, "");
            });
        }
        if (typeof enabledNode.addEventListener === "function") {
            enabledNode.addEventListener("change", function () {
                syncCurrencyInputs(selectNode, customInputNode, enabledNode.checked);
                setStatus(statusNode, null, "");
            });
        }
        if (typeof listingInsightsEnabledNode.addEventListener === "function") {
            listingInsightsEnabledNode.addEventListener("change", function () {
                setStatus(statusNode, null, "");
            });
        }
        if (typeof listingMetadataButtonEnabledNode.addEventListener === "function") {
            listingMetadataButtonEnabledNode.addEventListener("change", function () {
                setStatus(statusNode, null, "");
            });
        }
        if (typeof marketCompareExpandedAmountEnabledNode.addEventListener === "function") {
            marketCompareExpandedAmountEnabledNode.addEventListener("change", function () {
                setStatus(statusNode, null, "");
            });
        }
        if (typeof darkModeEnabledNode.addEventListener === "function") {
            darkModeEnabledNode.addEventListener("change", function () {
                syncDarkModeInputs(darkModeEnabledNode, darkModeBehaviorNode, darkModeLegacyColorEnabledNode, darkModeLegacyColorControlsNode, darkModePrimaryNode, darkModePrimaryHexNode);
                setStatus(statusNode, null, "");
            });
        }
        if (typeof darkModeLegacyColorEnabledNode.addEventListener === "function") {
            darkModeLegacyColorEnabledNode.addEventListener("change", function () {
                syncDarkModeInputs(darkModeEnabledNode, darkModeBehaviorNode, darkModeLegacyColorEnabledNode, darkModeLegacyColorControlsNode, darkModePrimaryNode, darkModePrimaryHexNode);
                setStatus(statusNode, null, "");
            });
        }
        if (typeof darkModeBehaviorNode.addEventListener === "function") {
            darkModeBehaviorNode.addEventListener("change", function () {
                setStatus(statusNode, null, "");
            });
        }
        if (typeof darkModePrimaryNode.addEventListener === "function") {
            darkModePrimaryNode.addEventListener("input", function () {
                applyDarkModeColor(darkModePrimaryNode, darkModePrimaryHexNode, darkModePrimaryNode.value);
                setStatus(statusNode, null, "");
            });
        }
        if (typeof darkModePrimaryHexNode.addEventListener === "function") {
            darkModePrimaryHexNode.addEventListener("input", function () {
                darkModePrimaryHexNode.value = String(darkModePrimaryHexNode.value || "").toUpperCase();
                var normalized = normalizeHexColor(darkModePrimaryHexNode.value);
                if (normalized) {
                    darkModePrimaryNode.value = normalized;
                }
                setStatus(statusNode, null, "");
            });
            darkModePrimaryHexNode.addEventListener("blur", function () {
                applyDarkModeColor(darkModePrimaryNode, darkModePrimaryHexNode, darkModePrimaryHexNode.value);
            });
        }
        if (typeof form.addEventListener === "function") {
            form.addEventListener("submit", function (event) {
                if (event && typeof event.preventDefault === "function") {
                    event.preventDefault();
                }
                setStatus(statusNode, null, "");
                var conversionEnabled = Boolean(enabledNode.checked);
                var listingInsightsEnabled = Boolean(listingInsightsEnabledNode.checked);
                var listingMetadataButtonEnabled = Boolean(listingMetadataButtonEnabledNode.checked);
                var marketCompareExpandedAmountEnabled = Boolean(marketCompareExpandedAmountEnabledNode.checked);
                var usingCustom = selectNode.value === "CUSTOM";
                var darkModeEnabled = Boolean(darkModeEnabledNode.checked);
                var darkModeLegacyColorCustomizationEnabled = Boolean(darkModeLegacyColorEnabledNode.checked);
                var darkModeBehavior = normalizeDarkModeBehavior(darkModeBehaviorNode.value);
                var targetCode = null;
                var darkModePrimaryColor = normalizeHexColor(darkModePrimaryHexNode.value || darkModePrimaryNode.value);
                if (usingCustom) {
                    targetCode = normalizeCurrencyCode(customInputNode.value);
                    if (!targetCode) {
                        setStatus(statusNode, "error", "Custom code must be a valid 3-letter value.");
                        return;
                    }
                }
                else {
                    targetCode = normalizeCurrencyCode(selectNode.value);
                    if (!targetCode) {
                        setStatus(statusNode, "error", "Please choose a valid currency.");
                        return;
                    }
                }
                if (darkModeLegacyColorCustomizationEnabled && !darkModePrimaryColor) {
                    setStatus(statusNode, "error", "Primary color must be a valid hex value.");
                    return;
                }
                if (!darkModeBehavior) {
                    setStatus(statusNode, "error", "Dark mode behavior must be either system or permanent.");
                    return;
                }
                var safeTargetCode = targetCode;
                var safeDarkModeBehavior = darkModeBehavior;
                var safeDarkModePrimaryColor = darkModeLegacyColorCustomizationEnabled
                    ? (darkModePrimaryColor || DEFAULT_DARK_MODE_PRIMARY_COLOR)
                    : DEFAULT_DARK_MODE_PRIMARY_COLOR;
                applyDarkModeColor(darkModePrimaryNode, darkModePrimaryHexNode, safeDarkModePrimaryColor);
                var validationPromise = Promise.resolve({ ok: true });
                if (usingCustom && conversionEnabled) {
                    validationPromise = validateCustomCurrency(targetCode);
                }
                validationPromise
                    .then(function (validation) {
                    if (!validation.ok) {
                        setStatus(statusNode, "error", validation.error || "Invalid currency code.");
                        return Promise.reject(new Error("validation_failed"));
                    }
                    return Promise.all([
                        saveSelectedCurrency(safeTargetCode),
                        saveConversionEnabled(conversionEnabled),
                        saveListingInsightsEnabled(listingInsightsEnabled),
                        saveListingMetadataButtonEnabled(listingMetadataButtonEnabled),
                        saveMarketCompareExpandedAmountEnabled(marketCompareExpandedAmountEnabled),
                        saveDarkModeEnabled(darkModeEnabled),
                        saveDarkModeBehavior(safeDarkModeBehavior),
                        saveDarkModePrimaryColor(safeDarkModePrimaryColor),
                        saveDarkModeLegacyColorCustomizationEnabled(darkModeLegacyColorCustomizationEnabled)
                    ]).then(function (results) {
                        var i;
                        for (i = 0; i < results.length; i += 1) {
                            if (!results[i] || !results[i].ok) {
                                setStatus(statusNode, "error", (results[i] && results[i].error) || "Unable to save settings.");
                                return Promise.reject(new Error("save_failed"));
                            }
                        }
                        setStatus(statusNode, "success", "Saved. Refresh open Grailed tabs to apply.");
                    });
                })
                    .catch(function () {
                    // Errors are handled with status updates above.
                });
            });
        }
        if (typeof resetButton.addEventListener === "function") {
            resetButton.addEventListener("click", function () {
                var defaultCurrency = Settings && typeof Settings.DEFAULT_CURRENCY === "string" ? Settings.DEFAULT_CURRENCY : "USD";
                var defaultConversionEnabled = Settings && typeof Settings.DEFAULT_CONVERSION_ENABLED === "boolean"
                    ? Settings.DEFAULT_CONVERSION_ENABLED
                    : false;
                var defaultListingInsightsEnabled = Settings && typeof Settings.DEFAULT_LISTING_INSIGHTS_ENABLED === "boolean"
                    ? Settings.DEFAULT_LISTING_INSIGHTS_ENABLED
                    : true;
                var defaultListingMetadataButtonEnabled = Settings && typeof Settings.DEFAULT_LISTING_METADATA_BUTTON_ENABLED === "boolean"
                    ? Settings.DEFAULT_LISTING_METADATA_BUTTON_ENABLED
                    : true;
                var defaultMarketCompareExpandedAmountEnabled = Settings && typeof Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED === "boolean"
                    ? Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED
                    : false;
                var defaultDarkModeEnabled = Settings && typeof Settings.DEFAULT_DARK_MODE_ENABLED === "boolean"
                    ? Settings.DEFAULT_DARK_MODE_ENABLED
                    : true;
                var defaultDarkModeBehavior = normalizeDarkModeBehavior(Settings && Settings.DEFAULT_DARK_MODE_BEHAVIOR) ||
                    DEFAULT_DARK_MODE_BEHAVIOR;
                var defaultDarkModePrimaryColor = normalizeHexColor(Settings && Settings.DEFAULT_DARK_MODE_PRIMARY_COLOR) ||
                    DEFAULT_DARK_MODE_PRIMARY_COLOR;
                var defaultDarkModeLegacyColorCustomizationEnabled = Settings && typeof Settings.DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED === "boolean"
                    ? Settings.DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED
                    : DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED;
                Promise.all([
                    saveSelectedCurrency(defaultCurrency),
                    saveConversionEnabled(defaultConversionEnabled),
                    saveListingInsightsEnabled(defaultListingInsightsEnabled),
                    saveListingMetadataButtonEnabled(defaultListingMetadataButtonEnabled),
                    saveMarketCompareExpandedAmountEnabled(defaultMarketCompareExpandedAmountEnabled),
                    saveDarkModeEnabled(defaultDarkModeEnabled),
                    saveDarkModeBehavior(defaultDarkModeBehavior),
                    saveDarkModePrimaryColor(defaultDarkModePrimaryColor),
                    saveDarkModeLegacyColorCustomizationEnabled(defaultDarkModeLegacyColorCustomizationEnabled)
                ]).then(function (results) {
                    var i;
                    for (i = 0; i < results.length; i += 1) {
                        if (!results[i] || !results[i].ok) {
                            setStatus(statusNode, "error", "Unable to reset settings.");
                            return;
                        }
                    }
                    enabledNode.checked = defaultConversionEnabled;
                    applySelection(selectNode, customInputNode, defaultCurrency, curatedSet);
                    syncCurrencyInputs(selectNode, customInputNode, defaultConversionEnabled);
                    listingInsightsEnabledNode.checked = defaultListingInsightsEnabled;
                    listingMetadataButtonEnabledNode.checked = defaultListingMetadataButtonEnabled;
                    marketCompareExpandedAmountEnabledNode.checked = defaultMarketCompareExpandedAmountEnabled;
                    darkModeEnabledNode.checked = defaultDarkModeEnabled;
                    darkModeBehaviorNode.value = defaultDarkModeBehavior;
                    darkModeLegacyColorEnabledNode.checked =
                        defaultDarkModeLegacyColorCustomizationEnabled;
                    applyDarkModeColor(darkModePrimaryNode, darkModePrimaryHexNode, defaultDarkModePrimaryColor);
                    syncDarkModeInputs(darkModeEnabledNode, darkModeBehaviorNode, darkModeLegacyColorEnabledNode, darkModeLegacyColorControlsNode, darkModePrimaryNode, darkModePrimaryHexNode);
                    setStatus(statusNode, "success", "Reset to defaults.");
                });
            });
        }
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    }
    else {
        init();
    }
})();