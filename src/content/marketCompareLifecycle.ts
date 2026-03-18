type CDepopDebugLogger = (stage: string, payload?: Record<string, unknown>) => void;

interface CMarketCompareState {
  marketCompareController: any;
  marketCompareUnsubscribe: (() => void) | null;
  marketCompareAutoSearchRenderToken: number | null;
  latestPanelContext: {
    listing: any;
    metrics: any;
    mountNode: Node | null;
    mountPosition: "beforebegin" | "afterend";
    rawListing: any;
    statusMessage: string;
    currencyContext: any;
    marketCompareEnabled: boolean;
    marketCompareAutoSearchEnabled: boolean;
    marketCompareRankingFormula: string;
    marketCompareStrictMode: boolean;
    marketCompareResultsLimit: number;
    marketCompareMlSimilarityEnabled: boolean;
    marketCompareDebugEnabled: boolean;
    showMetadataButton: boolean;
    renderToken: number;
  } | null;
  renderToken: number;
}

interface CMarketCompareControllerApi {
  createController?: (options: {
    providerRegistry: any;
    provider: any;
    debugLogger?: CDepopDebugLogger | null;
  }) => any;
}

interface CMarketProvidersApi {
  createRegistry?: (options?: {
    debugLogger?: CDepopDebugLogger | null;
  }) => any;
  createMockDepopProvider?: () => any;
}

interface CDepopProviderFactory {
  createDepopProvider?: (options: {
    maxRequests: number;
    cooldownMs: number;
    debugLogger?: CDepopDebugLogger | null;
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
    marketCompareMlSimilarityEnabled: boolean;
    marketCompareDebugEnabled: boolean;
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
    marketCompareAutoSearchEnabled?: boolean;
    marketCompareRankingFormula?: string;
    marketCompareStrictMode?: boolean;
    marketCompareResultsLimit?: number;
    marketCompareMlSimilarityEnabled?: boolean;
    marketCompareDebugEnabled?: boolean;
    showMetadataButton?: boolean;
  };
}

interface CMarketCompareLifecycleModule {
  ensureMarketCompareController: (options: CEnsureControllerOptions | null | undefined) => any;
  triggerMarketCompare: (options: CTriggerMarketCompareOptions | null | undefined) => void;
  renderPanelWithMarketCompare: (options: CRenderPanelOptions | null | undefined) => unknown;
}

interface CMarketCompareGlobal {
  GrailedPlusImageSimilarity?: {
    preloadModel?: () => Promise<unknown>;
  };
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

  let ImageSimilarity: CMarketCompareGlobal["GrailedPlusImageSimilarity"] | null = null;
  if (typeof globalThis !== "undefined" && (globalThis as unknown as CMarketCompareGlobal).GrailedPlusImageSimilarity) {
    ImageSimilarity = (globalThis as unknown as CMarketCompareGlobal).GrailedPlusImageSimilarity || null;
  }
  if (!ImageSimilarity && typeof require === "function") {
    try {
      ImageSimilarity = require("../domain/imageSimilarity");
    } catch (_) {
      ImageSimilarity = null;
    }
  }

  function isGlobalDepopDebugEnabled(): boolean {
    var globalScope = typeof globalThis !== "undefined" ? (globalThis as any) : null;
    if (globalScope && globalScope.GRAILED_PLUS_DEBUG === true) {
      return true;
    }

    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem("grailed-plus:debug") === "1") {
        return true;
      }
    } catch (_) {
      // Ignore localStorage access failures.
    }

    try {
      var search =
        globalScope &&
        globalScope.location &&
        typeof globalScope.location.search === "string"
          ? globalScope.location.search
          : "";
      var params = new URLSearchParams(search);
      return params.get("gp_debug") === "1";
    } catch (_) {
      return false;
    }
  }

  function createDepopDebugLogger(enabled: boolean): CDepopDebugLogger | null {
    if (!enabled && !isGlobalDepopDebugEnabled()) {
      return null;
    }

    return function (stage: string, payload?: Record<string, unknown>): void {
      if (payload && typeof payload === "object") {
        console.debug("[Grailed+][Depop Debug]", stage, payload);
        return;
      }

      console.debug("[Grailed+][Depop Debug]", stage);
    };
  }

  function ensureMarketCompareController(options: CEnsureControllerOptions | null | undefined): any {
    var config = options && typeof options === "object" ? options : ({} as CEnsureControllerOptions);
    var state = config.state;
    var enabled = config.enabled !== false;
    var marketCompareControllerApi = config.marketCompareControllerApi;
    var marketProviders = config.marketProviders;
    var depopProviderFactory = config.depopProviderFactory;
    var onStateUpdate =
      typeof config.onStateUpdate === "function" ? config.onStateUpdate : function () {};
    var currentContext = state && state.latestPanelContext ? state.latestPanelContext : null;
    var debugLogger = createDepopDebugLogger(
      Boolean(currentContext && currentContext.marketCompareDebugEnabled === true)
    );

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
        ? marketProviders.createRegistry({
            debugLogger: debugLogger
          })
        : null;
    var depopProvider =
      depopProviderFactory && typeof depopProviderFactory.createDepopProvider === "function"
        ? depopProviderFactory.createDepopProvider({
            maxRequests: 5,
            cooldownMs: 1200,
            debugLogger: debugLogger
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
      provider: depopProvider || mockProvider,
      debugLogger: debugLogger
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
        : "visual",
      mlSimilarityEnabled: context.marketCompareMlSimilarityEnabled !== false,
      allowCategoryFallback: context.marketCompareStrictMode !== true
    });
  }

  function queueAutoMarketCompare(
    state: CMarketCompareState,
    ensureController: () => any,
    onMarketCompareClick: () => void
  ): void {
    var context = state.latestPanelContext;
    if (
      !context ||
      context.marketCompareEnabled === false ||
      context.marketCompareAutoSearchEnabled !== true
    ) {
      return;
    }

    if (state.marketCompareAutoSearchRenderToken === context.renderToken) {
      return;
    }

    var renderToken = context.renderToken;
    state.marketCompareAutoSearchRenderToken = renderToken;

    Promise.resolve()
      .then(function () {
        var latestContext = state.latestPanelContext;
        if (
          !latestContext ||
          latestContext.renderToken !== renderToken ||
          latestContext.marketCompareEnabled === false ||
          latestContext.marketCompareAutoSearchEnabled !== true
        ) {
          return;
        }

        var controller = ensureController();
        if (!controller || typeof controller.compare !== "function") {
          return;
        }

        if (typeof controller.getState === "function") {
          var controllerState = controller.getState();
          if (controllerState && controllerState.status === "loading") {
            return;
          }
        }

        onMarketCompareClick();
      })
      .catch(function () {
        // Ignore scheduling failures so rendering remains unaffected.
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
    var marketCompareAutoSearchEnabled = panelOptions.marketCompareAutoSearchEnabled === true;
    var marketCompareRankingFormula =
      typeof panelOptions.marketCompareRankingFormula === "string"
        ? panelOptions.marketCompareRankingFormula
        : "visual";
    var marketCompareStrictMode = panelOptions.marketCompareStrictMode === true;
    var marketCompareMlSimilarityEnabled = panelOptions.marketCompareMlSimilarityEnabled !== false;
    var marketCompareDebugEnabled = panelOptions.marketCompareDebugEnabled === true;

    state.latestPanelContext = {
      listing: panelOptions.listing || null,
      metrics: panelOptions.metrics || null,
      mountNode: panelOptions.mountNode || null,
      mountPosition: panelOptions.mountPosition || "afterend",
      rawListing: panelOptions.rawListing || null,
      statusMessage: panelOptions.statusMessage || "",
      currencyContext: panelOptions.currencyContext || null,
      marketCompareEnabled: marketCompareEnabled,
      marketCompareAutoSearchEnabled: marketCompareAutoSearchEnabled,
      marketCompareRankingFormula: marketCompareRankingFormula,
      marketCompareStrictMode: marketCompareStrictMode,
      marketCompareResultsLimit:
        Number.isFinite(Number(panelOptions.marketCompareResultsLimit)) &&
        Number(panelOptions.marketCompareResultsLimit) > 0
          ? Math.floor(Number(panelOptions.marketCompareResultsLimit))
          : 5,
      marketCompareMlSimilarityEnabled: marketCompareMlSimilarityEnabled,
      marketCompareDebugEnabled: marketCompareDebugEnabled,
      showMetadataButton: panelOptions.showMetadataButton !== false,
      renderToken: state.renderToken
    };

    var controller = marketCompareEnabled ? ensureController() : null;
    if (controller && typeof controller.resetForListing === "function") {
      controller.resetForListing(panelOptions.listing || null);
    }

    var marketCompareState =
      controller && typeof controller.getState === "function" ? controller.getState() : null;

    if (
      state.latestPanelContext.marketCompareEnabled &&
      state.latestPanelContext.marketCompareMlSimilarityEnabled &&
      ImageSimilarity &&
      typeof ImageSimilarity.preloadModel === "function"
    ) {
      Promise.resolve(ImageSimilarity.preloadModel()).catch(function () {
        // Keep warmup failures silent so panel rendering is unaffected.
      });
    }

    if (marketCompareEnabled && marketCompareAutoSearchEnabled) {
      queueAutoMarketCompare(state, ensureController, onMarketCompareClick);
    }

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
      marketCompareMlSimilarityEnabled: state.latestPanelContext.marketCompareMlSimilarityEnabled,
      marketCompareDebugEnabled: state.latestPanelContext.marketCompareDebugEnabled,
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
