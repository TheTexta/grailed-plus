interface SStorageResult {
  ok: boolean;
  error?: string;
}

interface SStorageLocal {
  get: (key: string, callback?: (data: Record<string, unknown>) => void) => unknown;
  set: (payload: Record<string, unknown>, callback?: () => void) => unknown;
}

interface SBrowserStorageModule {
  getStorageLocal: () => SStorageLocal | null;
  storageGet: (storage: SStorageLocal | null, key: string) => Promise<Record<string, unknown>>;
  storageSet: (storage: SStorageLocal | null, payload: Record<string, unknown>) => Promise<boolean>;
}

interface SSettingsModule {
  DEFAULT_CURRENCY: string;
  DEFAULT_CONVERSION_ENABLED: boolean;
  DEFAULT_LISTING_INSIGHTS_ENABLED: boolean;
  DEFAULT_LISTING_METADATA_BUTTON_ENABLED: boolean;
  DEFAULT_MARKET_COMPARE_ENABLED: boolean;
  DEFAULT_MARKET_COMPARE_RANKING_FORMULA: string;
  DEFAULT_MARKET_COMPARE_STRICT_MODE: boolean;
  DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED: boolean;
  DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED: boolean;
  DEFAULT_MARKET_COMPARE_DEBUG_ENABLED: boolean;
  DEFAULT_DARK_MODE_ENABLED: boolean;
  DEFAULT_DARK_MODE_BEHAVIOR: "system" | "permanent";
  DEFAULT_DARK_MODE_PRIMARY_COLOR: string;
  DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED: boolean;
  CURATED_CURRENCIES: string[];
  MARKET_COMPARE_RANKING_FORMULA_OPTIONS: string[];
  CURRENCY_STORAGE_KEY: string;
  CONVERSION_ENABLED_STORAGE_KEY: string;
  LISTING_INSIGHTS_ENABLED_STORAGE_KEY: string;
  LISTING_METADATA_BUTTON_STORAGE_KEY: string;
  MARKET_COMPARE_ENABLED_STORAGE_KEY: string;
  MARKET_COMPARE_RANKING_FORMULA_STORAGE_KEY: string;
  MARKET_COMPARE_STRICT_MODE_STORAGE_KEY: string;
  MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY: string;
  MARKET_COMPARE_ML_SIMILARITY_STORAGE_KEY: string;
  MARKET_COMPARE_DEBUG_ENABLED_STORAGE_KEY: string;
  DARK_MODE_ENABLED_STORAGE_KEY: string;
  DARK_MODE_BEHAVIOR_STORAGE_KEY: string;
  DARK_MODE_PRIMARY_COLOR_STORAGE_KEY: string;
  DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_STORAGE_KEY: string;
  STORAGE_KEY: string;
  normalizeCurrencyCode: (input: unknown) => string | null;
  normalizeHexColor: (input: unknown) => string | null;
  normalizeDarkModeBehavior: (input: unknown) => "system" | "permanent" | null;
  normalizeMarketCompareRankingFormula: (input: unknown) => string | null;
  getSelectedCurrency: () => Promise<string>;
  setSelectedCurrency: (code: unknown) => Promise<SStorageResult>;
  getCurrencyConversionEnabled: () => Promise<boolean>;
  setCurrencyConversionEnabled: (enabled: unknown) => Promise<SStorageResult>;
  getListingInsightsEnabled: () => Promise<boolean>;
  setListingInsightsEnabled: (enabled: unknown) => Promise<SStorageResult>;
  getListingMetadataButtonEnabled: () => Promise<boolean>;
  setListingMetadataButtonEnabled: (enabled: unknown) => Promise<SStorageResult>;
  getMarketCompareEnabled: () => Promise<boolean>;
  setMarketCompareEnabled: (enabled: unknown) => Promise<SStorageResult>;
  getMarketCompareRankingFormula: () => Promise<string>;
  setMarketCompareRankingFormula: (formula: unknown) => Promise<SStorageResult>;
  getMarketCompareStrictMode: () => Promise<boolean>;
  setMarketCompareStrictMode: (enabled: unknown) => Promise<SStorageResult>;
  getMarketCompareExpandedAmountEnabled: () => Promise<boolean>;
  setMarketCompareExpandedAmountEnabled: (enabled: unknown) => Promise<SStorageResult>;
  getMarketCompareMlSimilarityEnabled: () => Promise<boolean>;
  setMarketCompareMlSimilarityEnabled: (enabled: unknown) => Promise<SStorageResult>;
  getMarketCompareDebugEnabled: () => Promise<boolean>;
  setMarketCompareDebugEnabled: (enabled: unknown) => Promise<SStorageResult>;
  getMarketCompareSettings: () => Promise<{
    enabled: boolean;
    rankingFormula: string;
    strictMode: boolean;
    expandedAmountEnabled: boolean;
    mlSimilarityEnabled: boolean;
    debugEnabled: boolean;
  }>;
  getDarkModeEnabled: () => Promise<boolean>;
  setDarkModeEnabled: (enabled: unknown) => Promise<SStorageResult>;
  getDarkModeBehavior: () => Promise<"system" | "permanent">;
  setDarkModeBehavior: (behavior: unknown) => Promise<SStorageResult>;
  getDarkModePrimaryColor: () => Promise<string>;
  setDarkModePrimaryColor: (color: unknown) => Promise<SStorageResult>;
  getDarkModeLegacyColorCustomizationEnabled: () => Promise<boolean>;
  setDarkModeLegacyColorCustomizationEnabled: (enabled: unknown) => Promise<SStorageResult>;
}

interface SGlobalRoot {
  GrailedPlusBrowserStorage?: SBrowserStorageModule;
  GrailedPlusSettings?: SSettingsModule;
}

(function (root: SGlobalRoot, factory: () => SSettingsModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusSettings = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as SGlobalRoot) : {},
  function () {
    "use strict";

    const DEFAULT_CURRENCY = "USD";
    const DEFAULT_CONVERSION_ENABLED = false;
    const DEFAULT_LISTING_INSIGHTS_ENABLED = true;
    const DEFAULT_LISTING_METADATA_BUTTON_ENABLED = true;
    const DEFAULT_MARKET_COMPARE_ENABLED = true;
    const DEFAULT_MARKET_COMPARE_RANKING_FORMULA = "balanced";
    const DEFAULT_MARKET_COMPARE_STRICT_MODE = false;
    const DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED = false;
    const DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED = true;
    const DEFAULT_MARKET_COMPARE_DEBUG_ENABLED = false;
    const DEFAULT_DARK_MODE_ENABLED = true;
    const DEFAULT_DARK_MODE_BEHAVIOR: "system" | "permanent" = "system";
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
    const MARKET_COMPARE_RANKING_FORMULA_STORAGE_KEY =
      "grailed_plus_market_compare_ranking_formula_v1";
    const MARKET_COMPARE_STRICT_MODE_STORAGE_KEY = "grailed_plus_market_compare_strict_mode_v1";
    const MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY =
      "grailed_plus_market_compare_expanded_amount_enabled_v1";
    const MARKET_COMPARE_ML_SIMILARITY_STORAGE_KEY =
      "grailed_plus_market_compare_ml_similarity_enabled_v1";
    const MARKET_COMPARE_DEBUG_ENABLED_STORAGE_KEY =
      "grailed_plus_market_compare_debug_enabled_v1";
    const DARK_MODE_ENABLED_STORAGE_KEY = "grailed_plus_dark_mode_enabled_v1";
    const DARK_MODE_BEHAVIOR_STORAGE_KEY = "grailed_plus_dark_mode_behavior_v1";
    const DARK_MODE_PRIMARY_COLOR_STORAGE_KEY = "grailed_plus_dark_mode_primary_color_v1";
    const DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_STORAGE_KEY =
      "grailed_plus_dark_mode_legacy_color_customization_enabled_v1";
    let BrowserStorage: SBrowserStorageModule | null = null;

    if (typeof globalThis !== "undefined" && (globalThis as unknown as SGlobalRoot).GrailedPlusBrowserStorage) {
      BrowserStorage = (globalThis as unknown as SGlobalRoot).GrailedPlusBrowserStorage || null;
    }

    if (!BrowserStorage && typeof require === "function") {
      try {
        BrowserStorage = require("./browserStorage") as SBrowserStorageModule;
      } catch (_) {
        BrowserStorage = null;
      }
    }

    function normalizeCurrencyCode(input: unknown): string | null {
      if (typeof input !== "string") {
        return null;
      }

      const trimmed = input.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(trimmed)) {
        return null;
      }

      return trimmed;
    }

    function normalizeHexColor(input: unknown): string | null {
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

      const longMatch = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
      if (longMatch && longMatch[1]) {
        return "#" + longMatch[1].toUpperCase();
      }

      return null;
    }

    function normalizeDarkModeBehavior(input: unknown): "system" | "permanent" | null {
      if (typeof input !== "string") {
        return null;
      }

      const trimmed = input.trim().toLowerCase();
      if (trimmed !== "system" && trimmed !== "permanent") {
        return null;
      }

      return trimmed as "system" | "permanent";
    }

    function normalizeMarketCompareRankingFormula(input: unknown): string | null {
      if (typeof input !== "string") {
        return null;
      }

      const normalized = input.trim().toLowerCase();
      return MARKET_COMPARE_RANKING_FORMULA_OPTIONS.indexOf(normalized) >= 0 ? normalized : null;
    }

    function getStorageLocal(): SStorageLocal | null {
      return BrowserStorage && typeof BrowserStorage.getStorageLocal === "function"
        ? BrowserStorage.getStorageLocal()
        : null;
    }

    function storageGet(storage: SStorageLocal | null, key: string): Promise<Record<string, unknown>> {
      return BrowserStorage && typeof BrowserStorage.storageGet === "function"
        ? BrowserStorage.storageGet(storage, key)
        : Promise.resolve({});
    }

    function storageSet(storage: SStorageLocal | null, payload: Record<string, unknown>): Promise<boolean> {
      return BrowserStorage && typeof BrowserStorage.storageSet === "function"
        ? BrowserStorage.storageSet(storage, payload)
        : Promise.resolve(false);
    }

    function readSetting<T>(
      storageKey: string,
      fallback: T,
      normalize: (value: unknown) => T
    ): Promise<T> {
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

    function persistSetting(
      storageKey: string,
      value: unknown,
      failureMessage: string
    ): Promise<SStorageResult> {
      const storage = getStorageLocal();
      if (!storage) {
        return Promise.resolve({
          ok: false,
          error: "Storage unavailable."
        });
      }

      const payload: Record<string, unknown> = {};
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

    function createBooleanSetting(
      storageKey: string,
      fallback: boolean,
      settingDescription: string
    ): {
      get: () => Promise<boolean>;
      set: (enabled: unknown) => Promise<SStorageResult>;
    } {
      return {
        get: function () {
          return readSetting(storageKey, fallback, function (value) {
            return typeof value === "boolean" ? value : fallback;
          });
        },
        set: function (enabled: unknown) {
          return persistSetting(
            storageKey,
            Boolean(enabled),
            "Failed to persist " + settingDescription + "."
          );
        }
      };
    }

    function createValidatedSetting<T>(
      storageKey: string,
      fallback: T,
      normalize: (value: unknown) => T | null,
      invalidMessage: string,
      failureMessage: string
    ): {
      get: () => Promise<T>;
      set: (value: unknown) => Promise<SStorageResult>;
    } {
      return {
        get: function () {
          return readSetting(storageKey, fallback, function (value) {
            const normalized = normalize(value);
            return normalized == null ? fallback : normalized;
          });
        },
        set: function (value: unknown) {
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

    const selectedCurrencySetting = createValidatedSetting(
      CURRENCY_STORAGE_KEY,
      DEFAULT_CURRENCY,
      normalizeCurrencyCode,
      "Currency must be a 3-letter code.",
      "Failed to persist currency."
    );
    const currencyConversionSetting = createBooleanSetting(
      CONVERSION_ENABLED_STORAGE_KEY,
      DEFAULT_CONVERSION_ENABLED,
      "conversion status"
    );
    const listingInsightsSetting = createBooleanSetting(
      LISTING_INSIGHTS_ENABLED_STORAGE_KEY,
      DEFAULT_LISTING_INSIGHTS_ENABLED,
      "listing insights status"
    );
    const listingMetadataButtonSetting = createBooleanSetting(
      LISTING_METADATA_BUTTON_STORAGE_KEY,
      DEFAULT_LISTING_METADATA_BUTTON_ENABLED,
      "listing metadata button status"
    );
    const marketCompareEnabledSetting = createBooleanSetting(
      MARKET_COMPARE_ENABLED_STORAGE_KEY,
      DEFAULT_MARKET_COMPARE_ENABLED,
      "market compare status"
    );
    const marketCompareRankingFormulaSetting = createValidatedSetting(
      MARKET_COMPARE_RANKING_FORMULA_STORAGE_KEY,
      DEFAULT_MARKET_COMPARE_RANKING_FORMULA,
      normalizeMarketCompareRankingFormula,
      "Market compare ranking formula must match a supported option.",
      "Failed to persist market compare ranking formula."
    );
    const marketCompareStrictModeSetting = createBooleanSetting(
      MARKET_COMPARE_STRICT_MODE_STORAGE_KEY,
      DEFAULT_MARKET_COMPARE_STRICT_MODE,
      "market compare strict mode status"
    );
    const marketCompareExpandedAmountSetting = createBooleanSetting(
      MARKET_COMPARE_EXPANDED_AMOUNT_STORAGE_KEY,
      DEFAULT_MARKET_COMPARE_EXPANDED_AMOUNT_ENABLED,
      "market compare expanded amount status"
    );
    const marketCompareMlSimilaritySetting = createBooleanSetting(
      MARKET_COMPARE_ML_SIMILARITY_STORAGE_KEY,
      DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED,
      "market compare ml similarity status"
    );
    const marketCompareDebugSetting = createBooleanSetting(
      MARKET_COMPARE_DEBUG_ENABLED_STORAGE_KEY,
      DEFAULT_MARKET_COMPARE_DEBUG_ENABLED,
      "market compare debug status"
    );
    const darkModeEnabledSetting = createBooleanSetting(
      DARK_MODE_ENABLED_STORAGE_KEY,
      DEFAULT_DARK_MODE_ENABLED,
      "dark mode status"
    );
    const darkModeBehaviorSetting = createValidatedSetting(
      DARK_MODE_BEHAVIOR_STORAGE_KEY,
      DEFAULT_DARK_MODE_BEHAVIOR,
      normalizeDarkModeBehavior,
      "Dark mode behavior must be either 'system' or 'permanent'.",
      "Failed to persist dark mode behavior."
    );
    const darkModePrimaryColorSetting = createValidatedSetting(
      DARK_MODE_PRIMARY_COLOR_STORAGE_KEY,
      DEFAULT_DARK_MODE_PRIMARY_COLOR,
      normalizeHexColor,
      "Primary color must be a valid hex value.",
      "Failed to persist dark mode primary color."
    );
    const darkModeLegacyColorCustomizationSetting = createBooleanSetting(
      DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_STORAGE_KEY,
      DEFAULT_DARK_MODE_LEGACY_COLOR_CUSTOMIZATION_ENABLED,
      "dark mode legacy color customization status"
    );

    function getSelectedCurrency(): Promise<string> {
      return selectedCurrencySetting.get();
    }

    function setSelectedCurrency(code: unknown): Promise<SStorageResult> {
      return selectedCurrencySetting.set(code);
    }

    function getCurrencyConversionEnabled(): Promise<boolean> {
      return currencyConversionSetting.get();
    }

    function setCurrencyConversionEnabled(enabled: unknown): Promise<SStorageResult> {
      return currencyConversionSetting.set(enabled);
    }

    function getListingInsightsEnabled(): Promise<boolean> {
      return listingInsightsSetting.get();
    }

    function setListingInsightsEnabled(enabled: unknown): Promise<SStorageResult> {
      return listingInsightsSetting.set(enabled);
    }

    function getListingMetadataButtonEnabled(): Promise<boolean> {
      return listingMetadataButtonSetting.get();
    }

    function setListingMetadataButtonEnabled(enabled: unknown): Promise<SStorageResult> {
      return listingMetadataButtonSetting.set(enabled);
    }

    function getMarketCompareEnabled(): Promise<boolean> {
      return marketCompareEnabledSetting.get();
    }

    function setMarketCompareEnabled(enabled: unknown): Promise<SStorageResult> {
      return marketCompareEnabledSetting.set(enabled);
    }

    function getMarketCompareRankingFormula(): Promise<string> {
      return marketCompareRankingFormulaSetting.get();
    }

    function setMarketCompareRankingFormula(formula: unknown): Promise<SStorageResult> {
      return marketCompareRankingFormulaSetting.set(formula);
    }

    function getMarketCompareStrictMode(): Promise<boolean> {
      return marketCompareStrictModeSetting.get();
    }

    function setMarketCompareStrictMode(enabled: unknown): Promise<SStorageResult> {
      return marketCompareStrictModeSetting.set(enabled);
    }

    function getMarketCompareExpandedAmountEnabled(): Promise<boolean> {
      return marketCompareExpandedAmountSetting.get();
    }

    function setMarketCompareExpandedAmountEnabled(enabled: unknown): Promise<SStorageResult> {
      return marketCompareExpandedAmountSetting.set(enabled);
    }

    function getMarketCompareMlSimilarityEnabled(): Promise<boolean> {
      return marketCompareMlSimilaritySetting.get();
    }

    function setMarketCompareMlSimilarityEnabled(enabled: unknown): Promise<SStorageResult> {
      return marketCompareMlSimilaritySetting.set(enabled);
    }

    function getMarketCompareDebugEnabled(): Promise<boolean> {
      return marketCompareDebugSetting.get();
    }

    function setMarketCompareDebugEnabled(enabled: unknown): Promise<SStorageResult> {
      return marketCompareDebugSetting.set(enabled);
    }

    function getMarketCompareSettings(): Promise<{
      enabled: boolean;
      rankingFormula: string;
      strictMode: boolean;
      expandedAmountEnabled: boolean;
      mlSimilarityEnabled: boolean;
      debugEnabled: boolean;
    }> {
      return Promise.all([
        getMarketCompareEnabled(),
        getMarketCompareRankingFormula(),
        getMarketCompareStrictMode(),
        getMarketCompareExpandedAmountEnabled(),
        getMarketCompareMlSimilarityEnabled(),
        getMarketCompareDebugEnabled()
      ]).then(function (values) {
        return {
          enabled: values[0],
          rankingFormula: values[1],
          strictMode: values[2],
          expandedAmountEnabled: values[3],
          mlSimilarityEnabled: values[4],
          debugEnabled: values[5]
        };
      });
    }

    function getDarkModeEnabled(): Promise<boolean> {
      return darkModeEnabledSetting.get();
    }

    function setDarkModeEnabled(enabled: unknown): Promise<SStorageResult> {
      return darkModeEnabledSetting.set(enabled);
    }

    function getDarkModePrimaryColor(): Promise<string> {
      return darkModePrimaryColorSetting.get();
    }

    function getDarkModeBehavior(): Promise<"system" | "permanent"> {
      return darkModeBehaviorSetting.get();
    }

    function setDarkModeBehavior(behavior: unknown): Promise<SStorageResult> {
      return darkModeBehaviorSetting.set(behavior);
    }

    function setDarkModePrimaryColor(color: unknown): Promise<SStorageResult> {
      return darkModePrimaryColorSetting.set(color);
    }

    function getDarkModeLegacyColorCustomizationEnabled(): Promise<boolean> {
      return darkModeLegacyColorCustomizationSetting.get();
    }

    function setDarkModeLegacyColorCustomizationEnabled(
      enabled: unknown
    ): Promise<SStorageResult> {
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
      DEFAULT_MARKET_COMPARE_ML_SIMILARITY_ENABLED,
      DEFAULT_MARKET_COMPARE_DEBUG_ENABLED,
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
      MARKET_COMPARE_ML_SIMILARITY_STORAGE_KEY,
      MARKET_COMPARE_DEBUG_ENABLED_STORAGE_KEY,
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
      getMarketCompareMlSimilarityEnabled,
      setMarketCompareMlSimilarityEnabled,
      getMarketCompareDebugEnabled,
      setMarketCompareDebugEnabled,
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
  }
);
