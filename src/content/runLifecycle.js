(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusRunLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function handleNonListingRoute(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var urlApi = config.urlApi;
    var locationObj = config.locationObj;
    var documentObj = config.documentObj;
    var clearRetryTimer =
      typeof config.clearRetryTimer === "function" ? config.clearRetryTimer : function () {};
    var disconnectHydrationObserver =
      typeof config.disconnectHydrationObserver === "function"
        ? config.disconnectHydrationObserver
        : function () {};
    var insightsPanel = config.insightsPanel;
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
    var applyCardCurrency =
      typeof config.applyCardCurrency === "function" ? config.applyCardCurrency : function () {};
    var syncCardCurrencyObserver =
      typeof config.syncCardCurrencyObserver === "function"
        ? config.syncCardCurrencyObserver
        : function () {};

    if (!state || typeof state !== "object") {
      return false;
    }

    var pathname = locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
    if (!urlApi || typeof urlApi.isListingPath !== "function" || urlApi.isListingPath(pathname)) {
      return false;
    }

    var nonListingToken = state.renderToken + 1;
    state.renderToken = nonListingToken;
    clearRetryTimer(true);
    disconnectHydrationObserver();

    if (insightsPanel && typeof insightsPanel.removeExistingPanels === "function") {
      insightsPanel.removeExistingPanels(documentObj);
    }
    state.latestPanelContext = null;

    resolveCurrencyContext()
      .then(function (currencyContext) {
        var latestPathname =
          locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
        if (nonListingToken !== state.renderToken || urlApi.isListingPath(latestPathname)) {
          return;
        }

        applyCardCurrency(currencyContext);
        syncCardCurrencyObserver(currencyContext);
      })
      .catch(function () {
        var latestPathname =
          locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
        if (nonListingToken !== state.renderToken || urlApi.isListingPath(latestPathname)) {
          return;
        }

        var fallbackCurrency = createUsdCurrencyContext();
        applyCardCurrency(fallbackCurrency);
        syncCardCurrencyObserver(fallbackCurrency);
      });

    return true;
  }

  function handleListingInsightsDisabled(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var listingInsightsEnabled = Boolean(config.listingInsightsEnabled);
    var urlApi = config.urlApi;
    var locationObj = config.locationObj;
    var documentObj = config.documentObj;
    var clearRetryTimer =
      typeof config.clearRetryTimer === "function" ? config.clearRetryTimer : function () {};
    var disconnectHydrationObserver =
      typeof config.disconnectHydrationObserver === "function"
        ? config.disconnectHydrationObserver
        : function () {};
    var insightsPanel = config.insightsPanel;
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
    var applySidebarCurrency =
      typeof config.applySidebarCurrency === "function" ? config.applySidebarCurrency : function () {};
    var applyCardCurrency =
      typeof config.applyCardCurrency === "function" ? config.applyCardCurrency : function () {};
    var syncCardCurrencyObserver =
      typeof config.syncCardCurrencyObserver === "function"
        ? config.syncCardCurrencyObserver
        : function () {};
    var log = typeof config.log === "function" ? config.log : function () {};
    var reason = typeof config.reason === "string" ? config.reason : "";
    var attempt = Number.isFinite(Number(config.attempt)) ? Number(config.attempt) : 0;

    if (!state || typeof state !== "object" || listingInsightsEnabled) {
      return false;
    }

    var pathname = locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
    if (!urlApi || typeof urlApi.isListingPath !== "function" || !urlApi.isListingPath(pathname)) {
      return false;
    }

    var disabledToken = state.renderToken + 1;
    state.renderToken = disabledToken;
    clearRetryTimer(true);
    disconnectHydrationObserver();

    if (insightsPanel && typeof insightsPanel.removeExistingPanels === "function") {
      insightsPanel.removeExistingPanels(documentObj);
    }
    state.latestPanelContext = null;

    resolveCurrencyContext()
      .then(function (currencyContext) {
        var latestPathname =
          locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
        if (disabledToken !== state.renderToken || !urlApi.isListingPath(latestPathname)) {
          return;
        }

        applySidebarCurrency(currencyContext);
        applyCardCurrency(currencyContext);
        syncCardCurrencyObserver(currencyContext);

        log("skipped_listing_insights_panel", {
          reason: reason,
          attempt: attempt,
          currency: currencyContext && currencyContext.selectedCurrency
        });
      })
      .catch(function () {
        var latestPathname =
          locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
        if (disabledToken !== state.renderToken || !urlApi.isListingPath(latestPathname)) {
          return;
        }

        var fallbackCurrency = createUsdCurrencyContext();
        applySidebarCurrency(fallbackCurrency);
        applyCardCurrency(fallbackCurrency);
        syncCardCurrencyObserver(fallbackCurrency);
      });

    return true;
  }

  return {
    handleNonListingRoute: handleNonListingRoute,
    handleListingInsightsDisabled: handleListingInsightsDisabled
  };
});
