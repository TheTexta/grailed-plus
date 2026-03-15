interface CStorageLike {
  get: (...args: unknown[]) => unknown;
  set: (...args: unknown[]) => unknown;
}

interface CBrowserStorageModule {
  getStorageLocal: () => CStorageLike | null;
  storageGet: (storage: CStorageLike | null, key: string) => Promise<Record<string, unknown>>;
  storageSet: (storage: CStorageLike | null, payload: Record<string, unknown>) => Promise<boolean>;
}

interface CRatesPayload {
  base: string;
  timestamp: number;
  rates: Record<string, unknown>;
}

interface CRatesResponse {
  rates: Record<string, unknown>;
  base: string;
  timestamp: number;
  source: string;
}

interface CModule {
  CACHE_KEY: string;
  CACHE_TTL_MS: number;
  normalizeCurrencyCode: (input: unknown) => string | null;
  getRates: (baseCurrency: unknown) => Promise<CRatesResponse>;
  convert: (amount: unknown, from: unknown, to: unknown) => Promise<number | null>;
  hasCurrencyCode: (code: unknown, rates: unknown) => boolean;
}

interface CGlobalRoot {
  GrailedPlusBrowserStorage?: CBrowserStorageModule;
  GrailedPlusCurrency?: CModule;
}

(function (root: CGlobalRoot, factory: () => CModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusCurrency = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as CGlobalRoot) : {},
  function () {
    "use strict";

    const CACHE_KEY = "grailed_plus_exchange_rates_v1";
    const CACHE_TTL_MS = 60 * 60 * 1000;
    let BrowserStorage: CBrowserStorageModule | null = null;

    if (typeof globalThis !== "undefined" && (globalThis as unknown as CGlobalRoot).GrailedPlusBrowserStorage) {
      BrowserStorage = (globalThis as unknown as CGlobalRoot).GrailedPlusBrowserStorage || null;
    }

    if (!BrowserStorage && typeof require === "function") {
      try {
        BrowserStorage = require("./browserStorage") as CBrowserStorageModule;
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

    function getStorageLocal(): CStorageLike | null {
      return BrowserStorage && typeof BrowserStorage.getStorageLocal === "function"
        ? BrowserStorage.getStorageLocal()
        : null;
    }

    function storageGet(storage: CStorageLike | null, key: string): Promise<Record<string, unknown>> {
      return BrowserStorage && typeof BrowserStorage.storageGet === "function"
        ? BrowserStorage.storageGet(storage, key)
        : Promise.resolve({});
    }

    function storageSet(storage: CStorageLike | null, payload: Record<string, unknown>): Promise<boolean> {
      return BrowserStorage && typeof BrowserStorage.storageSet === "function"
        ? BrowserStorage.storageSet(storage, payload)
        : Promise.resolve(false);
    }

    function isCacheUsable(cache: unknown, baseCurrency: string, nowMs: number): cache is CRatesPayload {
      if (!isCacheStaleButCompatible(cache, baseCurrency)) {
        return false;
      }

      const typedCache = cache as CRatesPayload;
      if (!Number.isFinite(typedCache.timestamp) || typedCache.timestamp <= 0) {
        return false;
      }

      return nowMs - typedCache.timestamp < CACHE_TTL_MS;
    }

    function isCacheStaleButCompatible(cache: unknown, baseCurrency: string): cache is CRatesPayload {
      if (!cache || typeof cache !== "object") {
        return false;
      }
      const typedCache = cache as CRatesPayload;
      if (typedCache.base !== baseCurrency) {
        return false;
      }
      if (!typedCache.rates || typeof typedCache.rates !== "object") {
        return false;
      }
      return true;
    }

    function buildPayload(baseCurrency: string, timestamp: number, rates: Record<string, unknown>): CRatesPayload {
      return {
        base: baseCurrency,
        timestamp: timestamp,
        rates: rates
      };
    }

    function buildResponse(payload: CRatesPayload | null | undefined, source: string): CRatesResponse {
      const safePayload = payload || buildPayload("USD", Date.now(), {});
      return {
        rates: safePayload.rates && typeof safePayload.rates === "object" ? safePayload.rates : {},
        base: safePayload.base || "USD",
        timestamp: Number.isFinite(safePayload.timestamp) ? safePayload.timestamp : Date.now(),
        source: source || "unknown"
      };
    }

    function fetchLatestRates(baseCurrency: string): Promise<CRatesPayload> {
      if (typeof fetch !== "function") {
        return Promise.reject(new Error("fetch unavailable"));
      }

      const endpoint = "https://api.frankfurter.app/latest?base=" + encodeURIComponent(baseCurrency);
      return fetch(endpoint)
        .then(function (res) {
          if (!res || !res.ok) {
            throw new Error("failed to fetch currency rates");
          }
          return res.json() as Promise<{ rates?: Record<string, unknown> }>;
        })
        .then(function (json) {
          const rates = json && json.rates && typeof json.rates === "object" ? json.rates : {};
          return buildPayload(baseCurrency, Date.now(), rates);
        });
    }

    function getRates(baseCurrency: unknown): Promise<CRatesResponse> {
      const normalizedBase = normalizeCurrencyCode(baseCurrency) || "USD";
      const nowMs = Date.now();
      const storage = getStorageLocal();

      return storageGet(storage, CACHE_KEY)
        .then(function (data) {
          const cache = data && data[CACHE_KEY];
          if (isCacheUsable(cache, normalizedBase, nowMs)) {
            return buildResponse(cache, "cache_fresh");
          }

          return fetchLatestRates(normalizedBase)
            .then(function (payload) {
              const wrapper: Record<string, unknown> = {};
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

    function hasCurrencyCode(code: unknown, rates: unknown): boolean {
      const normalized = normalizeCurrencyCode(code);
      if (!normalized || !rates || typeof rates !== "object") {
        return false;
      }

      const typedRates = rates as Record<string, unknown>;
      return Number.isFinite(Number(typedRates[normalized])) && Number(typedRates[normalized]) > 0;
    }

    function convert(amount: unknown, from: unknown, to: unknown): Promise<number | null> {
      const amountNumber = Number(amount);
      const fromCurrency = normalizeCurrencyCode(from);
      const toCurrency = normalizeCurrencyCode(to);

      if (!Number.isFinite(amountNumber) || !fromCurrency || !toCurrency) {
        return Promise.resolve(null);
      }

      if (fromCurrency === toCurrency) {
        return Promise.resolve(amountNumber);
      }

      return getRates(fromCurrency).then(function (result) {
        const rates = result && result.rates ? result.rates : {};
        if (!hasCurrencyCode(toCurrency, rates)) {
          return null;
        }

        return amountNumber * Number((rates as Record<string, unknown>)[toCurrency]);
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
  }
);
