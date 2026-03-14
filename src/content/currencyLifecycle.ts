interface CCurrencyContext {
  selectedCurrency: string;
  rate: number | null;
  mode: "dual";
  usdRates?: Record<string, unknown>;
}

interface CSettingsLike {
  normalizeCurrencyCode?: (input: unknown) => string | null;
  getSelectedCurrency?: () => Promise<string | unknown>;
  getCurrencyConversionEnabled?: () => Promise<boolean | unknown>;
}

interface CCurrencyApiLike {
  getRates?: (baseCurrency: string) => Promise<{
    rates?: Record<string, unknown>;
  }>;
}

interface CInsightsPanelLike {
  applySidebarCurrency?: (doc: Document | null | undefined, currencyContext: CCurrencyContext) => boolean;
  applyCardCurrency?: (doc: Document | null | undefined, currencyContext: CCurrencyContext) => boolean;
}

interface CResolveCurrencyOptions {
  settings?: CSettingsLike | null;
  currencyApi?: CCurrencyApiLike | null;
  normalizeCurrencyCode?: (input: unknown) => string | null;
}

interface CApplyCurrencyOptions {
  insightsPanel?: CInsightsPanelLike | null;
  documentObj?: Document | null;
  currencyContext?: CCurrencyContext | null;
}

interface CCurrencyLifecycleModule {
  createUsdCurrencyContext: () => CCurrencyContext;
  normalizeCurrencyCode: (input: unknown, settings?: CSettingsLike | null) => string | null;
  resolveCurrencyContext: (options?: CResolveCurrencyOptions | null) => Promise<CCurrencyContext>;
  applySidebarCurrency: (options?: CApplyCurrencyOptions | null) => boolean;
  applyCardCurrency: (options?: CApplyCurrencyOptions | null) => boolean;
}

interface CCurrencyLifecycleGlobal {
  GrailedPlusCurrencyLifecycle?: CCurrencyLifecycleModule;
}

(function (root: CCurrencyLifecycleGlobal, factory: () => CCurrencyLifecycleModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusCurrencyLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as CCurrencyLifecycleGlobal) : {}, function () {
  "use strict";

  function createUsdCurrencyContext(): CCurrencyContext {
    return {
      selectedCurrency: "USD",
      rate: null,
      mode: "dual"
    };
  }

  function normalizeCurrencyCode(input: unknown, settings?: CSettingsLike | null): string | null {
    if (settings && typeof settings.normalizeCurrencyCode === "function") {
      return settings.normalizeCurrencyCode(input);
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

  function resolveCurrencyContext(options?: CResolveCurrencyOptions | null): Promise<CCurrencyContext> {
    var config = options && typeof options === "object" ? options : {};
    var settings = config.settings || null;
    var currencyApi = config.currencyApi || null;
    var normalizeCurrencyCodeFn =
      typeof config.normalizeCurrencyCode === "function"
        ? config.normalizeCurrencyCode
        : function (value: unknown) {
            return normalizeCurrencyCode(value, settings);
          };

    var defaultContext = createUsdCurrencyContext();

    if (!settings || typeof settings.getSelectedCurrency !== "function") {
      return Promise.resolve(defaultContext);
    }

    var enabledPromise =
      typeof settings.getCurrencyConversionEnabled === "function"
        ? settings.getCurrencyConversionEnabled()
        : Promise.resolve(false);

    var selectedCurrencyGetter = settings && settings.getSelectedCurrency;

    return enabledPromise
      .then(function (enabled) {
        if (!enabled) {
          return defaultContext;
        }
        return typeof selectedCurrencyGetter === "function" ? selectedCurrencyGetter() : defaultContext;
      })
      .then(function (savedCurrency) {
        if (typeof savedCurrency !== "string") {
          return defaultContext;
        }

        var selectedCurrency = normalizeCurrencyCodeFn(savedCurrency) || defaultContext.selectedCurrency;
        var context: CCurrencyContext = {
          selectedCurrency: selectedCurrency,
          rate: null,
          mode: "dual"
        };

        if (selectedCurrency === "USD") {
          return context;
        }

        if (!currencyApi || typeof currencyApi.getRates !== "function") {
          return context;
        }

        return currencyApi
          .getRates("USD")
          .then(function (result) {
            var rates = result && result.rates && typeof result.rates === "object" ? result.rates : {};
            var rate = Number(rates[selectedCurrency]);
            if (Number.isFinite(rate) && rate > 0) {
              context.rate = rate;
            }
            context.usdRates = rates;
            return context;
          })
          .catch(function () {
            return context;
          });
      })
      .catch(function () {
        return defaultContext;
      });
  }

  function applySidebarCurrency(options?: CApplyCurrencyOptions | null): boolean {
    var config = options && typeof options === "object" ? options : {};
    var insightsPanel = config.insightsPanel;
    var documentObj = config.documentObj;
    var currencyContext = config.currencyContext;

    if (!insightsPanel || typeof insightsPanel.applySidebarCurrency !== "function") {
      return false;
    }

    try {
      return insightsPanel.applySidebarCurrency(
        documentObj,
        currencyContext || createUsdCurrencyContext()
      );
    } catch (_) {
      return false;
    }
  }

  function applyCardCurrency(options?: CApplyCurrencyOptions | null): boolean {
    var config = options && typeof options === "object" ? options : {};
    var insightsPanel = config.insightsPanel;
    var documentObj = config.documentObj;
    var currencyContext = config.currencyContext;

    if (!insightsPanel || typeof insightsPanel.applyCardCurrency !== "function") {
      return false;
    }

    try {
      return insightsPanel.applyCardCurrency(documentObj, currencyContext || createUsdCurrencyContext());
    } catch (_) {
      return false;
    }
  }

  return {
    createUsdCurrencyContext: createUsdCurrencyContext,
    normalizeCurrencyCode: normalizeCurrencyCode,
    resolveCurrencyContext: resolveCurrencyContext,
    applySidebarCurrency: applySidebarCurrency,
    applyCardCurrency: applyCardCurrency
  };
});
