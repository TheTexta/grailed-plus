(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusMarketCompareController = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MarketProviders = null;
  var QuerySynthesis = null;
  var ProviderFilters = null;
  var MatchScoring = null;
  if (typeof globalThis !== "undefined" && globalThis.GrailedPlusMarketProviders) {
    MarketProviders = globalThis.GrailedPlusMarketProviders;
  }
  if (!MarketProviders && typeof require === "function") {
    try {
      MarketProviders = require("./marketProviders.js");
    } catch (_) {
      MarketProviders = null;
    }
  }
  if (typeof globalThis !== "undefined" && globalThis.GrailedPlusQuerySynthesis) {
    QuerySynthesis = globalThis.GrailedPlusQuerySynthesis;
  }
  if (!QuerySynthesis && typeof require === "function") {
    try {
      QuerySynthesis = require("./querySynthesis.js");
    } catch (_) {
      QuerySynthesis = null;
    }
  }
  if (typeof globalThis !== "undefined" && globalThis.GrailedPlusProviderFilters) {
    ProviderFilters = globalThis.GrailedPlusProviderFilters;
  }
  if (!ProviderFilters && typeof require === "function") {
    try {
      ProviderFilters = require("./providerFilters.js");
    } catch (_) {
      ProviderFilters = null;
    }
  }
  if (typeof globalThis !== "undefined" && globalThis.GrailedPlusMatchScoring) {
    MatchScoring = globalThis.GrailedPlusMatchScoring;
  }
  if (!MatchScoring && typeof require === "function") {
    try {
      MatchScoring = require("./matchScoring.js");
    } catch (_) {
      MatchScoring = null;
    }
  }

  function normalizeString(value, fallback) {
    if (typeof value === "string") {
      var trimmed = value.trim();
      return trimmed || fallback;
    }
    return fallback;
  }

  function normalizeNumber(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function roundTo(value, decimals) {
    var factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  function formatDeltaLabel(candidate) {
    var deltaPercent = normalizeNumber(candidate && candidate.deltaPercent);
    if (deltaPercent == null) {
      return "";
    }

    var rounded = roundTo(Math.abs(deltaPercent), 1);
    if (deltaPercent < 0) {
      return "-" + String(rounded) + "% cheaper";
    }

    if (deltaPercent > 0) {
      return "+" + String(rounded) + "% higher";
    }

    return "same price";
  }

  function createInitialState() {
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

  function getSearchModeHint(queryReason) {
    if (queryReason === "category_fallback") {
      return "Using broad search due to unknown category mapping.";
    }
    return "";
  }

  function toErrorModel(errorCode, retryAfterMs, parserMismatchLikely) {
    var code = normalizeString(errorCode, "NETWORK_ERROR");
    var retryMs = normalizeNumber(retryAfterMs);

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

  function pickListingPrice(listing) {
    var history =
      listing && listing.pricing && Array.isArray(listing.pricing.history)
        ? listing.pricing.history
        : [];

    if (!history.length) {
      return null;
    }

    var latest = Number(history[history.length - 1]);
    return Number.isFinite(latest) ? latest : null;
  }

  function createController(options) {
    var config = options && typeof options === "object" ? options : {};
    var hasExternalRegistry = Boolean(
      config.providerRegistry && typeof config.providerRegistry.search === "function"
    );
    var providerRegistry =
      hasExternalRegistry
        ? config.providerRegistry
        : MarketProviders && typeof MarketProviders.createRegistry === "function"
        ? MarketProviders.createRegistry()
        : null;

    var listeners = [];
    var state = createInitialState();
    var currentListingKey = null;
    var activeRequestToken = 0;
    var inFlightPromise = null;
    var synthesizeQueries =
      typeof config.synthesizeQueries === "function"
        ? config.synthesizeQueries
        : QuerySynthesis && typeof QuerySynthesis.buildQueries === "function"
        ? QuerySynthesis.buildQueries
        : null;
    var candidateFilterFn =
      typeof config.applyCandidateFilters === "function"
        ? config.applyCandidateFilters
        : ProviderFilters && typeof ProviderFilters.applyCandidateFilters === "function"
        ? ProviderFilters.applyCandidateFilters
        : null;
    var rankCandidates =
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

    function notify() {
      listeners.forEach(function (listener) {
        try {
          listener(getState());
        } catch (_) {
          // Listener failures should not break controller flow.
        }
      });
    }

    function updateState(patch) {
      state = Object.assign({}, state, patch || {});
      notify();
    }

    function toListingKey(listing) {
      if (!listing || typeof listing !== "object") {
        return null;
      }

      if (listing.id != null) {
        return String(listing.id);
      }

      return normalizeString(listing.title, "") || null;
    }

    function resetForListing(listing) {
      var listingKey = toListingKey(listing);
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

    function getState() {
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

    function subscribe(listener) {
      if (typeof listener !== "function") {
        return function () {};
      }

      listeners.push(listener);
      return function () {
        var index = listeners.indexOf(listener);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    }

    function compare(input) {
      var payload = input && typeof input === "object" ? input : {};
      var listing = payload.listing && typeof payload.listing === "object" ? payload.listing : null;
      resetForListing(listing);

      if (!currentListingKey) {
        var missingContext = toErrorModel("MISSING_LISTING_DATA");
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
        var missingProvider = toErrorModel("NETWORK_ERROR");
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

      var requestToken = activeRequestToken + 1;
      activeRequestToken = requestToken;
      var listingPrice = pickListingPrice(listing);
      var queryResult =
        synthesizeQueries && listing
          ? synthesizeQueries(listing, {
              maxQueries: 4,
              maxTokens: 6
            })
          : {
              ok: true,
              queries: [normalizeString(listing && listing.title, "")]
            };
          var searchModeHint = getSearchModeHint(queryResult && queryResult.reason);

      if (!queryResult || !queryResult.ok || !Array.isArray(queryResult.queries) || !queryResult.queries.length) {
        var queryError = toErrorModel(
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
            var mappedError = toErrorModel(
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

          var filteredCandidates = Array.isArray(result.candidates) ? result.candidates.slice() : [];
          if (candidateFilterFn) {
            filteredCandidates = candidateFilterFn(filteredCandidates, payload.filters || {});
          }

          var pricedCandidates = filteredCandidates.filter(function (candidate) {
            var price = normalizeNumber(candidate && candidate.price);
            return price != null && price > 0;
          });
          if (pricedCandidates.length) {
            filteredCandidates = pricedCandidates;
          }

          if (!Array.isArray(filteredCandidates) || filteredCandidates.length === 0) {
            var noResults = toErrorModel("NO_RESULTS");
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

          var selectedCurrency = normalizeString(payload.currency, "USD");
          var ratesByUsd =
            payload && payload.currencyRates && typeof payload.currencyRates === "object"
              ? payload.currencyRates
              : null;
          var strictMinScore = Number.isFinite(Number(payload.minScore)) ? Number(payload.minScore) : 40;

          var rankedCandidates = rankCandidates
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
            var depopOnlyCandidates = filteredCandidates.every(function (candidate) {
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
            var noRankedResults = toErrorModel("NO_RESULTS");
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

          var normalizedResults = rankedCandidates.map(function (candidate) {
            var normalizedPrice = normalizeNumber(candidate && candidate.price);
            if (normalizedPrice != null && normalizedPrice <= 0) {
              normalizedPrice = null;
            }

            var deltaLabel = normalizeString(candidate && candidate.deltaLabel, "");
            if (normalizedPrice == null) {
              deltaLabel = "";
            }

            return {
              id: candidate.id,
              title: candidate.title,
              url: candidate.url,
              imageUrl: candidate.imageUrl || "",
              price: normalizedPrice,
              currency: candidate.currency || "USD",
              originalCurrency: candidate.originalCurrency || candidate.currency || "USD",
              originalPrice: normalizeNumber(candidate.originalPrice),
              score: normalizeNumber(candidate.score),
              usedImage: Boolean(candidate.usedImage),
              imageUnavailableReason: normalizeString(candidate.imageUnavailableReason, ""),
              deltaLabel: deltaLabel || formatDeltaLabel(candidate)
            };
          }).filter(function (entry) {
            return normalizeNumber(entry && entry.score) > 0;
          }).slice(0, 5);

          if (!normalizedResults.length) {
            var noDisplayableResults = toErrorModel("NO_RESULTS");
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

          var fallbackError = toErrorModel("NETWORK_ERROR");

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
