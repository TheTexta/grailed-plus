(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusListingRenderLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function renderListingWithCurrency(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var urlApi = config.urlApi;
    var locationObj = config.locationObj;
    var renderToken = Number(config.renderToken);
    var listing = config.listing;
    var metrics = config.metrics;
    var mountTarget = config.mountTarget && typeof config.mountTarget === "object" ? config.mountTarget : null;
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
          mountPosition: mountTarget ? mountTarget.mountPosition : "afterend",
          rawListing: listing && listing.rawListing ? listing.rawListing : null,
          currencyContext: currencyContext
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
          mountPosition: mountTarget ? mountTarget.mountPosition : "afterend",
          rawListing: listing && listing.rawListing ? listing.rawListing : null,
          currencyContext: fallbackCurrency
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
