interface MPProviderCandidate {
  market: string;
  id: string;
  title: string;
  url: string;
  imageUrl: string;
  price: number;
  currency: string;
  score: number | null;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  raw: unknown;
}

interface MPProviderResult {
  ok: boolean;
  candidates: MPProviderCandidate[];
  fetchedAt: number;
  partial: boolean;
  sourceType: string;
  parserVersion: string;
  parserMismatchLikely: boolean;
  requestCount: number;
  errorCode: string;
  retryAfterMs: number | null;
}

interface MPProvider {
  market: string;
  search: (input: unknown) => unknown | Promise<unknown>;
}

type MPDebugLogger = (stage: string, payload?: Record<string, unknown>) => void;

interface MPProviderRegistry {
  register: (provider: MPProvider) => MPProvider;
  get: (market: unknown) => MPProvider | null;
  search: (market: unknown, input: unknown) => Promise<MPProviderResult>;
  listMarkets: () => string[];
  getDiagnostics: () => MPRegistryDiagnostics | null;
  resetDiagnostics: () => boolean;
}

interface MPRegistryOptions {
  cacheTtlMs?: unknown;
  cacheMaxEntries?: unknown;
  enableDiagnostics?: unknown;
  debugLogger?: MPDebugLogger | null;
}

interface MPRegistryDiagnostics {
  searchCalls: number;
  cacheHits: number;
  cacheMisses: number;
  inFlightHits: number;
  cacheStores: number;
  evictions: number;
  expiredRemovals: number;
}

interface MPModule {
  normalizeCandidate: (candidate: unknown, market: string) => MPProviderCandidate | null;
  normalizeProviderResult: (result: unknown, market: string) => MPProviderResult;
  createRegistry: (options?: MPRegistryOptions | null) => MPProviderRegistry;
  createMockDepopProvider: () => MPProvider;
}

interface MPGlobalRoot {
  GrailedPlusNormalize?: {
    normalizeTrimmedString?: (value: unknown, fallback: string) => string;
  };
  GrailedPlusMarketProviders?: MPModule;
}

(function (root: MPGlobalRoot, factory: () => MPModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusMarketProviders = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as MPGlobalRoot) : {},
  function () {
    "use strict";

    let Normalize: MPGlobalRoot["GrailedPlusNormalize"] | null = null;
    if (typeof globalThis !== "undefined" && (globalThis as unknown as MPGlobalRoot).GrailedPlusNormalize) {
      Normalize = (globalThis as unknown as MPGlobalRoot).GrailedPlusNormalize || null;
    }
    if (!Normalize && typeof require === "function") {
      try {
        Normalize = require("./normalize");
      } catch (_) {
        Normalize = null;
      }
    }

    function normalizeString(value: unknown, fallback: string): string {
      if (Normalize && typeof Normalize.normalizeTrimmedString === "function") {
        return Normalize.normalizeTrimmedString(value, fallback);
      }

      if (typeof value !== "string") {
        return fallback;
      }

      const trimmed = value.trim();
      return trimmed || fallback;
    }

    function normalizeNumber(value: unknown): number | null {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizeCandidate(candidate: unknown, market: string): MPProviderCandidate | null {
      const input = candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : {};
      const normalizedMarket = normalizeString(input.market, market || "unknown");
      const normalizedCurrency = normalizeString(input.currency, "USD");
      const normalizedId = normalizeString(input.id, "");
      const normalizedTitle = normalizeString(input.title, "Untitled");
      const normalizedUrl = normalizeString(input.url, "");
      const normalizedPrice = normalizeNumber(input.price);

      if (!normalizedId || !normalizedUrl || normalizedPrice == null || normalizedPrice < 0) {
        return null;
      }

      return {
        market: normalizedMarket,
        id: normalizedId,
        title: normalizedTitle,
        url: normalizedUrl,
        imageUrl: normalizeString(input.imageUrl, ""),
        price: normalizedPrice,
        currency: normalizedCurrency,
        score: normalizeNumber(input.score),
        deltaAbsolute: normalizeNumber(input.deltaAbsolute),
        deltaPercent: normalizeNumber(input.deltaPercent),
        raw: input.raw || null
      };
    }

    function normalizeProviderResult(result: unknown, market: string): MPProviderResult {
      const input = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
      const rawCandidates = Array.isArray(input.candidates) ? input.candidates : [];
      const candidates = rawCandidates
        .map(function (candidate) {
          return normalizeCandidate(candidate, market);
        })
        .filter(function (candidate): candidate is MPProviderCandidate {
          return Boolean(candidate);
        });

      return {
        ok: Boolean(input.ok),
        candidates: candidates,
        fetchedAt: Number.isFinite(Number(input.fetchedAt)) ? Number(input.fetchedAt) : Date.now(),
        partial: Boolean(input.partial),
        sourceType: normalizeString(input.sourceType, "mock"),
        parserVersion: normalizeString(input.parserVersion, ""),
        parserMismatchLikely: Boolean(input.parserMismatchLikely),
        requestCount: Number.isFinite(Number(input.requestCount)) ? Number(input.requestCount) : 0,
        errorCode: normalizeString(input.errorCode, ""),
        retryAfterMs: normalizeNumber(input.retryAfterMs)
      };
    }

    function stableSerialize(value: unknown): string {
      if (value == null) {
        return "null";
      }

      if (typeof value === "number" || typeof value === "boolean") {
        return JSON.stringify(value);
      }

      if (typeof value === "string") {
        return JSON.stringify(value);
      }

      if (Array.isArray(value)) {
        return "[" + value.map(stableSerialize).join(",") + "]";
      }

      if (typeof value === "object") {
        const record = value as Record<string, unknown>;
        const keys = Object.keys(record).sort();
        const serializedPairs = keys.map(function (key) {
          return JSON.stringify(key) + ":" + stableSerialize(record[key]);
        });
        return "{" + serializedPairs.join(",") + "}";
      }

      return JSON.stringify(String(value));
    }

    function createSearchCacheKey(market: string, input: unknown): string {
      try {
        return market + "::" + stableSerialize(input);
      } catch (_) {
        return "";
      }
    }

    function summarizeSearchInput(input: unknown): Record<string, unknown> {
      const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
      return {
        queries:
          Array.isArray(payload.queries)
            ? payload.queries.filter(function (query) {
                return typeof query === "string" && query.trim();
              })
            : [],
        currency: normalizeString(payload.currency, "USD"),
        limit: normalizeNumber(payload.limit),
        listingId: normalizeString(payload.listingId, ""),
        title: normalizeString(payload.title, "")
      };
    }

    function createRegistry(options?: MPRegistryOptions | null): MPProviderRegistry {
      const providersByMarket = new Map<string, MPProvider>();
      const inFlightByKey = new Map<string, Promise<MPProviderResult>>();
      const cacheByKey = new Map<string, { expiresAt: number; value: MPProviderResult }>();
      const cacheTtlMs =
        options && Number.isFinite(Number(options.cacheTtlMs))
          ? Math.max(0, Number(options.cacheTtlMs))
          : 45000;
      const cacheMaxEntries =
        options && Number.isFinite(Number(options.cacheMaxEntries))
          ? Math.max(1, Math.floor(Number(options.cacheMaxEntries)))
          : 100;
      const diagnosticsEnabled = Boolean(options && options.enableDiagnostics);
      const debugLog = options && typeof options.debugLogger === "function"
        ? options.debugLogger
        : function () {};
      const diagnostics: MPRegistryDiagnostics = {
        searchCalls: 0,
        cacheHits: 0,
        cacheMisses: 0,
        inFlightHits: 0,
        cacheStores: 0,
        evictions: 0,
        expiredRemovals: 0
      };

      function incrementDiagnostic(key: keyof MPRegistryDiagnostics): void {
        if (!diagnosticsEnabled) {
          return;
        }

        diagnostics[key] += 1;
      }

      function getDiagnostics(): MPRegistryDiagnostics | null {
        if (!diagnosticsEnabled) {
          return null;
        }

        return {
          searchCalls: diagnostics.searchCalls,
          cacheHits: diagnostics.cacheHits,
          cacheMisses: diagnostics.cacheMisses,
          inFlightHits: diagnostics.inFlightHits,
          cacheStores: diagnostics.cacheStores,
          evictions: diagnostics.evictions,
          expiredRemovals: diagnostics.expiredRemovals
        };
      }

      function resetDiagnostics(): boolean {
        if (!diagnosticsEnabled) {
          return false;
        }

        diagnostics.searchCalls = 0;
        diagnostics.cacheHits = 0;
        diagnostics.cacheMisses = 0;
        diagnostics.inFlightHits = 0;
        diagnostics.cacheStores = 0;
        diagnostics.evictions = 0;
        diagnostics.expiredRemovals = 0;
        return true;
      }

      function removeCacheEntry(cacheKey: string): void {
        if (!cacheKey) {
          return;
        }

        cacheByKey.delete(cacheKey);
      }

      function upsertCacheEntry(cacheKey: string, value: MPProviderResult, market: string): void {
        if (!cacheKey) {
          return;
        }

        cacheByKey.delete(cacheKey);
        cacheByKey.set(cacheKey, {
          expiresAt: Date.now() + cacheTtlMs,
          value: value
        });

        while (cacheByKey.size > cacheMaxEntries) {
          const oldestKey = cacheByKey.keys().next().value;
          if (!oldestKey) {
            break;
          }

          cacheByKey.delete(oldestKey);
          incrementDiagnostic("evictions");
          debugLog("registry.cache_evict", {
            market: market,
            cacheSize: cacheByKey.size
          });
        }
      }

      function register(provider: MPProvider): MPProvider {
        if (!provider || typeof provider !== "object") {
          throw new Error("Provider must be an object.");
        }

        const market = normalizeString(provider.market, "");
        if (!market) {
          throw new Error("Provider must include a non-empty market.");
        }

        if (typeof provider.search !== "function") {
          throw new Error("Provider must implement search(input).");
        }

        const normalizedProvider = {
          market: market,
          search: provider.search
        };
        providersByMarket.set(market, normalizedProvider);

        return normalizedProvider;
      }

      function get(market: unknown): MPProvider | null {
        const key = normalizeString(market, "");
        return key ? providersByMarket.get(key) || null : null;
      }

      function search(market: unknown, input: unknown): Promise<MPProviderResult> {
        incrementDiagnostic("searchCalls");
        const searchSummary = summarizeSearchInput(input);

        const provider = get(market);
        if (!provider) {
          debugLog("registry.provider_missing", {
            market: normalizeString(market, "")
          });
          return Promise.resolve({
            ok: false,
            candidates: [],
            fetchedAt: Date.now(),
            partial: false,
            sourceType: "mock",
            parserVersion: "",
            parserMismatchLikely: false,
            requestCount: 0,
            errorCode: "PROVIDER_NOT_FOUND",
            retryAfterMs: null
          });
        }

        const cacheKey = createSearchCacheKey(provider.market, input);
        if (cacheKey) {
          const cached = cacheByKey.get(cacheKey);
          if (cached && cached.expiresAt > Date.now()) {
            incrementDiagnostic("cacheHits");
            debugLog("registry.cache_hit", Object.assign({
              market: provider.market
            }, searchSummary));
            return Promise.resolve(normalizeProviderResult(cached.value, provider.market));
          }

          incrementDiagnostic("cacheMisses");
          debugLog("registry.cache_miss", Object.assign({
            market: provider.market
          }, searchSummary));

          if (cached && cached.expiresAt <= Date.now()) {
            removeCacheEntry(cacheKey);
            incrementDiagnostic("expiredRemovals");
            debugLog("registry.cache_expired", {
              market: provider.market
            });
          }

          if (inFlightByKey.has(cacheKey)) {
            incrementDiagnostic("inFlightHits");
            debugLog("registry.in_flight_hit", Object.assign({
              market: provider.market
            }, searchSummary));
            return inFlightByKey.get(cacheKey) as Promise<MPProviderResult>;
          }
        }

        const executeSearchPromise = Promise.resolve(provider.search(input)).then(function (result) {
          const normalized = normalizeProviderResult(result, provider.market);
          debugLog("registry.search_result", {
            market: provider.market,
            ok: normalized.ok,
            sourceType: normalized.sourceType,
            partial: normalized.partial,
            requestCount: normalized.requestCount,
            candidateCount: normalized.candidates.length,
            errorCode: normalized.errorCode
          });
          if (cacheKey && cacheTtlMs > 0 && normalized.ok) {
            upsertCacheEntry(cacheKey, normalized, provider.market);
            incrementDiagnostic("cacheStores");
            debugLog("registry.cache_store", {
              market: provider.market,
              candidateCount: normalized.candidates.length,
              sourceType: normalized.sourceType
            });
          }
          return normalized;
        });

        if (cacheKey) {
          const trackedPromise = executeSearchPromise.finally(function () {
            inFlightByKey.delete(cacheKey);
          });
          inFlightByKey.set(cacheKey, trackedPromise);
          return trackedPromise;
        }

        return executeSearchPromise;
      }

      function listMarkets(): string[] {
        return Array.from(providersByMarket.keys());
      }

      return {
        register: register,
        get: get,
        search: search,
        listMarkets: listMarkets,
        getDiagnostics: getDiagnostics,
        resetDiagnostics: resetDiagnostics
      };
    }

    function createMockDepopProvider(): MPProvider {
      return {
        market: "depop",
        search: function (input: unknown): MPProviderResult {
          const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
          const title = normalizeString(payload.title, "");
          const listingPrice = normalizeNumber(payload.listingPrice);

          if (!title) {
            return {
              ok: true,
              candidates: [],
              fetchedAt: Date.now(),
              partial: false,
              sourceType: "mock",
              parserVersion: "",
              parserMismatchLikely: false,
              requestCount: 0,
              errorCode: "",
              retryAfterMs: null
            };
          }

          const basePrice = listingPrice == null ? 120 : listingPrice;
          const candidateOnePrice = Math.max(1, basePrice * 0.88);
          const candidateTwoPrice = Math.max(1, basePrice * 1.07);
          const currency = normalizeString(payload.currency, "USD");

          return {
            ok: true,
            candidates: [
              {
                market: "depop",
                id: "mock-depop-1",
                title: title + " (similar)",
                url: "https://www.depop.com/search/?q=" + encodeURIComponent(title),
                imageUrl: "",
                price: candidateOnePrice,
                currency: currency,
                score: 78,
                deltaAbsolute: candidateOnePrice - basePrice,
                deltaPercent: ((candidateOnePrice - basePrice) / basePrice) * 100,
                raw: null
              },
              {
                market: "depop",
                id: "mock-depop-2",
                title: title + " (alt)",
                url: "https://www.depop.com/search/?q=" + encodeURIComponent(title + " used"),
                imageUrl: "",
                price: candidateTwoPrice,
                currency: currency,
                score: 64,
                deltaAbsolute: candidateTwoPrice - basePrice,
                deltaPercent: ((candidateTwoPrice - basePrice) / basePrice) * 100,
                raw: null
              }
            ],
            fetchedAt: Date.now(),
            partial: false,
            sourceType: "mock",
            parserVersion: "",
            parserMismatchLikely: false,
            requestCount: 0,
            errorCode: "",
            retryAfterMs: null
          };
        }
      };
    }

    return {
      normalizeCandidate: normalizeCandidate,
      normalizeProviderResult: normalizeProviderResult,
      createRegistry: createRegistry,
      createMockDepopProvider: createMockDepopProvider
    };
  }
);
