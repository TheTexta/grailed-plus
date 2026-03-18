"use strict";
(function () {
    "use strict";
    var Settings = globalThis.GrailedPlusSettings;
    var Currency = globalThis.GrailedPlusCurrency;
    var DEFAULT_DARK_MODE_PRIMARY_COLOR = "#000000";
    var DEFAULT_DARK_MODE_BEHAVIOR = "system";
    var DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED = false;
    var DEFAULT_MARKET_COMPARE_AUTO_SEARCH_ENABLED = false;
    var DEFAULT_MARKET_COMPARE_RANKING_FORMULA = "visual";
    var DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED = true;
    var DEFAULT_MARKET_COMPARE_DEBUG_ENABLED = false;
    var CURRENCY_LABELS = {
        USD: "USD - US Dollar",
        EUR: "EUR - Euro",
        GBP: "GBP - British Pound",
        CAD: "CAD - Canadian Dollar",
        AUD: "AUD - Australian Dollar",
        JPY: "JPY - Japanese Yen"
    };
    var MARKET_COMPARE_RANKING_FORMULA_LABELS = {
        balanced: "Balanced",
        visual: "Thumbnail-first",
        metadata: "Title-first",
        variant: "Variant-first"
    };
    var MARKET_COMPARE_RANKING_FORMULA_DESCRIPTIONS = {
        balanced: "Balanced: score = 0.22*image similarity + 0.34*title + 0.06*brand + 0.16*size + 0.08*condition + 0.14*price delta. Missing signals are redistributed across the signals that exist.",
        visual: "Thumbnail-first: score = 0.50*image similarity + 0.20*title + 0.08*brand + 0.10*size + 0.05*condition + 0.07*price delta. Missing signals are redistributed across the signals that exist.",
        metadata: "Title-first: score = 0.08*image similarity + 0.58*title + 0.08*brand + 0.10*size + 0.06*condition + 0.10*price delta. Missing signals are redistributed across the signals that exist.",
        variant: "Variant-first: score = 0.06*image similarity + 0.22*title + 0.16*brand + 0.30*size + 0.18*condition + 0.08*price delta. Missing signals are redistributed across the signals that exist."
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
    function normalizeMarketCompareRankingFormula(input) {
        if (Settings && typeof Settings.normalizeMarketCompareRankingFormula === "function") {
            return Settings.normalizeMarketCompareRankingFormula(input);
        }
        if (typeof input !== "string") {
            return null;
        }
        var normalized = input.trim().toLowerCase();
        return ["balanced", "visual", "metadata", "variant"].indexOf(normalized) >= 0
            ? normalized
            : null;
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
    function loadMarketCompareSettings() {
        var fallback = {
            enabled: Settings && typeof Settings.DEFAULT_MARKET_COMPARE_ENABLED === "boolean"
                ? Settings.DEFAULT_MARKET_COMPARE_ENABLED
                : false,
            autoSearchEnabled: Settings && typeof Settings.DEFAULT_MARKET_COMPARE_AUTO_SEARCH_ENABLED === "boolean"
                ? Settings.DEFAULT_MARKET_COMPARE_AUTO_SEARCH_ENABLED
                : DEFAULT_MARKET_COMPARE_AUTO_SEARCH_ENABLED,
            rankingFormula: normalizeMarketCompareRankingFormula(Settings && Settings.DEFAULT_MARKET_COMPARE_RANKING_FORMULA) || DEFAULT_MARKET_COMPARE_RANKING_FORMULA,
            strictMode: Settings && typeof Settings.DEFAULT_MARKET_COMPARE_STRICT_MODE === "boolean"
                ? Settings.DEFAULT_MARKET_COMPARE_STRICT_MODE
                : false,
            expandedAmountEnabled: Settings && typeof Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED === "boolean"
                ? Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED
                : false,
            mlSimilarityEnabled: Settings && typeof Settings.DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED === "boolean"
                ? Settings.DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED
                : DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED,
            debugEnabled: Settings && typeof Settings.DEFAULT_MARKET_COMPARE_DEBUG_ENABLED === "boolean"
                ? Settings.DEFAULT_MARKET_COMPARE_DEBUG_ENABLED
                : DEFAULT_MARKET_COMPARE_DEBUG_ENABLED
        };
        if (!Settings || typeof Settings.getMarketCompareSettings !== "function") {
            return Promise.resolve(fallback);
        }
        return Settings.getMarketCompareSettings().then(function (value) {
            var rankingFormula = normalizeMarketCompareRankingFormula(value && value.rankingFormula);
            return {
                enabled: value && typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
                autoSearchEnabled: value && typeof value.autoSearchEnabled === "boolean"
                    ? value.autoSearchEnabled
                    : fallback.autoSearchEnabled,
                rankingFormula: rankingFormula || fallback.rankingFormula,
                strictMode: value && typeof value.strictMode === "boolean" ? value.strictMode : fallback.strictMode,
                expandedAmountEnabled: value && typeof value.expandedAmountEnabled === "boolean"
                    ? value.expandedAmountEnabled
                    : fallback.expandedAmountEnabled,
                mlSimilarityEnabled: value && typeof value.mlSimilarityEnabled === "boolean"
                    ? value.mlSimilarityEnabled
                    : fallback.mlSimilarityEnabled,
                debugEnabled: value && typeof value.debugEnabled === "boolean"
                    ? value.debugEnabled
                    : fallback.debugEnabled
            };
        });
    }
    function saveMarketCompareEnabled(enabled) {
        if (!Settings || typeof Settings.setMarketCompareEnabled !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setMarketCompareEnabled(Boolean(enabled));
    }
    function saveMarketCompareRankingFormula(formula) {
        if (!Settings || typeof Settings.setMarketCompareRankingFormula !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setMarketCompareRankingFormula(formula);
    }
    function saveMarketCompareAutoSearchEnabled(enabled) {
        if (!Settings || typeof Settings.setMarketCompareAutoSearchEnabled !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setMarketCompareAutoSearchEnabled(Boolean(enabled));
    }
    function saveMarketCompareStrictMode(enabled) {
        if (!Settings || typeof Settings.setMarketCompareStrictMode !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setMarketCompareStrictMode(Boolean(enabled));
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
    function saveMarketCompareMlSimilarityEnabled(enabled) {
        if (!Settings || typeof Settings.setMarketCompareMlSimilarityEnabled !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setMarketCompareMlSimilarityEnabled(Boolean(enabled));
    }
    function saveMarketCompareDebugEnabled(enabled) {
        if (!Settings || typeof Settings.setMarketCompareDebugEnabled !== "function") {
            return Promise.resolve({
                ok: false,
                error: "Settings module unavailable."
            });
        }
        return Settings.setMarketCompareDebugEnabled(Boolean(enabled));
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
    function buildMarketCompareRankingFormulaOptions(selectNode, formulaOptions) {
        if (!selectNode || typeof selectNode.appendChild !== "function") {
            return;
        }
        formulaOptions.forEach(function (formula) {
            var option = document.createElement("option");
            option.value = formula;
            option.textContent =
                MARKET_COMPARE_RANKING_FORMULA_LABELS[formula] || formula;
            selectNode.appendChild(option);
        });
    }
    function updateMarketCompareRankingFormulaDescription(descriptionNode, formula) {
        if (!descriptionNode) {
            return;
        }
        var normalizedFormula = normalizeMarketCompareRankingFormula(formula) || DEFAULT_MARKET_COMPARE_RANKING_FORMULA;
        descriptionNode.textContent =
            MARKET_COMPARE_RANKING_FORMULA_DESCRIPTIONS[normalizedFormula] ||
                MARKET_COMPARE_RANKING_FORMULA_DESCRIPTIONS[DEFAULT_MARKET_COMPARE_RANKING_FORMULA];
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
    function syncMarketCompareInputs(enabledNode, autoSearchEnabledNode, rankingFormulaNode, strictModeNode, expandedAmountNode, mlSimilarityEnabledNode, debugEnabledNode) {
        if (!enabledNode ||
            !autoSearchEnabledNode ||
            !rankingFormulaNode ||
            !strictModeNode ||
            !expandedAmountNode ||
            !mlSimilarityEnabledNode ||
            !debugEnabledNode) {
            return;
        }
        var marketCompareEnabled = Boolean(enabledNode.checked);
        autoSearchEnabledNode.disabled = !marketCompareEnabled;
        rankingFormulaNode.disabled = !marketCompareEnabled;
        strictModeNode.disabled = !marketCompareEnabled;
        expandedAmountNode.disabled = !marketCompareEnabled;
        mlSimilarityEnabledNode.disabled = !marketCompareEnabled;
        debugEnabledNode.disabled = !marketCompareEnabled;
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
        var marketCompareEnabledNode = document.getElementById("market-compare-enabled");
        var marketCompareAutoSearchEnabledNode = document.getElementById("market-compare-auto-search-enabled");
        var marketCompareRankingFormulaNode = document.getElementById("market-compare-ranking-formula");
        var marketCompareRankingFormulaDescriptionNode = document.getElementById("market-compare-ranking-formula-description");
        var marketCompareStrictModeNode = document.getElementById("market-compare-strict-mode");
        var marketCompareExpandedAmountEnabledNode = document.getElementById("market-compare-expanded-amount-enabled");
        var marketCompareMlSimilarityEnabledNode = document.getElementById("market-compare-ml-similarity-enabled");
        var marketCompareDebugEnabledNode = document.getElementById("market-compare-debug-enabled");
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
            !marketCompareEnabledNode ||
            !marketCompareAutoSearchEnabledNode ||
            !marketCompareRankingFormulaNode ||
            !marketCompareRankingFormulaDescriptionNode ||
            !marketCompareStrictModeNode ||
            !marketCompareExpandedAmountEnabledNode ||
            !marketCompareMlSimilarityEnabledNode ||
            !marketCompareDebugEnabledNode ||
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
        buildMarketCompareRankingFormulaOptions(marketCompareRankingFormulaNode, Settings &&
            Array.isArray(Settings.MARKET_COMPARE_RANKING_FORMULA_OPTIONS) &&
            Settings.MARKET_COMPARE_RANKING_FORMULA_OPTIONS.length > 0
            ? Settings.MARKET_COMPARE_RANKING_FORMULA_OPTIONS
            : ["balanced", "visual", "metadata", "variant"]);
        Promise.all([
            loadSelectedCurrency(),
            loadConversionEnabled(),
            loadListingInsightsEnabled(),
            loadListingMetadataButtonEnabled(),
            loadMarketCompareSettings(),
            loadDarkModeEnabled(),
            loadDarkModeBehavior(),
            loadDarkModePrimaryColor(),
            loadDarkModeLegacyColorCustomizationEnabled()
        ]).then(function (values) {
            var selectedCurrency = values[0];
            var enabled = values[1];
            var listingInsightsEnabled = values[2];
            var listingMetadataButtonEnabled = values[3];
            var marketCompareSettings = values[4] && typeof values[4] === "object" ? values[4] : {};
            var marketCompareEnabled = Boolean(marketCompareSettings.enabled);
            var marketCompareAutoSearchEnabled = typeof marketCompareSettings.autoSearchEnabled === "boolean"
                ? marketCompareSettings.autoSearchEnabled
                : DEFAULT_MARKET_COMPARE_AUTO_SEARCH_ENABLED;
            var marketCompareRankingFormula = normalizeMarketCompareRankingFormula(marketCompareSettings.rankingFormula) ||
                DEFAULT_MARKET_COMPARE_RANKING_FORMULA;
            var marketCompareStrictMode = Boolean(marketCompareSettings.strictMode);
            var marketCompareExpandedAmountEnabled = Boolean(marketCompareSettings.expandedAmountEnabled);
            var marketCompareMlSimilarityEnabled = typeof marketCompareSettings.mlSimilarityEnabled === "boolean"
                ? marketCompareSettings.mlSimilarityEnabled
                : DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED;
            var marketCompareDebugEnabled = typeof marketCompareSettings.debugEnabled === "boolean"
                ? marketCompareSettings.debugEnabled
                : DEFAULT_MARKET_COMPARE_DEBUG_ENABLED;
            var darkModeEnabled = values[5];
            var darkModeBehavior = values[6];
            var darkModePrimaryColor = values[7];
            var darkModeLegacyColorCustomizationEnabled = values[8];
            applySelection(selectNode, customInputNode, selectedCurrency, curatedSet);
            enabledNode.checked = enabled;
            syncCurrencyInputs(selectNode, customInputNode, enabled);
            listingInsightsEnabledNode.checked = listingInsightsEnabled;
            listingMetadataButtonEnabledNode.checked = listingMetadataButtonEnabled;
            marketCompareEnabledNode.checked = marketCompareEnabled;
            marketCompareAutoSearchEnabledNode.checked = marketCompareAutoSearchEnabled;
            marketCompareRankingFormulaNode.value = marketCompareRankingFormula;
            updateMarketCompareRankingFormulaDescription(marketCompareRankingFormulaDescriptionNode, marketCompareRankingFormula);
            marketCompareStrictModeNode.checked = marketCompareStrictMode;
            marketCompareExpandedAmountEnabledNode.checked = marketCompareExpandedAmountEnabled;
            marketCompareMlSimilarityEnabledNode.checked = marketCompareMlSimilarityEnabled;
            marketCompareDebugEnabledNode.checked = marketCompareDebugEnabled;
            syncMarketCompareInputs(marketCompareEnabledNode, marketCompareAutoSearchEnabledNode, marketCompareRankingFormulaNode, marketCompareStrictModeNode, marketCompareExpandedAmountEnabledNode, marketCompareMlSimilarityEnabledNode, marketCompareDebugEnabledNode);
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
        if (typeof marketCompareEnabledNode.addEventListener === "function") {
            marketCompareEnabledNode.addEventListener("change", function () {
                syncMarketCompareInputs(marketCompareEnabledNode, marketCompareAutoSearchEnabledNode, marketCompareRankingFormulaNode, marketCompareStrictModeNode, marketCompareExpandedAmountEnabledNode, marketCompareMlSimilarityEnabledNode, marketCompareDebugEnabledNode);
                setStatus(statusNode, null, "");
            });
        }
        if (typeof marketCompareAutoSearchEnabledNode.addEventListener === "function") {
            marketCompareAutoSearchEnabledNode.addEventListener("change", function () {
                setStatus(statusNode, null, "");
            });
        }
        if (typeof marketCompareRankingFormulaNode.addEventListener === "function") {
            marketCompareRankingFormulaNode.addEventListener("change", function () {
                updateMarketCompareRankingFormulaDescription(marketCompareRankingFormulaDescriptionNode, marketCompareRankingFormulaNode.value);
                setStatus(statusNode, null, "");
            });
        }
        if (typeof marketCompareStrictModeNode.addEventListener === "function") {
            marketCompareStrictModeNode.addEventListener("change", function () {
                setStatus(statusNode, null, "");
            });
        }
        if (typeof marketCompareExpandedAmountEnabledNode.addEventListener === "function") {
            marketCompareExpandedAmountEnabledNode.addEventListener("change", function () {
                setStatus(statusNode, null, "");
            });
        }
        if (typeof marketCompareMlSimilarityEnabledNode.addEventListener === "function") {
            marketCompareMlSimilarityEnabledNode.addEventListener("change", function () {
                setStatus(statusNode, null, "");
            });
        }
        if (typeof marketCompareDebugEnabledNode.addEventListener === "function") {
            marketCompareDebugEnabledNode.addEventListener("change", function () {
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
                var marketCompareEnabled = Boolean(marketCompareEnabledNode.checked);
                var marketCompareAutoSearchEnabled = Boolean(marketCompareAutoSearchEnabledNode.checked);
                var marketCompareRankingFormula = normalizeMarketCompareRankingFormula(marketCompareRankingFormulaNode.value);
                var marketCompareStrictMode = Boolean(marketCompareStrictModeNode.checked);
                var marketCompareExpandedAmountEnabled = Boolean(marketCompareExpandedAmountEnabledNode.checked);
                var marketCompareMlSimilarityEnabled = Boolean(marketCompareMlSimilarityEnabledNode.checked);
                var marketCompareDebugEnabled = Boolean(marketCompareDebugEnabledNode.checked);
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
                if (!marketCompareRankingFormula) {
                    setStatus(statusNode, "error", "Market compare ranking formula must use a supported option.");
                    return;
                }
                var safeTargetCode = targetCode;
                var safeDarkModeBehavior = darkModeBehavior;
                var safeMarketCompareRankingFormula = marketCompareRankingFormula;
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
                        saveMarketCompareEnabled(marketCompareEnabled),
                        saveMarketCompareAutoSearchEnabled(marketCompareAutoSearchEnabled),
                        saveMarketCompareRankingFormula(safeMarketCompareRankingFormula),
                        saveMarketCompareStrictMode(marketCompareStrictMode),
                        saveMarketCompareExpandedAmountEnabled(marketCompareExpandedAmountEnabled),
                        saveMarketCompareMlSimilarityEnabled(marketCompareMlSimilarityEnabled),
                        saveMarketCompareDebugEnabled(marketCompareDebugEnabled),
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
                var defaultMarketCompareEnabled = Settings && typeof Settings.DEFAULT_MARKET_COMPARE_ENABLED === "boolean"
                    ? Settings.DEFAULT_MARKET_COMPARE_ENABLED
                    : false;
                var defaultMarketCompareAutoSearchEnabled = Settings && typeof Settings.DEFAULT_MARKET_COMPARE_AUTO_SEARCH_ENABLED === "boolean"
                    ? Settings.DEFAULT_MARKET_COMPARE_AUTO_SEARCH_ENABLED
                    : DEFAULT_MARKET_COMPARE_AUTO_SEARCH_ENABLED;
                var defaultMarketCompareRankingFormula = normalizeMarketCompareRankingFormula(Settings && Settings.DEFAULT_MARKET_COMPARE_RANKING_FORMULA) ||
                    DEFAULT_MARKET_COMPARE_RANKING_FORMULA;
                var defaultMarketCompareStrictMode = Settings && typeof Settings.DEFAULT_MARKET_COMPARE_STRICT_MODE === "boolean"
                    ? Settings.DEFAULT_MARKET_COMPARE_STRICT_MODE
                    : false;
                var defaultMarketCompareExpandedAmountEnabled = Settings && typeof Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED === "boolean"
                    ? Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED
                    : false;
                var defaultMarketCompareMlSimilarityEnabled = Settings && typeof Settings.DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED === "boolean"
                    ? Settings.DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED
                    : DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED;
                var defaultMarketCompareDebugEnabled = Settings && typeof Settings.DEFAULT_MARKET_COMPARE_DEBUG_ENABLED === "boolean"
                    ? Settings.DEFAULT_MARKET_COMPARE_DEBUG_ENABLED
                    : DEFAULT_MARKET_COMPARE_DEBUG_ENABLED;
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
                    saveMarketCompareEnabled(defaultMarketCompareEnabled),
                    saveMarketCompareAutoSearchEnabled(defaultMarketCompareAutoSearchEnabled),
                    saveMarketCompareRankingFormula(defaultMarketCompareRankingFormula),
                    saveMarketCompareStrictMode(defaultMarketCompareStrictMode),
                    saveMarketCompareExpandedAmountEnabled(defaultMarketCompareExpandedAmountEnabled),
                    saveMarketCompareMlSimilarityEnabled(defaultMarketCompareMlSimilarityEnabled),
                    saveMarketCompareDebugEnabled(defaultMarketCompareDebugEnabled),
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
                    marketCompareEnabledNode.checked = defaultMarketCompareEnabled;
                    marketCompareAutoSearchEnabledNode.checked = defaultMarketCompareAutoSearchEnabled;
                    marketCompareRankingFormulaNode.value = defaultMarketCompareRankingFormula;
                    updateMarketCompareRankingFormulaDescription(marketCompareRankingFormulaDescriptionNode, defaultMarketCompareRankingFormula);
                    marketCompareStrictModeNode.checked = defaultMarketCompareStrictMode;
                    marketCompareExpandedAmountEnabledNode.checked = defaultMarketCompareExpandedAmountEnabled;
                    marketCompareMlSimilarityEnabledNode.checked = defaultMarketCompareMlSimilarityEnabled;
                    marketCompareDebugEnabledNode.checked = defaultMarketCompareDebugEnabled;
                    syncMarketCompareInputs(marketCompareEnabledNode, marketCompareAutoSearchEnabledNode, marketCompareRankingFormulaNode, marketCompareStrictModeNode, marketCompareExpandedAmountEnabledNode, marketCompareMlSimilarityEnabledNode, marketCompareDebugEnabledNode);
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