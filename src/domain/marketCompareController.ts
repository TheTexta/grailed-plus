interface MCCandidate {
  id: unknown;
  title: unknown;
  url: unknown;
  imageUrl?: unknown;
  price?: unknown;
  currency?: unknown;
  originalCurrency?: unknown;
  originalPrice?: unknown;
  score?: unknown;
  usedImage?: unknown;
  imageUnavailableReason?: unknown;
  deltaLabel?: unknown;
  deltaPercent?: unknown;
  market?: unknown;
}

interface MCProviderResult {
  ok: boolean;
  candidates: MCCandidate[];
  sourceType?: unknown;
  errorCode?: unknown;
  retryAfterMs?: unknown;
  parserMismatchLikely?: unknown;
}

interface MCProviderRegistry {
  register?: (provider: unknown) => unknown;
  search?: (market: string, input: unknown) => Promise<MCProviderResult>;
}

interface MCQueryResult {
  ok: boolean;
  queries: string[];
  reason?: string;
  errorCode?: string;
}

interface MCListingPricing {
  history?: unknown[];
}

interface MCListing {
  id?: unknown;
  title?: unknown;
  brand?: unknown;
  size?: unknown;
  category?: unknown;
  pricing?: MCListingPricing;
}

interface MCControllerStateResult {
  id: unknown;
  title: unknown;
  url: unknown;
  imageUrl: string;
  price: number | null;
  currency: string;
  originalCurrency: string;
  originalPrice: number | null;
  score: number | null;
  usedImage: boolean;
  imageUnavailableReason: string;
  deltaLabel: string;
}

interface MCControllerState {
  status: string;
  provider: string;
  listingId: string | null;
  lastCheckedAt: number | null;
  errorCode: string;
  retryable: boolean;
  cooldownMs: number | null;
  message: string;
  sourceType: string;
  results: MCControllerStateResult[];
}

interface MCController {
  getState: () => MCControllerState;
  subscribe: (listener: (state: MCControllerState) => void) => () => void;
  resetForListing: (listing: unknown) => void;
  compare: (input: unknown) => Promise<MCControllerState>;
}

interface MCModule {
  createController: (options?: unknown) => MCController;
  createInitialState: () => MCControllerState;
}

interface MCDeps {
  providerRegistry?: MCProviderRegistry;
  provider?: {
    search?: (input: unknown) => Promise<unknown>;
  };
  synthesizeQueries?: (listing: unknown, options?: unknown) => MCQueryResult;
  applyCandidateFilters?: (candidates: MCCandidate[], filters: unknown) => MCCandidate[];
  rankCandidates?: (listing: unknown, candidates: MCCandidate[], options: unknown) => MCCandidate[];
}

interface MCGlobalRoot {
  GrailedPlusMarketCompareController?: MCModule;
  GrailedPlusMarketProviders?: {
    createRegistry?: () => MCProviderRegistry;
    createMockDepopProvider?: () => unknown;
  };
  GrailedPlusQuerySynthesis?: {
    buildQueries?: (listing: unknown, options?: unknown) => MCQueryResult;
  };
  GrailedPlusProviderFilters?: {
    applyCandidateFilters?: (candidates: MCCandidate[], filters: unknown) => MCCandidate[];
  };
  GrailedPlusMatchScoring?: {
    rankCandidates?: (listing: unknown, candidates: MCCandidate[], options: unknown) => MCCandidate[];
  };
}

(function (root: MCGlobalRoot, factory: () => MCModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusMarketCompareController = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as MCGlobalRoot) : {}, function () {
  "use strict";

  let MarketProviders: MCGlobalRoot["GrailedPlusMarketProviders"] | null = null;
  let QuerySynthesis: MCGlobalRoot["GrailedPlusQuerySynthesis"] | null = null;
  let ProviderFilters: MCGlobalRoot["GrailedPlusProviderFilters"] | null = null;
  let MatchScoring: MCGlobalRoot["GrailedPlusMatchScoring"] | null = null;
  if (typeof globalThis !== "undefined" && (globalThis as unknown as MCGlobalRoot).GrailedPlusMarketProviders) {
    MarketProviders = (globalThis as unknown as MCGlobalRoot).GrailedPlusMarketProviders || null;
  }
  if (!MarketProviders && typeof require === "function") {
    try {
      MarketProviders = require("./marketProviders");
    } catch (_) {
      MarketProviders = null;
    }
  }
  if (typeof globalThis !== "undefined" && (globalThis as unknown as MCGlobalRoot).GrailedPlusQuerySynthesis) {
    QuerySynthesis = (globalThis as unknown as MCGlobalRoot).GrailedPlusQuerySynthesis || null;
  }
  if (!QuerySynthesis && typeof require === "function") {
    try {
      QuerySynthesis = require("./querySynthesis");
    } catch (_) {
      QuerySynthesis = null;
    }
  }
  if (typeof globalThis !== "undefined" && (globalThis as unknown as MCGlobalRoot).GrailedPlusProviderFilters) {
    ProviderFilters = (globalThis as unknown as MCGlobalRoot).GrailedPlusProviderFilters || null;
  }
  if (!ProviderFilters && typeof require === "function") {
    try {
      ProviderFilters = require("./providerFilters");
    } catch (_) {
      ProviderFilters = null;
    }
  }
  if (typeof globalThis !== "undefined" && (globalThis as unknown as MCGlobalRoot).GrailedPlusMatchScoring) {
    MatchScoring = (globalThis as unknown as MCGlobalRoot).GrailedPlusMatchScoring || null;
  }
  if (!MatchScoring && typeof require === "function") {
    try {
      MatchScoring = require("./matchScoring");
    } catch (_) {
      MatchScoring = null;
    }
  }

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

  function roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  function formatDeltaLabel(candidate: MCCandidate): string {
    const deltaPercent = normalizeNumber(candidate && candidate.deltaPercent);
    if (deltaPercent == null) {
      return "";
    }

    const rounded = roundTo(Math.abs(deltaPercent), 1);
    if (deltaPercent < 0) {
      return "-" + String(rounded) + "% cheaper";
    }

    if (deltaPercent > 0) {
      return "+" + String(rounded) + "% higher";
    }

    return "same price";
  }

  function createInitialState(): MCControllerState {
    return {
      status: "idle",
      provider: "Depop",
      listingId: null,
      lastCheckedAt: null,
      errorCode: "",
      retryable: false,
      cooldownMs: null,
      message: "",
      sourceType: "",
      results: []
    };
  }

  function getSearchModeHint(queryReason: unknown): string {
    if (queryReason === "category_fallback") {
      return "Using broad search due to unknown category mapping.";
    }
    return "";
  }

  function toErrorModel(errorCode: unknown, retryAfterMs?: unknown, parserMismatchLikely?: unknown): {
    status: string;
    errorCode: string;
    retryable: boolean;
    cooldownMs: number;
    message: string;
  } {
    const code = normalizeString(errorCode, "NETWORK_ERROR");
    const retryMs = normalizeNumber(retryAfterMs);

    if (code === "MISSING_LISTING_DATA") {
      return {
        status: "error",
        errorCode: code,
        retryable: false,
        cooldownMs: 0,
        message: "Listing does not match the currently supported category subset."
      };
    }

    if (code === "NO_RESULTS") {
      return {
        status: "no-results",
        errorCode: code,
        retryable: true,
        cooldownMs: 0,
        message: "No similar Depop listings found."
      };
    }

    if (code === "RATE_LIMITED") {
      return {
        status: "error",
        errorCode: code,
        retryable: true,
        cooldownMs: retryMs == null ? 2000 : retryMs,
        message: "Rate limited by Depop. Wait and try again."
      };
    }

    if (code === "FORBIDDEN_OR_BLOCKED") {
      return {
        status: "error",
        errorCode: code,
        retryable: true,
        cooldownMs: retryMs == null ? 120000 : retryMs,
        message: "Depop temporarily blocked automated search. Try again in a couple of minutes."
      };
    }

    if (code === "PARSE_ERROR") {
      return {
        status: "error",
        errorCode: code,
        retryable: true,
        cooldownMs: 0,
        message: parserMismatchLikely
          ? "Depop page format changed. Try again later."
          : "Depop results could not be parsed."
      };
    }

    return {
      status: "error",
      errorCode: code,
      retryable: true,
      cooldownMs: retryMs == null ? 1500 : retryMs,
      message: "Depop search failed. Try again."
    };
  }

  function pickListingPrice(listing: unknown): number | null {
    const history =
      listing && typeof listing === "object" && (listing as MCListing).pricing && Array.isArray((listing as MCListing).pricing?.history)
        ? ((listing as MCListing).pricing?.history as unknown[])
        : [];

    if (!history.length) {
      return null;
    }

    const latest = Number(history[history.length - 1]);
    return Number.isFinite(latest) ? latest : null;
  }

  function createController(options?: unknown): MCController {
    const config = options && typeof options === "object" ? (options as MCDeps) : {};
    const hasExternalRegistry = Boolean(
      config.providerRegistry && typeof config.providerRegistry.search === "function"
    );
    const providerRegistry =
      hasExternalRegistry
        ? (config.providerRegistry as MCProviderRegistry)
        : MarketProviders && typeof MarketProviders.createRegistry === "function"
          ? (MarketProviders.createRegistry() as MCProviderRegistry)
          : null;

    const listeners: Array<(state: MCControllerState) => void> = [];
    let state = createInitialState();
    let currentListingKey: string | null = null;
    let activeRequestToken = 0;
    let inFlightPromise: Promise<MCControllerState> | null = null;
    const synthesizeQueries =
      typeof config.synthesizeQueries === "function"
        ? config.synthesizeQueries
        : QuerySynthesis && typeof QuerySynthesis.buildQueries === "function"
          ? QuerySynthesis.buildQueries
          : null;
    const candidateFilterFn =
      typeof config.applyCandidateFilters === "function"
        ? config.applyCandidateFilters
        : ProviderFilters && typeof ProviderFilters.applyCandidateFilters === "function"
          ? ProviderFilters.applyCandidateFilters
          : null;
    const rankCandidates =
      typeof config.rankCandidates === "function"
        ? config.rankCandidates
        : MatchScoring && typeof MatchScoring.rankCandidates === "function"
          ? MatchScoring.rankCandidates
          : null;

    if (
      providerRegistry &&
      typeof providerRegistry.register === "function" &&
      config.provider &&
      typeof config.provider.search === "function"
    ) {
      providerRegistry.register(config.provider);
    }

    if (
      !hasExternalRegistry &&
      providerRegistry &&
      typeof providerRegistry.register === "function" &&
      (!config.provider || typeof config.provider.search !== "function") &&
      MarketProviders &&
      typeof MarketProviders.createMockDepopProvider === "function"
    ) {
      providerRegistry.register(MarketProviders.createMockDepopProvider());
    }

    function notify(): void {
      listeners.forEach(function (listener) {
        try {
          listener(getState());
        } catch (_) {
          // Listener failures should not break controller flow.
        }
      });
    }

    function updateState(patch: Partial<MCControllerState>): void {
      state = Object.assign({}, state, patch || {});
      notify();
    }

    function toListingKey(listing: unknown): string | null {
      if (!listing || typeof listing !== "object") {
        return null;
      }

      const typed = listing as MCListing;
      if (typed.id != null) {
        return String(typed.id);
      }

      return normalizeString(typed.title, "") || null;
    }

    function resetForListing(listing: unknown): void {
      const listingKey = toListingKey(listing);
      if (listingKey === currentListingKey) {
        return;
      }

      currentListingKey = listingKey;
      activeRequestToken += 1;
      inFlightPromise = null;
      state = createInitialState();
      state.listingId = listingKey;
      notify();
    }

    function getState(): MCControllerState {
      return {
        status: state.status,
        provider: state.provider,
        listingId: state.listingId,
        lastCheckedAt: state.lastCheckedAt,
        errorCode: state.errorCode,
        retryable: state.retryable,
        cooldownMs: state.cooldownMs,
        message: state.message,
        sourceType: state.sourceType,
        results: state.results.slice()
      };
    }

    function subscribe(listener: (state: MCControllerState) => void): () => void {
      if (typeof listener !== "function") {
        return function () {};
      }

      listeners.push(listener);
      return function () {
        const index = listeners.indexOf(listener);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    }

    function compare(input: unknown): Promise<MCControllerState> {
      const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
      const listing = payload.listing && typeof payload.listing === "object" ? (payload.listing as MCListing) : null;
      resetForListing(listing);

      if (!currentListingKey) {
        const missingContext = toErrorModel("MISSING_LISTING_DATA");
        updateState({
          status: missingContext.status,
          errorCode: missingContext.errorCode,
          retryable: missingContext.retryable,
          cooldownMs: missingContext.cooldownMs,
          message: missingContext.message,
          results: [],
          lastCheckedAt: Date.now()
        });
        return Promise.resolve(getState());
      }

      if (!providerRegistry || typeof providerRegistry.search !== "function") {
        const missingProvider = toErrorModel("NETWORK_ERROR");
        updateState({
          status: missingProvider.status,
          errorCode: missingProvider.errorCode,
          retryable: missingProvider.retryable,
          cooldownMs: missingProvider.cooldownMs,
          message: missingProvider.message,
          results: [],
          lastCheckedAt: Date.now()
        });
        return Promise.resolve(getState());
      }

      if (state.status === "loading" && inFlightPromise) {
        return inFlightPromise;
      }

      const requestToken = activeRequestToken + 1;
      activeRequestToken = requestToken;
      const listingPrice = pickListingPrice(listing);
      const queryResult =
        synthesizeQueries && listing
          ? synthesizeQueries(listing, {
              maxQueries: 4,
              maxTokens: 6
            })
          : {
              ok: true,
              queries: [normalizeString(listing && listing.title, "")]
            };
      const searchModeHint = getSearchModeHint(queryResult && queryResult.reason);

      if (!queryResult || !queryResult.ok || !Array.isArray(queryResult.queries) || !queryResult.queries.length) {
        const queryError = toErrorModel(
          queryResult && queryResult.errorCode ? queryResult.errorCode : "MISSING_LISTING_DATA"
        );
        updateState({
          status: queryError.status,
          errorCode: queryError.errorCode,
          retryable: queryError.retryable,
          cooldownMs: queryError.cooldownMs,
          message: queryError.message,
          results: [],
          lastCheckedAt: Date.now()
        });
        return Promise.resolve(getState());
      }

      updateState({
        status: "loading",
        errorCode: "",
        retryable: false,
        cooldownMs: null,
        message: "Searching Depop...",
        sourceType: "",
        results: []
      });

      inFlightPromise = providerRegistry
        .search("depop", {
          listingId: currentListingKey,
          title: normalizeString(listing && listing.title, ""),
          brand: normalizeString(listing && listing.brand, ""),
          size: normalizeString(listing && listing.size, ""),
          category: normalizeString(listing && listing.category, ""),
          queries: queryResult.queries,
          limit: 12,
          listingPrice: listingPrice,
          currency: normalizeString(payload.currency, "USD")
        })
        .then(function (result) {
          if (requestToken !== activeRequestToken) {
            return getState();
          }

          if (!result.ok) {
            const mappedError = toErrorModel(
              result.errorCode || "NETWORK_ERROR",
              result.retryAfterMs,
              Boolean(result.parserMismatchLikely)
            );
            updateState({
              status: mappedError.status,
              errorCode: mappedError.errorCode,
              retryable: mappedError.retryable,
              cooldownMs: mappedError.cooldownMs,
              message: mappedError.message,
              sourceType: normalizeString(result && result.sourceType, "html"),
              results: [],
              lastCheckedAt: Date.now()
            });
            return getState();
          }

          let filteredCandidates = Array.isArray(result.candidates) ? result.candidates.slice() : [];
          if (candidateFilterFn) {
            filteredCandidates = candidateFilterFn(filteredCandidates, payload.filters || {});
          }

          const pricedCandidates = filteredCandidates.filter(function (candidate) {
            const price = normalizeNumber(candidate && candidate.price);
            return price != null && price > 0;
          });
          if (pricedCandidates.length) {
            filteredCandidates = pricedCandidates;
          }

          if (!Array.isArray(filteredCandidates) || filteredCandidates.length === 0) {
            const noResults = toErrorModel("NO_RESULTS");
            updateState({
              status: noResults.status,
              errorCode: noResults.errorCode,
              retryable: noResults.retryable,
              cooldownMs: noResults.cooldownMs,
              message: searchModeHint ? noResults.message + " " + searchModeHint : noResults.message,
              sourceType: normalizeString(result && result.sourceType, "html"),
              results: [],
              lastCheckedAt: Date.now()
            });
            return getState();
          }

          const selectedCurrency = normalizeString(payload.currency, "USD");
          const ratesByUsd =
            payload && payload.currencyRates && typeof payload.currencyRates === "object"
              ? (payload.currencyRates as Record<string, unknown>)
              : null;
          const strictMinScore = Number.isFinite(Number(payload.minScore)) ? Number(payload.minScore) : 40;

          let rankedCandidates = rankCandidates
            ? rankCandidates(listing, filteredCandidates, {
                listingPriceUsd: listingPrice,
                selectedCurrency: selectedCurrency,
                rate: normalizeNumber(payload.currencyRate),
                ratesByUsd: ratesByUsd,
                minScore: strictMinScore
              })
            : filteredCandidates;

          if (
            rankCandidates &&
            (!Array.isArray(rankedCandidates) || rankedCandidates.length === 0) &&
            Array.isArray(filteredCandidates) &&
            filteredCandidates.length > 0
          ) {
            const depopOnlyCandidates = filteredCandidates.every(function (candidate) {
              return normalizeString(candidate && candidate.market, "depop") === "depop";
            });

            if (depopOnlyCandidates) {
              // Depop can return valid cross-border fallback listings that score
              // below strict similarity thresholds.
              rankedCandidates = rankCandidates(listing, filteredCandidates, {
                listingPriceUsd: listingPrice,
                selectedCurrency: selectedCurrency,
                rate: normalizeNumber(payload.currencyRate),
                ratesByUsd: ratesByUsd,
                minScore: 0
              });
            }
          }

          if (!Array.isArray(rankedCandidates) || rankedCandidates.length === 0) {
            const noRankedResults = toErrorModel("NO_RESULTS");
            updateState({
              status: noRankedResults.status,
              errorCode: noRankedResults.errorCode,
              retryable: noRankedResults.retryable,
              cooldownMs: noRankedResults.cooldownMs,
              message: searchModeHint
                ? noRankedResults.message + " " + searchModeHint
                : noRankedResults.message,
              sourceType: normalizeString(result && result.sourceType, "html"),
              results: [],
              lastCheckedAt: Date.now()
            });
            return getState();
          }

          const normalizedResults = rankedCandidates
            .map(function (candidate) {
              let normalizedPrice = normalizeNumber(candidate && candidate.price);
              if (normalizedPrice != null && normalizedPrice <= 0) {
                normalizedPrice = null;
              }

              let deltaLabel = normalizeString(candidate && candidate.deltaLabel, "");
              if (normalizedPrice == null) {
                deltaLabel = "";
              }

              return {
                id: candidate.id,
                title: candidate.title,
                url: candidate.url,
                imageUrl: normalizeString(candidate.imageUrl, ""),
                price: normalizedPrice,
                currency: normalizeString(candidate.currency, "USD"),
                originalCurrency: normalizeString(candidate.originalCurrency || candidate.currency, "USD"),
                originalPrice: normalizeNumber(candidate.originalPrice),
                score: normalizeNumber(candidate.score),
                usedImage: Boolean(candidate.usedImage),
                imageUnavailableReason: normalizeString(candidate.imageUnavailableReason, ""),
                deltaLabel: deltaLabel || formatDeltaLabel(candidate)
              };
            })
            .filter(function (entry) {
              return normalizeNumber(entry && entry.score) != null && (normalizeNumber(entry && entry.score) as number) > 0;
            })
            .slice(0, 5);

          if (!normalizedResults.length) {
            const noDisplayableResults = toErrorModel("NO_RESULTS");
            updateState({
              status: noDisplayableResults.status,
              errorCode: noDisplayableResults.errorCode,
              retryable: noDisplayableResults.retryable,
              cooldownMs: noDisplayableResults.cooldownMs,
              message: searchModeHint
                ? noDisplayableResults.message + " " + searchModeHint
                : noDisplayableResults.message,
              sourceType: normalizeString(result && result.sourceType, "html"),
              results: [],
              lastCheckedAt: Date.now()
            });
            return getState();
          }

          updateState({
            status: "results",
            errorCode: "",
            retryable: false,
            cooldownMs: null,
            message: searchModeHint,
            sourceType: normalizeString(result && result.sourceType, "html"),
            results: normalizedResults,
            lastCheckedAt: Date.now()
          });

          return getState();
        })
        .catch(function () {
          if (requestToken !== activeRequestToken) {
            return getState();
          }

          const fallbackError = toErrorModel("NETWORK_ERROR");

          updateState({
            status: fallbackError.status,
            errorCode: fallbackError.errorCode,
            retryable: fallbackError.retryable,
            cooldownMs: fallbackError.cooldownMs,
            message: fallbackError.message,
            sourceType: "",
            results: [],
            lastCheckedAt: Date.now()
          });
          return getState();
        })
        .finally(function () {
          if (requestToken === activeRequestToken) {
            inFlightPromise = null;
          }
        });

      return inFlightPromise;
    }

    return {
      getState: getState,
      subscribe: subscribe,
      resetForListing: resetForListing,
      compare: compare
    };
  }

  return {
    createController: createController,
    createInitialState: createInitialState
  };
});
