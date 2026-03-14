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

    function normalizeString(value: unknown, fallback: string): string {
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed || fallback;
      }

      return fallback;
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

    function createRegistry(options?: MPRegistryOptions | null): MPProviderRegistry {
      const providersByMarket: Record<string, MPProvider> = Object.create(null) as Record<string, MPProvider>;
      const inFlightByKey: Record<string, Promise<MPProviderResult>> = Object.create(null) as Record<
        string,
        Promise<MPProviderResult>
      >;
      const cacheByKey: Record<string, { expiresAt: number; value: MPProviderResult }> = Object.create(null) as Record<
        string,
        { expiresAt: number; value: MPProviderResult }
      >;
      const cacheKeyOrder: string[] = [];
      const cacheTtlMs =
        options && Number.isFinite(Number(options.cacheTtlMs))
          ? Math.max(0, Number(options.cacheTtlMs))
          : 45000;
      const cacheMaxEntries =
        options && Number.isFinite(Number(options.cacheMaxEntries))
          ? Math.max(1, Math.floor(Number(options.cacheMaxEntries)))
          : 100;
      const diagnosticsEnabled = Boolean(options && options.enableDiagnostics);
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

        if (cacheByKey[cacheKey]) {
          delete cacheByKey[cacheKey];
        }

        const orderIndex = cacheKeyOrder.indexOf(cacheKey);
        if (orderIndex >= 0) {
          cacheKeyOrder.splice(orderIndex, 1);
        }
      }

      function upsertCacheEntry(cacheKey: string, value: MPProviderResult): void {
        if (!cacheKey) {
          return;
        }

        const existingIndex = cacheKeyOrder.indexOf(cacheKey);
        if (existingIndex >= 0) {
          cacheKeyOrder.splice(existingIndex, 1);
        }

        cacheByKey[cacheKey] = {
          expiresAt: Date.now() + cacheTtlMs,
          value: value
        };
        cacheKeyOrder.push(cacheKey);

        while (cacheKeyOrder.length > cacheMaxEntries) {
          const evictedKey = cacheKeyOrder.shift();
          if (evictedKey) {
            delete cacheByKey[evictedKey];
            incrementDiagnostic("evictions");
          }
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

        providersByMarket[market] = {
          market: market,
          search: provider.search
        };

        return providersByMarket[market];
      }

      function get(market: unknown): MPProvider | null {
        const key = normalizeString(market, "");
        return key ? providersByMarket[key] || null : null;
      }

      function search(market: unknown, input: unknown): Promise<MPProviderResult> {
        incrementDiagnostic("searchCalls");

        const provider = get(market);
        if (!provider) {
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
          const cached = cacheByKey[cacheKey];
          if (cached && cached.expiresAt > Date.now()) {
            incrementDiagnostic("cacheHits");
            return Promise.resolve(normalizeProviderResult(cached.value, provider.market));
          }

          incrementDiagnostic("cacheMisses");

          if (cached && cached.expiresAt <= Date.now()) {
            removeCacheEntry(cacheKey);
            incrementDiagnostic("expiredRemovals");
          }

          if (inFlightByKey[cacheKey]) {
            incrementDiagnostic("inFlightHits");
            return inFlightByKey[cacheKey];
          }
        }

        const executeSearchPromise = Promise.resolve(provider.search(input)).then(function (result) {
          const normalized = normalizeProviderResult(result, provider.market);
          if (cacheKey && cacheTtlMs > 0 && normalized.ok) {
            upsertCacheEntry(cacheKey, normalized);
            incrementDiagnostic("cacheStores");
          }
          return normalized;
        });

        if (cacheKey) {
          inFlightByKey[cacheKey] = executeSearchPromise.finally(function () {
            delete inFlightByKey[cacheKey];
          });
          return inFlightByKey[cacheKey];
        }

        return executeSearchPromise;
      }

      function listMarkets(): string[] {
        return Object.keys(providersByMarket);
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