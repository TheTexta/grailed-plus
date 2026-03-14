(function () {
  "use strict";

  var Settings = (globalThis as any).GrailedPlusSettings;
  var Currency = (globalThis as any).GrailedPlusCurrency;
  var DEFAULT_DARK_MODE_PRIMARY_COLOR = "#000000";
  var DEFAULT_DARK_MODE_BEHAVIOR = "system";

  var CURRENCY_LABELS: Record<string, string> = {
    USD: "USD - US Dollar",
    EUR: "EUR - Euro",
    GBP: "GBP - British Pound",
    CAD: "CAD - Canadian Dollar",
    AUD: "AUD - Australian Dollar",
    JPY: "JPY - Japanese Yen"
  };

  function normalizeCurrencyCode(input: any): string | null {
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

  function normalizeHexColor(input: any): string | null {
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

  function normalizeDarkModeBehavior(input: any): string | null {
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

  function setStatus(node: any, tone: any, message: any): void {
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

  function loadSelectedCurrency(): Promise<string> {
    if (!Settings || typeof Settings.getSelectedCurrency !== "function") {
      return Promise.resolve("USD");
    }

    return Settings.getSelectedCurrency().then(function (value: any) {
      return normalizeCurrencyCode(value) || "USD";
    });
  }

  function loadConversionEnabled(): Promise<boolean> {
    if (!Settings || typeof Settings.getCurrencyConversionEnabled !== "function") {
      return Promise.resolve(false);
    }

    return Settings.getCurrencyConversionEnabled().then(function (value: any) {
      return Boolean(value);
    });
  }

  function saveSelectedCurrency(code: string) {
    if (!Settings || typeof Settings.setSelectedCurrency !== "function") {
      return Promise.resolve({
        ok: false,
        error: "Settings module unavailable."
      });
    }

    return Settings.setSelectedCurrency(code);
  }

  function saveConversionEnabled(enabled: boolean) {
    if (!Settings || typeof Settings.setCurrencyConversionEnabled !== "function") {
      return Promise.resolve({
        ok: false,
        error: "Settings module unavailable."
      });
    }

    return Settings.setCurrencyConversionEnabled(Boolean(enabled));
  }

  function loadListingInsightsEnabled(): Promise<boolean> {
    var fallbackEnabled =
      Settings && typeof Settings.DEFAULT_LISTING_INSIGHTS_ENABLED === "boolean"
        ? Settings.DEFAULT_LISTING_INSIGHTS_ENABLED
        : true;

    if (!Settings || typeof Settings.getListingInsightsEnabled !== "function") {
      return Promise.resolve(fallbackEnabled);
    }

    return Settings.getListingInsightsEnabled().then(function (value: any) {
      return typeof value === "boolean" ? value : fallbackEnabled;
    });
  }

  function saveListingInsightsEnabled(enabled: boolean) {
    if (!Settings || typeof Settings.setListingInsightsEnabled !== "function") {
      return Promise.resolve({
        ok: false,
        error: "Settings module unavailable."
      });
    }

    return Settings.setListingInsightsEnabled(Boolean(enabled));
  }

  function loadMarketCompareExpandedAmountEnabled(): Promise<boolean> {
    var fallbackEnabled =
      Settings && typeof Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED === "boolean"
        ? Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED
        : false;

    if (!Settings || typeof Settings.getMarketCompareExpandedAmountEnabled !== "function") {
      return Promise.resolve(fallbackEnabled);
    }

    return Settings.getMarketCompareExpandedAmountEnabled().then(function (value: any) {
      return typeof value === "boolean" ? value : fallbackEnabled;
    });
  }

  function saveMarketCompareExpandedAmountEnabled(enabled: boolean) {
    if (!Settings || typeof Settings.setMarketCompareExpandedAmountEnabled !== "function") {
      return Promise.resolve({
        ok: false,
        error: "Settings module unavailable."
      });
    }

    return Settings.setMarketCompareExpandedAmountEnabled(Boolean(enabled));
  }

  function loadDarkModeEnabled(): Promise<boolean> {
    var fallbackEnabled =
      Settings && typeof Settings.DEFAULT_DARK_MODE_ENABLED === "boolean"
        ? Settings.DEFAULT_DARK_MODE_ENABLED
        : true;

    if (!Settings || typeof Settings.getDarkModeEnabled !== "function") {
      return Promise.resolve(fallbackEnabled);
    }

    return Settings.getDarkModeEnabled().then(function (value: any) {
      return typeof value === "boolean" ? value : fallbackEnabled;
    });
  }

  function loadDarkModePrimaryColor(): Promise<string> {
    var fallbackColor = normalizeHexColor(
      Settings && Settings.DEFAULT_DARK_MODE_PRIMARY_COLOR
    ) || DEFAULT_DARK_MODE_PRIMARY_COLOR;

    if (!Settings || typeof Settings.getDarkModePrimaryColor !== "function") {
      return Promise.resolve(fallbackColor);
    }

    return Settings.getDarkModePrimaryColor().then(function (value: any) {
      return normalizeHexColor(value) || fallbackColor;
    });
  }

  function loadDarkModeBehavior(): Promise<string> {
    var fallbackBehavior = normalizeDarkModeBehavior(
      Settings && Settings.DEFAULT_DARK_MODE_BEHAVIOR
    ) || DEFAULT_DARK_MODE_BEHAVIOR;

    if (!Settings || typeof Settings.getDarkModeBehavior !== "function") {
      return Promise.resolve(fallbackBehavior);
    }

    return Settings.getDarkModeBehavior().then(function (value: any) {
      return normalizeDarkModeBehavior(value) || fallbackBehavior;
    });
  }

  function saveDarkModeEnabled(enabled: boolean) {
    if (!Settings || typeof Settings.setDarkModeEnabled !== "function") {
      return Promise.resolve({
        ok: false,
        error: "Settings module unavailable."
      });
    }

    return Settings.setDarkModeEnabled(Boolean(enabled));
  }

  function saveDarkModePrimaryColor(color: string) {
    if (!Settings || typeof Settings.setDarkModePrimaryColor !== "function") {
      return Promise.resolve({
        ok: false,
        error: "Settings module unavailable."
      });
    }

    return Settings.setDarkModePrimaryColor(color);
  }

  function saveDarkModeBehavior(behavior: string) {
    if (!Settings || typeof Settings.setDarkModeBehavior !== "function") {
      return Promise.resolve({
        ok: false,
        error: "Settings module unavailable."
      });
    }

    return Settings.setDarkModeBehavior(behavior);
  }

  function validateCustomCurrency(code: string): Promise<{ ok: boolean; error?: string }> {
    if (!Currency || typeof Currency.getRates !== "function" || typeof Currency.hasCurrencyCode !== "function") {
      return Promise.resolve({
        ok: false,
        error: "Currency validation unavailable."
      });
    }

    return Currency.getRates("USD")
      .then(function (response: any) {
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

  function buildCuratedOptions(selectNode: any, curatedCurrencies: string[]): void {
    if (!selectNode || typeof selectNode.appendChild !== "function") {
      return;
    }

    curatedCurrencies.forEach(function (code: string) {
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

  function syncCurrencyInputs(selectNode: any, customInputNode: any, isEnabled: boolean): void {
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

  function applySelection(
    selectNode: any,
    customInputNode: any,
    selectedCurrency: string,
    curatedSet: Record<string, boolean>
  ): void {
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

  function syncDarkModeInputs(
    enabledNode: any,
    behaviorNode: any,
    colorPickerNode: any,
    colorHexNode: any
  ): void {
    if (!enabledNode || !behaviorNode || !colorPickerNode || !colorHexNode) {
      return;
    }

    var enabled = Boolean(enabledNode.checked);
    behaviorNode.disabled = !enabled;
    colorPickerNode.disabled = !enabled;
    colorHexNode.disabled = !enabled;
  }

  function applyDarkModeColor(colorPickerNode: any, colorHexNode: any, color: any): void {
    if (!colorPickerNode || !colorHexNode) {
      return;
    }

    var normalized = normalizeHexColor(color) || DEFAULT_DARK_MODE_PRIMARY_COLOR;
    colorPickerNode.value = normalized;
    colorHexNode.value = normalized;
  }

  function init(): void {
    var form = document.getElementById("currency-form") as any;
    var enabledNode = document.getElementById("conversion-enabled") as any;
    var listingInsightsEnabledNode = document.getElementById("listing-insights-enabled") as any;
    var marketCompareExpandedAmountEnabledNode = document.getElementById(
      "market-compare-expanded-amount-enabled"
    ) as any;
    var selectNode = document.getElementById("currency-select") as any;
    var customInputNode = document.getElementById("currency-custom") as any;
    var darkModeEnabledNode = document.getElementById("dark-mode-enabled") as any;
    var darkModeBehaviorNode = document.getElementById("dark-mode-behavior") as any;
    var darkModePrimaryNode = document.getElementById("dark-mode-primary") as any;
    var darkModePrimaryHexNode = document.getElementById("dark-mode-primary-hex") as any;
    var resetButton = document.getElementById("reset-button") as any;
    var statusNode = document.getElementById("status") as any;

    if (
      !form ||
      !enabledNode ||
      !listingInsightsEnabledNode ||
      !marketCompareExpandedAmountEnabledNode ||
      !selectNode ||
      !customInputNode ||
      !darkModeEnabledNode ||
      !darkModeBehaviorNode ||
      !darkModePrimaryNode ||
      !darkModePrimaryHexNode ||
      !resetButton ||
      !statusNode
    ) {
      return;
    }

    var curatedCurrencies =
      Settings && Array.isArray(Settings.CURATED_CURRENCIES) && Settings.CURATED_CURRENCIES.length > 0
        ? Settings.CURATED_CURRENCIES
        : ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

    var curatedSet: Record<string, boolean> = Object.create(null);
    curatedCurrencies.forEach(function (code: string) {
      curatedSet[code] = true;
    });

    buildCuratedOptions(selectNode, curatedCurrencies);

    Promise.all([
      loadSelectedCurrency(),
      loadConversionEnabled(),
      loadListingInsightsEnabled(),
      loadMarketCompareExpandedAmountEnabled(),
      loadDarkModeEnabled(),
      loadDarkModeBehavior(),
      loadDarkModePrimaryColor()
    ]).then(function (values: any[]) {
      var selectedCurrency = values[0];
      var enabled = values[1];
      var listingInsightsEnabled = values[2];
      var marketCompareExpandedAmountEnabled = values[3];
      var darkModeEnabled = values[4];
      var darkModeBehavior = values[5];
      var darkModePrimaryColor = values[6];

      applySelection(selectNode, customInputNode, selectedCurrency, curatedSet);
      enabledNode.checked = enabled;
      syncCurrencyInputs(selectNode, customInputNode, enabled);
      listingInsightsEnabledNode.checked = listingInsightsEnabled;
      marketCompareExpandedAmountEnabledNode.checked = marketCompareExpandedAmountEnabled;
      darkModeEnabledNode.checked = darkModeEnabled;
      darkModeBehaviorNode.value = darkModeBehavior;
      applyDarkModeColor(darkModePrimaryNode, darkModePrimaryHexNode, darkModePrimaryColor);
      syncDarkModeInputs(darkModeEnabledNode, darkModeBehaviorNode, darkModePrimaryNode, darkModePrimaryHexNode);
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

    if (typeof marketCompareExpandedAmountEnabledNode.addEventListener === "function") {
      marketCompareExpandedAmountEnabledNode.addEventListener("change", function () {
        setStatus(statusNode, null, "");
      });
    }

    if (typeof darkModeEnabledNode.addEventListener === "function") {
      darkModeEnabledNode.addEventListener("change", function () {
        syncDarkModeInputs(darkModeEnabledNode, darkModeBehaviorNode, darkModePrimaryNode, darkModePrimaryHexNode);
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
      form.addEventListener("submit", function (event: Event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }

        setStatus(statusNode, null, "");

        var conversionEnabled = Boolean(enabledNode.checked);
        var listingInsightsEnabled = Boolean(listingInsightsEnabledNode.checked);
        var marketCompareExpandedAmountEnabled = Boolean(
          marketCompareExpandedAmountEnabledNode.checked
        );
        var usingCustom = selectNode.value === "CUSTOM";
        var darkModeEnabled = Boolean(darkModeEnabledNode.checked);
        var darkModeBehavior = normalizeDarkModeBehavior(darkModeBehaviorNode.value);
        var targetCode: string | null = null;
        var darkModePrimaryColor = normalizeHexColor(darkModePrimaryHexNode.value || darkModePrimaryNode.value);

        if (usingCustom) {
          targetCode = normalizeCurrencyCode(customInputNode.value);
          if (!targetCode) {
            setStatus(statusNode, "error", "Custom code must be a valid 3-letter value.");
            return;
          }
        } else {
          targetCode = normalizeCurrencyCode(selectNode.value);
          if (!targetCode) {
            setStatus(statusNode, "error", "Please choose a valid currency.");
            return;
          }
        }

        if (!darkModePrimaryColor) {
          setStatus(statusNode, "error", "Primary color must be a valid hex value.");
          return;
        }

        if (!darkModeBehavior) {
          setStatus(statusNode, "error", "Dark mode behavior must be either system or permanent.");
          return;
        }

        var safeTargetCode = targetCode as string;
        var safeDarkModeBehavior = darkModeBehavior as string;
        var safeDarkModePrimaryColor = darkModePrimaryColor as string;

        applyDarkModeColor(darkModePrimaryNode, darkModePrimaryHexNode, safeDarkModePrimaryColor);

        var validationPromise: Promise<{ ok: boolean; error?: string }> = Promise.resolve({ ok: true });
        if (usingCustom && conversionEnabled) {
          validationPromise = validateCustomCurrency(targetCode);
        }

        validationPromise
          .then(function (validation: { ok: boolean; error?: string }) {
            if (!validation.ok) {
              setStatus(statusNode, "error", validation.error || "Invalid currency code.");
              return Promise.reject(new Error("validation_failed"));
            }

            return Promise.all([
              saveSelectedCurrency(safeTargetCode),
              saveConversionEnabled(conversionEnabled),
              saveListingInsightsEnabled(listingInsightsEnabled),
              saveMarketCompareExpandedAmountEnabled(marketCompareExpandedAmountEnabled),
              saveDarkModeEnabled(darkModeEnabled),
              saveDarkModeBehavior(safeDarkModeBehavior),
              saveDarkModePrimaryColor(safeDarkModePrimaryColor)
            ]).then(function (results: Array<{ ok: boolean; error?: string }>) {
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
        var defaultCurrency =
          Settings && typeof Settings.DEFAULT_CURRENCY === "string" ? Settings.DEFAULT_CURRENCY : "USD";
        var defaultConversionEnabled =
          Settings && typeof Settings.DEFAULT_CONVERSION_ENABLED === "boolean"
            ? Settings.DEFAULT_CONVERSION_ENABLED
            : false;
        var defaultListingInsightsEnabled =
          Settings && typeof Settings.DEFAULT_LISTING_INSIGHTS_ENABLED === "boolean"
            ? Settings.DEFAULT_LISTING_INSIGHTS_ENABLED
            : true;
        var defaultMarketCompareExpandedAmountEnabled =
          Settings && typeof Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED === "boolean"
            ? Settings.DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED
            : false;
        var defaultDarkModeEnabled =
          Settings && typeof Settings.DEFAULT_DARK_MODE_ENABLED === "boolean"
            ? Settings.DEFAULT_DARK_MODE_ENABLED
            : true;
        var defaultDarkModeBehavior =
          normalizeDarkModeBehavior(Settings && Settings.DEFAULT_DARK_MODE_BEHAVIOR) ||
          DEFAULT_DARK_MODE_BEHAVIOR;
        var defaultDarkModePrimaryColor =
          normalizeHexColor(Settings && Settings.DEFAULT_DARK_MODE_PRIMARY_COLOR) ||
          DEFAULT_DARK_MODE_PRIMARY_COLOR;

        Promise.all([
          saveSelectedCurrency(defaultCurrency),
          saveConversionEnabled(defaultConversionEnabled),
          saveListingInsightsEnabled(defaultListingInsightsEnabled),
          saveMarketCompareExpandedAmountEnabled(defaultMarketCompareExpandedAmountEnabled),
          saveDarkModeEnabled(defaultDarkModeEnabled),
          saveDarkModeBehavior(defaultDarkModeBehavior),
          saveDarkModePrimaryColor(defaultDarkModePrimaryColor)
        ]).then(function (results: Array<{ ok: boolean; error?: string }>) {
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
          marketCompareExpandedAmountEnabledNode.checked = defaultMarketCompareExpandedAmountEnabled;

          darkModeEnabledNode.checked = defaultDarkModeEnabled;
          darkModeBehaviorNode.value = defaultDarkModeBehavior;
          applyDarkModeColor(darkModePrimaryNode, darkModePrimaryHexNode, defaultDarkModePrimaryColor);
          syncDarkModeInputs(darkModeEnabledNode, darkModeBehaviorNode, darkModePrimaryNode, darkModePrimaryHexNode);

          setStatus(statusNode, "success", "Reset to defaults.");
        });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
