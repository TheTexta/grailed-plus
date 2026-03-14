(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusMarketProviders = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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

  function normalizeCandidate(candidate, market) {
    var input = candidate && typeof candidate === "object" ? candidate : {};
    var normalizedMarket = normalizeString(input.market, market || "unknown");
    var normalizedCurrency = normalizeString(input.currency, "USD");
    var normalizedId = normalizeString(input.id, null);
    var normalizedTitle = normalizeString(input.title, "Untitled");
    var normalizedUrl = normalizeString(input.url, "");
    var normalizedPrice = normalizeNumber(input.price);

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

  function normalizeProviderResult(result, market) {
    var input = result && typeof result === "object" ? result : {};
    var rawCandidates = Array.isArray(input.candidates) ? input.candidates : [];
    var candidates = rawCandidates
      .map(function (candidate) {
        return normalizeCandidate(candidate, market);
      })
      .filter(Boolean);

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

  function createRegistry() {
    var providersByMarket = Object.create(null);

    function register(provider) {
      if (!provider || typeof provider !== "object") {
        throw new Error("Provider must be an object.");
      }

      var market = normalizeString(provider.market, "");
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

    function get(market) {
      var key = normalizeString(market, "");
      return key ? providersByMarket[key] || null : null;
    }

    function search(market, input) {
      var provider = get(market);
      if (!provider) {
        return Promise.resolve({
          ok: false,
          candidates: [],
          fetchedAt: Date.now(),
          partial: false,
          sourceType: "mock",
          errorCode: "PROVIDER_NOT_FOUND"
        });
      }

      return Promise.resolve(provider.search(input)).then(function (result) {
        return normalizeProviderResult(result, provider.market);
      });
    }

    function listMarkets() {
      return Object.keys(providersByMarket);
    }

    return {
      register: register,
      get: get,
      search: search,
      listMarkets: listMarkets
    };
  }

  function createMockDepopProvider() {
    return {
      market: "depop",
      search: function (input) {
        var payload = input && typeof input === "object" ? input : {};
        var title = normalizeString(payload.title, "");
        var listingPrice = normalizeNumber(payload.listingPrice);

        if (!title) {
          return {
            ok: true,
            candidates: [],
            fetchedAt: Date.now(),
            partial: false,
            sourceType: "mock"
          };
        }

        var basePrice = listingPrice == null ? 120 : listingPrice;
        var candidateOnePrice = Math.max(1, basePrice * 0.88);
        var candidateTwoPrice = Math.max(1, basePrice * 1.07);

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
              currency: normalizeString(payload.currency, "USD"),
              score: 78,
              deltaAbsolute: candidateOnePrice - basePrice,
              deltaPercent: ((candidateOnePrice - basePrice) / basePrice) * 100
            },
            {
              market: "depop",
              id: "mock-depop-2",
              title: title + " (alt)",
              url: "https://www.depop.com/search/?q=" + encodeURIComponent(title + " used"),
              imageUrl: "",
              price: candidateTwoPrice,
              currency: normalizeString(payload.currency, "USD"),
              score: 64,
              deltaAbsolute: candidateTwoPrice - basePrice,
              deltaPercent: ((candidateTwoPrice - basePrice) / basePrice) * 100
            }
          ],
          fetchedAt: Date.now(),
          partial: false,
          sourceType: "mock"
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
});
