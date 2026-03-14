(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusMarketCompareLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function ensureMarketCompareController(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var marketCompareControllerApi = config.marketCompareControllerApi;
    var marketProviders = config.marketProviders;
    var depopProviderFactory = config.depopProviderFactory;
    var onStateUpdate =
      typeof config.onStateUpdate === "function" ? config.onStateUpdate : function () {};

    if (!state || typeof state !== "object") {
      return null;
    }

    if (state.marketCompareController) {
      return state.marketCompareController;
    }

    if (
      !marketCompareControllerApi ||
      typeof marketCompareControllerApi.createController !== "function"
    ) {
      return null;
    }

    var registry =
      marketProviders && typeof marketProviders.createRegistry === "function"
        ? marketProviders.createRegistry()
        : null;
    var depopProvider =
      depopProviderFactory && typeof depopProviderFactory.createDepopProvider === "function"
        ? depopProviderFactory.createDepopProvider({
            maxRequests: 5,
            cooldownMs: 1200
          })
        : null;
    var mockProvider =
      !depopProvider &&
      marketProviders &&
      typeof marketProviders.createMockDepopProvider === "function"
        ? marketProviders.createMockDepopProvider()
        : null;

    if (registry && typeof registry.register === "function") {
      if (depopProvider) {
        registry.register(depopProvider);
      } else if (mockProvider) {
        registry.register(mockProvider);
      }
    }

    state.marketCompareController = marketCompareControllerApi.createController({
      providerRegistry: registry,
      provider: depopProvider || mockProvider
    });

    if (
      state.marketCompareController &&
      typeof state.marketCompareController.subscribe === "function"
    ) {
      state.marketCompareUnsubscribe = state.marketCompareController.subscribe(function (nextState) {
        onStateUpdate(nextState);
      });
    }

    return state.marketCompareController;
  }

  function triggerMarketCompare(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var ensureController =
      typeof config.ensureController === "function" ? config.ensureController : function () {
        return null;
      };

    if (!state || typeof state !== "object") {
      return;
    }

    var controller = ensureController();
    var context = state.latestPanelContext;
    if (!controller || !context || typeof controller.compare !== "function") {
      return;
    }

    controller.compare({
      listing: context.listing,
      currency:
        context.currencyContext && context.currencyContext.selectedCurrency
          ? context.currencyContext.selectedCurrency
          : "USD",
      currencyRate:
        context.currencyContext && Number.isFinite(Number(context.currencyContext.rate))
          ? Number(context.currencyContext.rate)
          : null,
      currencyRates:
        context.currencyContext &&
        context.currencyContext.usdRates &&
        typeof context.currencyContext.usdRates === "object"
          ? context.currencyContext.usdRates
          : null
    });
  }

  function renderPanelWithMarketCompare(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var ensureController =
      typeof config.ensureController === "function" ? config.ensureController : function () {
        return null;
      };
    var renderListingInsightsPanel =
      typeof config.renderListingInsightsPanel === "function"
        ? config.renderListingInsightsPanel
        : function () {
            return null;
          };
    var onMarketCompareClick =
      typeof config.onMarketCompareClick === "function" ? config.onMarketCompareClick : function () {};
    var panelOptions = config.panelOptions && typeof config.panelOptions === "object" ? config.panelOptions : {};

    if (!state || typeof state !== "object") {
      return null;
    }

    var controller = ensureController();
    if (controller && typeof controller.resetForListing === "function") {
      controller.resetForListing(panelOptions.listing || null);
    }

    var marketCompareState =
      controller && typeof controller.getState === "function" ? controller.getState() : null;

    state.latestPanelContext = {
      listing: panelOptions.listing || null,
      metrics: panelOptions.metrics || null,
      mountNode: panelOptions.mountNode || null,
      mountPosition: panelOptions.mountPosition || "afterend",
      rawListing: panelOptions.rawListing || null,
      statusMessage: panelOptions.statusMessage || "",
      currencyContext: panelOptions.currencyContext || null,
      renderToken: state.renderToken
    };

    return renderListingInsightsPanel({
      listing: state.latestPanelContext.listing,
      metrics: state.latestPanelContext.metrics,
      mountNode: state.latestPanelContext.mountNode,
      mountPosition: state.latestPanelContext.mountPosition,
      rawListing: state.latestPanelContext.rawListing,
      statusMessage: state.latestPanelContext.statusMessage,
      currencyContext: state.latestPanelContext.currencyContext,
      marketCompare: marketCompareState,
      onMarketCompareClick: onMarketCompareClick
    });
  }

  return {
    ensureMarketCompareController: ensureMarketCompareController,
    triggerMarketCompare: triggerMarketCompare,
    renderPanelWithMarketCompare: renderPanelWithMarketCompare
  };
});
