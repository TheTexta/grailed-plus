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
  rawListing?: Record<string, unknown> | null;
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
  GrailedPlusNormalize?: {
    normalizeTrimmedString?: (value: unknown, fallback: string) => string;
  };
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
  let Normalize: MCGlobalRoot["GrailedPlusNormalize"] | null = null;
  let QuerySynthesis: MCGlobalRoot["GrailedPlusQuerySynthesis"] | null = null;
  let ProviderFilters: MCGlobalRoot["GrailedPlusProviderFilters"] | null = null;
  let MatchScoring: MCGlobalRoot["GrailedPlusMatchScoring"] | null = null;
  if (typeof globalThis !== "undefined" && (globalThis as unknown as MCGlobalRoot).GrailedPlusNormalize) {
    Normalize = (globalThis as unknown as MCGlobalRoot).GrailedPlusNormalize || null;
  }
  if (!Normalize && typeof require === "function") {
    try {
      Normalize = require("./normalize");
    } catch (_) {
      Normalize = null;
    }
  }
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

  function roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  function formatDeltaLabel(candidate: { deltaPercent?: unknown } | null | undefined): string {
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

  function normalizeCurrencyCode(value: unknown, fallback: string): string {
    const upper = normalizeString(value, "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(upper)) {
      return fallback;
    }
    return upper;
  }

  function getRateForCurrency(
    currencyCode: string,
    ratesByUsd: Record<string, unknown> | null | undefined
  ): number | null {
    if (!ratesByUsd || typeof ratesByUsd !== "object") {
      return null;
    }

    if (currencyCode === "USD") {
      return 1;
    }

    const value = normalizeNumber(ratesByUsd[currencyCode]);
    return value != null && value > 0 ? value : null;
  }

  function convertBetweenCurrencies(
    amount: unknown,
    fromCurrency: unknown,
    toCurrency: unknown,
    ratesByUsd: Record<string, unknown> | null | undefined
  ): number | null {
    const amountValue = normalizeNumber(amount);
    if (amountValue == null) {
      return null;
    }

    const from = normalizeCurrencyCode(fromCurrency, "USD");
    const to = normalizeCurrencyCode(toCurrency, "USD");

    if (from === to) {
      return amountValue;
    }

    const fromRate = getRateForCurrency(from, ratesByUsd);
    const toRate = getRateForCurrency(to, ratesByUsd);
    if (fromRate == null || toRate == null || fromRate <= 0 || toRate <= 0) {
      return null;
    }

    const amountUsd = from === "USD" ? amountValue : amountValue / fromRate;
    if (!Number.isFinite(amountUsd)) {
      return null;
    }

    return to === "USD" ? amountUsd : amountUsd * toRate;
  }

  function convertUsdPrice(amountUsd: unknown, selectedCurrency: unknown, rate: unknown): number | null {
    const amount = normalizeNumber(amountUsd);
    if (amount == null) {
      return null;
    }

    const currency = normalizeCurrencyCode(selectedCurrency, "USD");
    if (currency === "USD") {
      return amount;
    }

    const normalizedRate = normalizeNumber(rate);
    if (normalizedRate == null || normalizedRate <= 0) {
      return amount;
    }

    return amount * normalizedRate;
  }

  function convertComparablePrice(
    amount: unknown,
    fromCurrency: unknown,
    selectedCurrency: unknown,
    rate: unknown,
    ratesByUsd: Record<string, unknown> | null | undefined
  ): number | null {
    const comparable = convertBetweenCurrencies(amount, fromCurrency, selectedCurrency, ratesByUsd);
    if (comparable != null) {
      return comparable;
    }

    const from = normalizeCurrencyCode(fromCurrency, "USD");
    if (from !== "USD") {
      return null;
    }

    return convertUsdPrice(amount, selectedCurrency, rate);
  }

  function computeDisplayedDeltaPercent(
    candidate: MCCandidate,
    payload: Record<string, unknown>,
    listingPrice: number | null
  ): number | null {
    const candidatePrice = normalizeNumber(candidate && candidate.price);
    if (candidatePrice == null) {
      return null;
    }

    const selectedCurrency = normalizeCurrencyCode(payload && payload.currency, "USD");
    const candidateCurrency = normalizeCurrencyCode(
      candidate && (candidate.currency || candidate.originalCurrency),
      selectedCurrency
    );
    const rate = normalizeNumber(payload && payload.currencyRate);
    const ratesByUsd =
      payload && payload.currencyRates && typeof payload.currencyRates === "object"
        ? (payload.currencyRates as Record<string, unknown>)
        : null;
    const listingComparable = convertComparablePrice(
      listingPrice,
      "USD",
      candidateCurrency,
      candidateCurrency === selectedCurrency ? rate : null,
      ratesByUsd
    );

    if (listingComparable == null || listingComparable <= 0) {
      return null;
    }

    return ((candidatePrice - listingComparable) / listingComparable) * 100;
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

  function getNestedValue(input: unknown, paths: string[][]): unknown {
    for (let i = 0; i < paths.length; i += 1) {
      let cursor = input;
      const path = paths[i];
      for (let j = 0; j < path.length; j += 1) {
        if (!cursor || typeof cursor !== "object") {
          cursor = null;
          break;
        }

        cursor = (cursor as Record<string, unknown>)[path[j]];
      }

      if (cursor != null) {
        return cursor;
      }
    }

    return null;
  }

  function pickRawListingPrice(rawListing: unknown): number | null {
    const amount = normalizeNumber(
      getNestedValue(rawListing, [
        ["price"],
        ["priceAmount"],
        ["price_amount"],
        ["priceUsd"],
        ["price_usd"],
        ["price", "amount"],
        ["price", "value"],
        ["price", "usd"],
        ["price", "current"],
        ["price", "amountUsd"],
        ["price", "amount_usd"]
      ])
    );
    if (amount != null && amount > 0) {
      return amount;
    }

    const cents = normalizeNumber(
      getNestedValue(rawListing, [
        ["priceCents"],
        ["price_cents"],
        ["price", "amountCents"],
        ["price", "amount_cents"],
        ["amountCents"],
        ["amount_cents"]
      ])
    );
    if (cents != null && cents > 0) {
      return cents / 100;
    }

    return null;
  }

  function pickListingPrice(listing: unknown): number | null {
    const history =
      listing && typeof listing === "object" && (listing as MCListing).pricing && Array.isArray((listing as MCListing).pricing?.history)
        ? ((listing as MCListing).pricing?.history as unknown[])
        : [];

    if (!history.length) {
      return pickRawListingPrice(listing && typeof listing === "object" ? (listing as MCListing).rawListing : null);
    }

    const latest = Number(history[history.length - 1]);
    if (Number.isFinite(latest) && latest > 0) {
      return latest;
    }

    return pickRawListingPrice(listing && typeof listing === "object" ? (listing as MCListing).rawListing : null);
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

    function finishWithError(
      errorCode: unknown,
      options?: {
        retryAfterMs?: unknown;
        parserMismatchLikely?: unknown;
        sourceType?: unknown;
        messageSuffix?: string;
      }
    ): MCControllerState {
      const mappedError = toErrorModel(
        errorCode,
        options && options.retryAfterMs,
        options && options.parserMismatchLikely
      );
      const messageSuffix = normalizeString(options && options.messageSuffix, "");

      updateState({
        status: mappedError.status,
        errorCode: mappedError.errorCode,
        retryable: mappedError.retryable,
        cooldownMs: mappedError.cooldownMs,
        message: messageSuffix ? mappedError.message + " " + messageSuffix : mappedError.message,
        sourceType: normalizeString(options && options.sourceType, ""),
        results: [],
        lastCheckedAt: Date.now()
      });

      return getState();
    }

    function buildQueryResult(
      listing: MCListing | null,
      payload?: Record<string, unknown>
    ): MCQueryResult {
      if (synthesizeQueries && listing) {
        return synthesizeQueries(listing, {
          maxQueries: 4,
          maxTokens: 6,
          allowCategoryFallback: payload && payload.allowCategoryFallback === false ? false : true
        });
      }

      return {
        ok: true,
        queries: [normalizeString(listing && listing.title, "")]
      };
    }

    function buildSearchPayload(
      payload: Record<string, unknown>,
      listing: MCListing | null,
      listingPrice: number | null,
      queries: string[]
    ): Record<string, unknown> {
      const resultLimit =
        Number.isFinite(Number(payload.limit)) && Number(payload.limit) > 0
          ? Math.floor(Number(payload.limit))
          : null;

      return {
        listingId: currentListingKey,
        title: normalizeString(listing && listing.title, ""),
        brand: normalizeString(listing && listing.brand, ""),
        size: normalizeString(listing && listing.size, ""),
        category: normalizeString(listing && listing.category, ""),
        queries: queries,
        listingPrice: listingPrice,
        currency: normalizeString(payload.currency, "USD"),
        limit: resultLimit
      };
    }

    function filterCandidates(
      result: MCProviderResult,
      payload: Record<string, unknown>
    ): MCCandidate[] {
      let filteredCandidates = Array.isArray(result.candidates) ? result.candidates.slice() : [];
      if (candidateFilterFn) {
        filteredCandidates = candidateFilterFn(filteredCandidates, payload.filters || {});
      }

      const pricedCandidates = filteredCandidates.filter(function (candidate) {
        const price = normalizeNumber(candidate && candidate.price);
        return price != null && price > 0;
      });

      return pricedCandidates.length ? pricedCandidates : filteredCandidates;
    }

    function buildRankingOptions(
      payload: Record<string, unknown>,
      listingPrice: number | null,
      minScore: number
    ): {
      listingPriceUsd: number | null;
      selectedCurrency: string;
      rate: number | null;
      ratesByUsd: Record<string, unknown> | null;
      minScore: number;
      rankingFormula: string;
    } {
      const ratesByUsd =
        payload && payload.currencyRates && typeof payload.currencyRates === "object"
          ? (payload.currencyRates as Record<string, unknown>)
          : null;

      return {
        listingPriceUsd: listingPrice,
        selectedCurrency: normalizeString(payload.currency, "USD"),
        rate: normalizeNumber(payload.currencyRate),
        ratesByUsd: ratesByUsd,
        minScore: minScore,
        rankingFormula: normalizeString(payload.rankingFormula, "balanced")
      };
    }

    function rankFilteredCandidates(
      listing: MCListing | null,
      payload: Record<string, unknown>,
      filteredCandidates: MCCandidate[],
      listingPrice: number | null
    ): MCCandidate[] {
      if (!rankCandidates) {
        return filteredCandidates;
      }

      const strictMinScore = Number.isFinite(Number(payload.minScore)) ? Number(payload.minScore) : 0;
      const strictRankingOptions = buildRankingOptions(payload, listingPrice, strictMinScore);
      let rankedCandidates = rankCandidates(listing, filteredCandidates, strictRankingOptions);

      if ((!Array.isArray(rankedCandidates) || rankedCandidates.length === 0) && filteredCandidates.length > 0) {
        const depopOnlyCandidates = filteredCandidates.every(function (candidate) {
          return normalizeString(candidate && candidate.market, "depop") === "depop";
        });

        if (depopOnlyCandidates) {
          // Depop can return valid cross-border fallback listings that score
          // below strict similarity thresholds.
          rankedCandidates = rankCandidates(
            listing,
            filteredCandidates,
            buildRankingOptions(payload, listingPrice, 0)
          );
        }
      }

      return Array.isArray(rankedCandidates) ? rankedCandidates : [];
    }

    function toDisplayResults(
      candidates: MCCandidate[],
      payload: Record<string, unknown>,
      listingPrice: number | null
    ): MCControllerStateResult[] {
      return (Array.isArray(candidates) ? candidates : [])
        .map(function (candidate) {
          let normalizedPrice = normalizeNumber(candidate && candidate.price);
          if (normalizedPrice != null && normalizedPrice <= 0) {
            normalizedPrice = null;
          }

          let deltaLabel = normalizeString(candidate && candidate.deltaLabel, "");
          let deltaPercent = normalizeNumber(candidate && candidate.deltaPercent);
          const fallbackDeltaPercent = computeDisplayedDeltaPercent(candidate, payload, listingPrice);

          if (
            fallbackDeltaPercent != null &&
            (
              deltaPercent == null ||
              Math.abs(deltaPercent) < 0.05 ||
              deltaLabel.toLowerCase() === "same price"
            ) &&
            Math.abs(fallbackDeltaPercent) >= 0.05
          ) {
            deltaPercent = fallbackDeltaPercent;
          }

          if (normalizedPrice == null) {
            deltaLabel = "";
          } else if (deltaPercent != null) {
            deltaLabel = formatDeltaLabel({
              deltaPercent: deltaPercent
            });
          } else if (deltaLabel.toLowerCase() === "same price") {
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
          const score = normalizeNumber(entry && entry.score);
          return score != null && score >= 0;
        });
    }

    function handleProviderSuccess(
      result: MCProviderResult,
      payload: Record<string, unknown>,
      listing: MCListing | null,
      listingPrice: number | null,
      searchModeHint: string
    ): MCControllerState {
      const sourceType = normalizeString(result && result.sourceType, "html");
      const filteredCandidates = filterCandidates(result, payload);

      if (!filteredCandidates.length) {
        return finishWithError("NO_RESULTS", {
          sourceType: sourceType,
          messageSuffix: searchModeHint
        });
      }

      const rankedCandidates = rankFilteredCandidates(listing, payload, filteredCandidates, listingPrice);
      if (!rankedCandidates.length) {
        return finishWithError("NO_RESULTS", {
          sourceType: sourceType,
          messageSuffix: searchModeHint
        });
      }

      const normalizedResults = toDisplayResults(rankedCandidates, payload, listingPrice);
      if (!normalizedResults.length) {
        return finishWithError("NO_RESULTS", {
          sourceType: sourceType,
          messageSuffix: searchModeHint
        });
      }

      updateState({
        status: "results",
        errorCode: "",
        retryable: false,
        cooldownMs: null,
        message: searchModeHint,
        sourceType: sourceType,
        results: normalizedResults,
        lastCheckedAt: Date.now()
      });

      return getState();
    }

    function compare(input: unknown): Promise<MCControllerState> {
      const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
      const listing = payload.listing && typeof payload.listing === "object" ? (payload.listing as MCListing) : null;
      resetForListing(listing);

      if (!currentListingKey) {
        return Promise.resolve(finishWithError("MISSING_LISTING_DATA"));
      }

      if (!providerRegistry || typeof providerRegistry.search !== "function") {
        return Promise.resolve(finishWithError("NETWORK_ERROR"));
      }

      if (state.status === "loading" && inFlightPromise) {
        return inFlightPromise;
      }

      const requestToken = activeRequestToken + 1;
      activeRequestToken = requestToken;
      const listingPrice = pickListingPrice(listing);
      const queryResult = buildQueryResult(listing, payload);
      const searchModeHint = getSearchModeHint(queryResult && queryResult.reason);

      if (!queryResult || !queryResult.ok || !Array.isArray(queryResult.queries) || !queryResult.queries.length) {
        return Promise.resolve(
          finishWithError(queryResult && queryResult.errorCode ? queryResult.errorCode : "MISSING_LISTING_DATA")
        );
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
        .search("depop", buildSearchPayload(payload, listing, listingPrice, queryResult.queries))
        .then(function (result) {
          if (requestToken !== activeRequestToken) {
            return getState();
          }

          if (!result.ok) {
            return finishWithError(result.errorCode || "NETWORK_ERROR", {
              retryAfterMs: result.retryAfterMs,
              parserMismatchLikely: Boolean(result.parserMismatchLikely),
              sourceType: normalizeString(result && result.sourceType, "html")
            });
          }

          return handleProviderSuccess(result, payload, listing, listingPrice, searchModeHint);
        })
        .catch(function () {
          if (requestToken !== activeRequestToken) {
            return getState();
          }

          return finishWithError("NETWORK_ERROR");
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
