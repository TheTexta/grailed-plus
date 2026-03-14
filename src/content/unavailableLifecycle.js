(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusUnavailableLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createUnavailableListing() {
    return {
      id: "unknown",
      title: "",
      createdAt: null,
      pricing: {
        history: [],
        updatedAt: null
      },
      seller: {
        createdAt: null
      },
      rawListing: null
    };
  }

  function createUnavailableMetrics() {
    return {
      averageDropAmountUsd: null,
      averageDropPercent: null,
      expectedNextDropDays: null,
      expectedDropState: "insufficient_data"
    };
  }

  function renderUnavailable(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var urlApi = config.urlApi;
    var locationObj = config.locationObj;
    var documentObj = config.documentObj;
    var resolveMountTarget =
      typeof config.resolveMountTarget === "function" ? config.resolveMountTarget : function () {
        return null;
      };
    var resolveCurrencyContext =
      typeof config.resolveCurrencyContext === "function"
        ? config.resolveCurrencyContext
        : function () {
            return Promise.resolve(null);
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
    var statusMessage = typeof config.statusMessage === "string" ? config.statusMessage : "";

    if (!state || typeof state !== "object") {
      return;
    }

    var pathname = locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
    if (!urlApi || typeof urlApi.isListingPath !== "function" || !urlApi.isListingPath(pathname)) {
      return;
    }

    var renderToken = state.renderToken + 1;
    state.renderToken = renderToken;

    var mountTarget = resolveMountTarget(documentObj);
    if (!mountTarget || !mountTarget.mountNode) {
      return;
    }

    resolveCurrencyContext().then(function (currencyContext) {
      var latestPathname = locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
      if (renderToken !== state.renderToken || !urlApi.isListingPath(latestPathname)) {
        return;
      }

      renderPanelWithMarketCompare({
        listing: createUnavailableListing(),
        metrics: createUnavailableMetrics(),
        mountNode: mountTarget.mountNode,
        mountPosition: mountTarget.mountPosition,
        rawListing: null,
        statusMessage: statusMessage,
        currencyContext: currencyContext
      });
      applySidebarCurrency(currencyContext);
      applyCardCurrency(currencyContext);
      syncCardCurrencyObserver(currencyContext);
    });
  }

  return {
    renderUnavailable: renderUnavailable
  };
});
