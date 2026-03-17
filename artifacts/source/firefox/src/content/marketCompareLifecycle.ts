interface CMarketCompareState {
  marketCompareController: any;
  marketCompareUnsubscribe: (() => void) | null;
  latestPanelContext: {
    listing: any;
    metrics: any;
    mountNode: Node | null;
    mountPosition: "beforebegin" | "afterend";
    rawListing: any;
    statusMessage: string;
    currencyContext: any;
    marketCompareEnabled: boolean;
    marketCompareRankingFormula: string;
    marketCompareStrictMode: boolean;
    marketCompareResultsLimit: number;
    showMetadataButton: boolean;
    renderToken: number;
  } | null;
  renderToken: number;
}

interface CMarketCompareControllerApi {
  createController?: (options: {
    providerRegistry: any;
    provider: any;
  }) => any;
}

interface CMarketProvidersApi {
  createRegistry?: () => any;
  createMockDepopProvider?: () => any;
}

interface CDepopProviderFactory {
  createDepopProvider?: (options: {
    maxRequests: number;
    cooldownMs: number;
  }) => any;
}

interface CEnsureControllerOptions {
  state: CMarketCompareState;
  enabled?: boolean;
  marketCompareControllerApi?: CMarketCompareControllerApi | null;
  marketProviders?: CMarketProvidersApi | null;
  depopProviderFactory?: CDepopProviderFactory | null;
  onStateUpdate?: (nextState: any) => void;
}

interface CTriggerMarketCompareOptions {
  state: CMarketCompareState;
  ensureController?: () => any;
}

interface CRenderPanelOptions {
  state: CMarketCompareState;
  ensureController?: () => any;
  renderListingInsightsPanel?: (options: {
    listing: any;
    metrics: any;
    mountNode: Node | null;
    mountPosition: "beforebegin" | "afterend";
    rawListing: any;
    statusMessage: string;
    currencyContext: any;
    marketCompareEnabled: boolean;
    marketCompareRankingFormula: string;
    marketCompareStrictMode: boolean;
    marketCompareResultsLimit: number;
    showMetadataButton: boolean;
    marketCompare: any;
    onMarketCompareClick: () => void;
  }) => unknown;
  onMarketCompareClick?: () => void;
  panelOptions?: {
    listing?: any;
    metrics?: any;
    mountNode?: Node | null;
    mountPosition?: "beforebegin" | "afterend";
    rawListing?: any;
    statusMessage?: string;
    currencyContext?: any;
    marketCompareEnabled?: boolean;
    marketCompareRankingFormula?: string;
    marketCompareStrictMode?: boolean;
    marketCompareResultsLimit?: number;
    showMetadataButton?: boolean;
  };
}

interface CMarketCompareLifecycleModule {
  ensureMarketCompareController: (options: CEnsureControllerOptions | null | undefined) => any;
  triggerMarketCompare: (options: CTriggerMarketCompareOptions | null | undefined) => void;
  renderPanelWithMarketCompare: (options: CRenderPanelOptions | null | undefined) => unknown;
}

interface CMarketCompareGlobal {
  GrailedPlusMarketCompareLifecycle?: CMarketCompareLifecycleModule;
}

(function (root: CMarketCompareGlobal, factory: () => CMarketCompareLifecycleModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusMarketCompareLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as CMarketCompareGlobal) : {}, function () {
  "use strict";

  function ensureMarketCompareController(options: CEnsureControllerOptions | null | undefined): any {
    var config = options && typeof options === "object" ? options : ({} as CEnsureControllerOptions);
    var state = config.state;
    var enabled = config.enabled !== false;
    var marketCompareControllerApi = config.marketCompareControllerApi;
    var marketProviders = config.marketProviders;
    var depopProviderFactory = config.depopProviderFactory;
    var onStateUpdate =
      typeof config.onStateUpdate === "function" ? config.onStateUpdate : function () {};

    if (!state || typeof state !== "object") {
      return null;
    }

    if (!enabled) {
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
      state.marketCompareUnsubscribe = state.marketCompareController.subscribe(function (nextState: any) {
        onStateUpdate(nextState);
      });
    }

    return state.marketCompareController;
  }

  function triggerMarketCompare(options: CTriggerMarketCompareOptions | null | undefined): void {
    var config = options && typeof options === "object" ? options : ({} as CTriggerMarketCompareOptions);
    var state = config.state;
    var ensureController =
      typeof config.ensureController === "function" ? config.ensureController : function () {
        return null;
      };

    if (!state || typeof state !== "object") {
      return;
    }

    var context = state.latestPanelContext;
    if (!context || context.marketCompareEnabled === false) {
      return;
    }

    var controller = ensureController();
    if (!controller || !context || typeof controller.compare !== "function") {
      return;
    }

    controller.compare({
      listing: context.listing,
      currency:
        context.currencyContext && context.currencyContext.selectedCurrency
          ? context.currencyContext.selectedCurrency
          : "USD",
      limit:
        Number.isFinite(Number(context.marketCompareResultsLimit)) &&
        Number(context.marketCompareResultsLimit) > 0
          ? Math.floor(Number(context.marketCompareResultsLimit))
          : 5,
      currencyRate:
        context.currencyContext && Number.isFinite(Number(context.currencyContext.rate))
          ? Number(context.currencyContext.rate)
          : null,
      currencyRates:
        context.currencyContext &&
        context.currencyContext.usdRates &&
        typeof context.currencyContext.usdRates === "object"
          ? context.currencyContext.usdRates
          : null,
      minScore: 0,
      rankingFormula: typeof context.marketCompareRankingFormula === "string"
        ? context.marketCompareRankingFormula
        : "balanced",
      allowCategoryFallback: context.marketCompareStrictMode !== true
    });
  }

  function renderPanelWithMarketCompare(options: CRenderPanelOptions | null | undefined): unknown {
    var config = options && typeof options === "object" ? options : ({} as CRenderPanelOptions);
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

    var marketCompareEnabled = panelOptions.marketCompareEnabled !== false;
    var marketCompareRankingFormula =
      typeof panelOptions.marketCompareRankingFormula === "string"
        ? panelOptions.marketCompareRankingFormula
        : "balanced";
    var marketCompareStrictMode = panelOptions.marketCompareStrictMode === true;
    var controller = marketCompareEnabled ? ensureController() : null;
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
      marketCompareEnabled: marketCompareEnabled,
      marketCompareRankingFormula: marketCompareRankingFormula,
      marketCompareStrictMode: marketCompareStrictMode,
      marketCompareResultsLimit:
        Number.isFinite(Number(panelOptions.marketCompareResultsLimit)) &&
        Number(panelOptions.marketCompareResultsLimit) > 0
          ? Math.floor(Number(panelOptions.marketCompareResultsLimit))
          : 5,
      showMetadataButton: panelOptions.showMetadataButton !== false,
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
      marketCompareEnabled: state.latestPanelContext.marketCompareEnabled,
      marketCompareRankingFormula: state.latestPanelContext.marketCompareRankingFormula,
      marketCompareStrictMode: state.latestPanelContext.marketCompareStrictMode,
      marketCompareResultsLimit: state.latestPanelContext.marketCompareResultsLimit,
      showMetadataButton: state.latestPanelContext.showMetadataButton,
      marketCompare: marketCompareEnabled ? marketCompareState : null,
      onMarketCompareClick: onMarketCompareClick
    });
  }

  return {
    ensureMarketCompareController: ensureMarketCompareController,
    triggerMarketCompare: triggerMarketCompare,
    renderPanelWithMarketCompare: renderPanelWithMarketCompare
  };
});
