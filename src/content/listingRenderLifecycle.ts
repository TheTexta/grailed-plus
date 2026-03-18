interface CListingRenderState {
  renderToken: number;
  retryStartedAtMs: number | null;
}

interface CListingRenderUrlApi {
  isListingPath: (pathname: string) => boolean;
}

interface CListingRenderCurrencyContext {
  selectedCurrency: string;
  rate: number | null;
  mode: string;
}

interface CListingRenderMountTarget {
  mountNode: Node | null;
  mountPosition?: "beforebegin" | "afterend";
}

interface CListingRenderOptions {
  state: CListingRenderState;
  urlApi: CListingRenderUrlApi;
  locationObj?: Location | { pathname?: string } | null;
  renderToken: number;
  listing: any;
  metrics: any;
  mountTarget?: CListingRenderMountTarget | null;
  marketCompareEnabled?: boolean;
  marketCompareAutoSearchEnabled?: boolean;
  marketCompareRankingFormula?: string;
  marketCompareStrictMode?: boolean;
  marketCompareResultsLimit?: number;
  marketCompareMlSimilarityEnabled?: boolean;
  marketCompareDebugEnabled?: boolean;
  showMetadataButton?: boolean;
  resolveCurrencyContext?: () => Promise<CListingRenderCurrencyContext | null>;
  createUsdCurrencyContext?: () => CListingRenderCurrencyContext;
  renderPanelWithMarketCompare?: (options: {
    listing: any;
    metrics: any;
    mountNode: Node | null;
    mountPosition: "beforebegin" | "afterend";
    rawListing: any;
    currencyContext: CListingRenderCurrencyContext | null;
    marketCompareEnabled: boolean;
    marketCompareAutoSearchEnabled: boolean;
    marketCompareRankingFormula: string;
    marketCompareStrictMode: boolean;
    marketCompareResultsLimit: number;
    marketCompareMlSimilarityEnabled: boolean;
    marketCompareDebugEnabled: boolean;
    showMetadataButton: boolean;
  }) => void;
  applySidebarCurrency?: (currencyContext: CListingRenderCurrencyContext | null) => void;
  applyCardCurrency?: (currencyContext: CListingRenderCurrencyContext | null) => void;
  syncCardCurrencyObserver?: (currencyContext: CListingRenderCurrencyContext | null) => void;
  disconnectHydrationObserver?: () => void;
  log?: (message: string, details?: Record<string, unknown>) => void;
  reason?: string;
  attempt?: number;
}

interface CListingRenderLifecycleModule {
  renderListingWithCurrency: (options: CListingRenderOptions | null | undefined) => void;
}

interface CListingRenderGlobal {
  GrailedPlusListingRenderLifecycle?: CListingRenderLifecycleModule;
}

(function (root: CListingRenderGlobal, factory: () => CListingRenderLifecycleModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusListingRenderLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as CListingRenderGlobal) : {}, function () {
  "use strict";

  function renderListingWithCurrency(options: CListingRenderOptions | null | undefined): void {
    var config = options && typeof options === "object" ? options : ({} as CListingRenderOptions);
    var state = config.state;
    var urlApi = config.urlApi;
    var locationObj = config.locationObj;
    var renderToken = Number(config.renderToken);
    var listing = config.listing;
    var metrics = config.metrics;
    var mountTarget =
      config.mountTarget && typeof config.mountTarget === "object" ? config.mountTarget : null;
    var resolveCurrencyContext =
      typeof config.resolveCurrencyContext === "function"
        ? config.resolveCurrencyContext
        : function () {
            return Promise.resolve(null);
          };
    var createUsdCurrencyContext =
      typeof config.createUsdCurrencyContext === "function"
        ? config.createUsdCurrencyContext
        : function () {
            return { selectedCurrency: "USD", rate: null, mode: "dual" };
          };
    var renderPanelWithMarketCompare =
      typeof config.renderPanelWithMarketCompare === "function"
        ? config.renderPanelWithMarketCompare
        : function () {};
    var applySidebarCurrency =
      typeof config.applySidebarCurrency === "function" ? config.applySidebarCurrency : function () {};
    var applyCardCurrency =
      typeof config.applyCardCurrency === "function" ? config.applyCardCurrency : function () {};
    var syncCardCurrencyObserver =
      typeof config.syncCardCurrencyObserver === "function"
        ? config.syncCardCurrencyObserver
        : function () {};
    var disconnectHydrationObserver =
      typeof config.disconnectHydrationObserver === "function"
        ? config.disconnectHydrationObserver
        : function () {};
    var log = typeof config.log === "function" ? config.log : function () {};
    var reason = typeof config.reason === "string" ? config.reason : "";
    var attempt = Number.isFinite(Number(config.attempt)) ? Number(config.attempt) : 0;

    if (!state || typeof state !== "object") {
      return;
    }

    resolveCurrencyContext()
      .then(function (currencyContext) {
        var pathname = locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
        if (renderToken !== state.renderToken || !urlApi.isListingPath(pathname)) {
          return;
        }

        renderPanelWithMarketCompare({
          listing: listing,
          metrics: metrics,
          mountNode: mountTarget ? mountTarget.mountNode : null,
          mountPosition: mountTarget ? mountTarget.mountPosition || "afterend" : "afterend",
          rawListing: listing && listing.rawListing ? listing.rawListing : null,
          currencyContext: currencyContext,
          marketCompareEnabled: config.marketCompareEnabled !== false,
          marketCompareAutoSearchEnabled: config.marketCompareAutoSearchEnabled === true,
          marketCompareRankingFormula:
            typeof config.marketCompareRankingFormula === "string"
              ? config.marketCompareRankingFormula
              : "visual",
          marketCompareStrictMode: config.marketCompareStrictMode === true,
          marketCompareResultsLimit:
            Number.isFinite(Number(config.marketCompareResultsLimit)) &&
            Number(config.marketCompareResultsLimit) > 0
              ? Math.floor(Number(config.marketCompareResultsLimit))
              : 5,
          marketCompareMlSimilarityEnabled: config.marketCompareMlSimilarityEnabled !== false,
          marketCompareDebugEnabled: config.marketCompareDebugEnabled === true,
          showMetadataButton: config.showMetadataButton !== false
        });
        applySidebarCurrency(currencyContext);
        applyCardCurrency(currencyContext);
        syncCardCurrencyObserver(currencyContext);

        disconnectHydrationObserver();
        state.retryStartedAtMs = null;

        log("rendered", {
          reason: reason,
          attempt: attempt,
          listingId: listing && listing.id,
          currency: currencyContext && currencyContext.selectedCurrency
        });
      })
      .catch(function () {
        var pathname = locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
        if (renderToken !== state.renderToken || !urlApi.isListingPath(pathname)) {
          return;
        }

        var fallbackCurrency = createUsdCurrencyContext();
        renderPanelWithMarketCompare({
          listing: listing,
          metrics: metrics,
          mountNode: mountTarget ? mountTarget.mountNode : null,
          mountPosition: mountTarget ? mountTarget.mountPosition || "afterend" : "afterend",
          rawListing: listing && listing.rawListing ? listing.rawListing : null,
          currencyContext: fallbackCurrency,
          marketCompareEnabled: config.marketCompareEnabled !== false,
          marketCompareAutoSearchEnabled: config.marketCompareAutoSearchEnabled === true,
          marketCompareRankingFormula:
            typeof config.marketCompareRankingFormula === "string"
              ? config.marketCompareRankingFormula
              : "visual",
          marketCompareStrictMode: config.marketCompareStrictMode === true,
          marketCompareResultsLimit:
            Number.isFinite(Number(config.marketCompareResultsLimit)) &&
            Number(config.marketCompareResultsLimit) > 0
              ? Math.floor(Number(config.marketCompareResultsLimit))
              : 5,
          marketCompareMlSimilarityEnabled: config.marketCompareMlSimilarityEnabled !== false,
          marketCompareDebugEnabled: config.marketCompareDebugEnabled === true,
          showMetadataButton: config.showMetadataButton !== false
        });
        applySidebarCurrency(fallbackCurrency);
        applyCardCurrency(fallbackCurrency);
        syncCardCurrencyObserver(fallbackCurrency);

        disconnectHydrationObserver();
        state.retryStartedAtMs = null;

        log("rendered_with_currency_fallback", {
          reason: reason,
          attempt: attempt,
          listingId: listing && listing.id
        });
      });
  }

  return {
    renderListingWithCurrency: renderListingWithCurrency
  };
});
