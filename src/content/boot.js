(function () {
  "use strict";

  if (globalThis.__grailedPlusBooted) {
    return;
  }
  globalThis.__grailedPlusBooted = true;

  var Url = globalThis.GrailedPlusUrl;
  var ListingExtractor =
    globalThis.GrailedPlusListingExtractor || globalThis.GrailedPlusExtractListing;
  var PricingInsights =
    globalThis.GrailedPlusPricingInsights || globalThis.GrailedPlusMetrics;
  var Settings = globalThis.GrailedPlusSettings;
  var Currency = globalThis.GrailedPlusCurrency;
  var DepopProviderFactory = globalThis.GrailedPlusDepopProvider;
  var MarketProviders = globalThis.GrailedPlusMarketProviders;
  var MarketCompareController = globalThis.GrailedPlusMarketCompareController;
  var InsightsPanel =
    globalThis.GrailedPlusInsightsPanel || globalThis.GrailedPlusRender;
  var Theme = globalThis.GrailedPlusTheme;
  var Runtime = globalThis.GrailedPlusContentRuntime;
  var NavigationLifecycle = globalThis.GrailedPlusNavigationLifecycle;
  var DarkModeLifecycle = globalThis.GrailedPlusDarkModeLifecycle;
  var FilterScopeLifecycle = globalThis.GrailedPlusFilterScopeLifecycle;
  var CardCurrencyLifecycle = globalThis.GrailedPlusCardCurrencyLifecycle;
  var MarketCompareLifecycle = globalThis.GrailedPlusMarketCompareLifecycle;
  var CurrencyLifecycle = globalThis.GrailedPlusCurrencyLifecycle;
  var ListingInsightsLifecycle = globalThis.GrailedPlusListingInsightsLifecycle;
  var UnavailableLifecycle = globalThis.GrailedPlusUnavailableLifecycle;
  var RunLifecycle = globalThis.GrailedPlusRunLifecycle;
  var RetryLifecycle = globalThis.GrailedPlusRetryLifecycle;
  var ListingRenderLifecycle = globalThis.GrailedPlusListingRenderLifecycle;
  var ListingPipelineLifecycle = globalThis.GrailedPlusListingPipelineLifecycle;

  if (!Url || !ListingExtractor || !PricingInsights || !InsightsPanel) {
    console.error("[Grailed+] Failed to initialize: missing modules");
    return;
  }

  var MAX_RETRIES = 12;
  var RETRY_DELAY_MS = 500;
  var MAX_RETRY_WINDOW_MS = 15000;
  var URL_POLL_INTERVAL_MS = 1000;
  var CARD_PRICE_CONTAINER_SELECTOR =
    'div[class*="Price_root"], div[class*="Price-module__root"]';
  var CARD_PRICE_CURRENT_SELECTOR = '[data-testid="Current"]';
  var MONEY_ROOT_PRICE_SELECTOR =
    'span[class*="Money_root_"], span[class*="Money-module__root"]';
  var CARD_PRICE_TARGET_SELECTOR =
    CARD_PRICE_CONTAINER_SELECTOR + ", " + CARD_PRICE_CURRENT_SELECTOR + ", " + MONEY_ROOT_PRICE_SELECTOR;
  var FILTER_TARGET_ATTR = "data-grailed-plus-filter-target";
  var FILTER_TARGET_ATTR_VALUE = "1";
  var FILTER_SCOPE_SKIP_ATTR = "data-grailed-plus-filter-skip";
  var FILTER_SCOPE_SKIP_ATTR_VALUE = "1";
  var HEADER_ROOT_SELECTOR = [
    "header[class*='SiteHeader']",
    "[class*='SiteHeader']:is([class*='_nav__'], [class*='__nav__'])",
    "#globalHeader",
    ".Page-Header",
    "#siteBanner",
    "#flash",
    "#nav-overlay",
    "#global-modal-container",
    "header[id='globalHeader']",
    /* Messages pages can pin this container near the global header on mobile. */
    "[class*='FlashContainer']:is([class*='_flashContainer__'], [class*='__flashContainer__'])",
    "[class*='FlashContainer']:is([class*='_mobileConversation__'], [class*='__mobileConversation__'])",
    "[class*='FlashContainer_flashContainer__']",
    "[class*='FlashContainer_mobileConversation__']"
  ].join(", ");
  var MENU_ROOT_SELECTOR =
    "[class*='MerchandisingMenu']:is([class*='_root__'], [class*='__root__']), " +
    "[class*='MerchandisingMenu']:is([class*='_list__'], [class*='__list__']), " +
    "[class*='MerchandisingMenu']:is([class*='_viewportContainer__'], [class*='__viewportContainer__'])";
  var FILTER_TARGET_REFRESH_DELAYS_MS = [120, 400, 1200, 2500, 5000];

  var state =
    Runtime && typeof Runtime.createRuntimeState === "function"
      ? Runtime.createRuntimeState()
      : {
          // Start empty so first navigation pass always applies theme state on initial load.
          lastUrl: "",
          retryTimer: null,
          urlPollTimer: null,
          retryStartedAtMs: null,
          mutationObserver: null,
          renderToken: 0,
          darkModeToken: 0,
          darkModeMediaQuery: null,
          darkModeMediaListener: null,
          filterScopeTick: null,
          filterScopeDelayTimers: [],
          filterScopeObserver: null,
          cardCurrencyObserver: null,
          cardCurrencyTick: null,
          cardCurrencyTickUsesAnimationFrame: false,
          cardCurrencyContext: null,
          marketCompareController: null,
          marketCompareUnsubscribe: null,
          latestPanelContext: null
        };

  function isDebugEnabled() {
    var enabled = false;

    if (globalThis && globalThis.GRAILED_PLUS_DEBUG === true) {
      return true;
    }

    try {
      enabled = localStorage.getItem("grailed-plus:debug") === "1";
    } catch (_) {
      enabled = false;
    }

    if (enabled) {
      return true;
    }

    try {
      var params = new URLSearchParams(globalThis.location.search || "");
      return params.get("gp_debug") === "1";
    } catch (_) {
      return false;
    }
  }

  function log() {
    if (!isDebugEnabled()) {
      return;
    }
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[Grailed+]");
    console.debug.apply(console, args);
  }

  function clearRetryTimer(resetWindow) {
    if (!Runtime || typeof Runtime.clearRetryTimer !== "function") {
      return;
    }
    Runtime.clearRetryTimer(state, resetWindow);
  }

  function shouldStopRetryWindow() {
    if (!Runtime || typeof Runtime.shouldStopRetryWindow !== "function") {
      return true;
    }
    return Runtime.shouldStopRetryWindow(state, MAX_RETRY_WINDOW_MS);
  }

  function scheduleHydrationObserver() {
    if (!Runtime || typeof Runtime.scheduleHydrationObserver !== "function") {
      return;
    }
    Runtime.scheduleHydrationObserver({
      state: state,
      isListingPath: Url.isListingPath,
      getPathname: function () {
        return location.pathname;
      },
      getNextDataNode: function () {
        return document.getElementById("__NEXT_DATA__");
      },
      onHydrated: function () {
        refresh("mutation_observer");
      },
      log: log
    });
  }

  function disconnectHydrationObserver() {
    if (!Runtime || typeof Runtime.disconnectHydrationObserver !== "function") {
      return;
    }
    Runtime.disconnectHydrationObserver(state);
  }

  function resolveMountTarget(doc) {
    if (!ListingInsightsLifecycle || typeof ListingInsightsLifecycle.resolveMountTarget !== "function") {
      return null;
    }
    return ListingInsightsLifecycle.resolveMountTarget(InsightsPanel, doc);
  }

  function normalizeListingModel(listing) {
    if (!ListingInsightsLifecycle || typeof ListingInsightsLifecycle.normalizeListingModel !== "function") {
      return null;
    }
    return ListingInsightsLifecycle.normalizeListingModel(listing);
  }

  function computeListingInsights(listing) {
    if (!ListingInsightsLifecycle || typeof ListingInsightsLifecycle.computeListingInsights !== "function") {
      return null;
    }
    return ListingInsightsLifecycle.computeListingInsights({
      listing: listing,
      pricingInsights: PricingInsights
    });
  }

  function renderListingInsightsPanel(options) {
    if (!ListingInsightsLifecycle || typeof ListingInsightsLifecycle.renderListingInsightsPanel !== "function") {
      return null;
    }
    return ListingInsightsLifecycle.renderListingInsightsPanel({
      insightsPanel: InsightsPanel,
      panelOptions: options
    });
  }

  function ensureMarketCompareController() {
    if (!MarketCompareLifecycle || typeof MarketCompareLifecycle.ensureMarketCompareController !== "function") {
      return null;
    }
    return MarketCompareLifecycle.ensureMarketCompareController({
      state: state,
      marketCompareControllerApi: MarketCompareController,
      marketProviders: MarketProviders,
      depopProviderFactory: DepopProviderFactory,
      onStateUpdate: function (nextState) {
        var context = state.latestPanelContext;
        if (!context) {
          return;
        }
        if (!Url.isListingPath(location.pathname)) {
          return;
        }
        if (context.renderToken !== state.renderToken) {
          return;
        }

        renderListingInsightsPanel({
          listing: context.listing,
          metrics: context.metrics,
          mountNode: context.mountNode,
          mountPosition: context.mountPosition,
          rawListing: context.rawListing,
          statusMessage: context.statusMessage,
          currencyContext: context.currencyContext,
          marketCompare: nextState,
          onMarketCompareClick: triggerMarketCompare
        });
      }
    });
  }

  function triggerMarketCompare() {
    if (!MarketCompareLifecycle || typeof MarketCompareLifecycle.triggerMarketCompare !== "function") {
      return;
    }
    MarketCompareLifecycle.triggerMarketCompare({
      state: state,
      ensureController: ensureMarketCompareController
    });
  }

  function renderPanelWithMarketCompare(options) {
    if (!MarketCompareLifecycle || typeof MarketCompareLifecycle.renderPanelWithMarketCompare !== "function") {
      return null;
    }
    return MarketCompareLifecycle.renderPanelWithMarketCompare({
      state: state,
      ensureController: ensureMarketCompareController,
      renderListingInsightsPanel: renderListingInsightsPanel,
      onMarketCompareClick: triggerMarketCompare,
      panelOptions: options
    });
  }

  function createUsdCurrencyContext() {
    if (!CurrencyLifecycle || typeof CurrencyLifecycle.createUsdCurrencyContext !== "function") {
      return {
        selectedCurrency: "USD",
        rate: null,
        mode: "dual"
      };
    }
    return CurrencyLifecycle.createUsdCurrencyContext();
  }

  function normalizeCurrencyCode(input) {
    if (!CurrencyLifecycle || typeof CurrencyLifecycle.normalizeCurrencyCode !== "function") {
      return null;
    }
    return CurrencyLifecycle.normalizeCurrencyCode(input, Settings);
  }

  function createDefaultDarkModeContext() {
    if (
      !DarkModeLifecycle ||
      typeof DarkModeLifecycle.createDefaultDarkModeContext !== "function"
    ) {
      return {
        enabled: false,
        behavior: "system",
        primaryColor: "#000000"
      };
    }
    return DarkModeLifecycle.createDefaultDarkModeContext();
  }

  function resolveCurrencyContext() {
    if (!CurrencyLifecycle || typeof CurrencyLifecycle.resolveCurrencyContext !== "function") {
      return Promise.resolve(createUsdCurrencyContext());
    }
    return CurrencyLifecycle.resolveCurrencyContext({
      settings: Settings,
      currencyApi: Currency,
      normalizeCurrencyCode: normalizeCurrencyCode
    });
  }

  function resolveListingInsightsEnabled() {
    if (!ListingInsightsLifecycle || typeof ListingInsightsLifecycle.resolveListingInsightsEnabled !== "function") {
      return Promise.resolve(true);
    }
    return ListingInsightsLifecycle.resolveListingInsightsEnabled(Settings);
  }

  function applySidebarCurrency(currencyContext) {
    if (!CurrencyLifecycle || typeof CurrencyLifecycle.applySidebarCurrency !== "function") {
      return false;
    }
    return CurrencyLifecycle.applySidebarCurrency({
      insightsPanel: InsightsPanel,
      documentObj: document,
      currencyContext: currencyContext
    });
  }

  function applyCardCurrency(currencyContext) {
    if (!CurrencyLifecycle || typeof CurrencyLifecycle.applyCardCurrency !== "function") {
      return false;
    }
    return CurrencyLifecycle.applyCardCurrency({
      insightsPanel: InsightsPanel,
      documentObj: document,
      currencyContext: currencyContext
    });
  }

  function disconnectCardCurrencyObserver() {
    if (
      !CardCurrencyLifecycle ||
      typeof CardCurrencyLifecycle.disconnectCardCurrencyObserver !== "function"
    ) {
      return;
    }
    CardCurrencyLifecycle.disconnectCardCurrencyObserver(state);
  }

  function scheduleCardCurrencyRefresh() {
    if (
      !CardCurrencyLifecycle ||
      typeof CardCurrencyLifecycle.scheduleCardCurrencyRefresh !== "function"
    ) {
      return;
    }
    CardCurrencyLifecycle.scheduleCardCurrencyRefresh({
      state: state,
      onRefresh: function () {
        applyCardCurrency(state.cardCurrencyContext || createUsdCurrencyContext());
      }
    });
  }

  function setupCardCurrencyObserver() {
    if (
      !CardCurrencyLifecycle ||
      typeof CardCurrencyLifecycle.setupCardCurrencyObserver !== "function"
    ) {
      return;
    }
    CardCurrencyLifecycle.setupCardCurrencyObserver({
      state: state,
      documentObj: document,
      selector: CARD_PRICE_TARGET_SELECTOR,
      insightsPanel: InsightsPanel,
      onScheduleRefresh: scheduleCardCurrencyRefresh
    });
  }

  function syncCardCurrencyObserver(currencyContext) {
    if (
      !CardCurrencyLifecycle ||
      typeof CardCurrencyLifecycle.syncCardCurrencyObserver !== "function"
    ) {
      return;
    }
    CardCurrencyLifecycle.syncCardCurrencyObserver({
      state: state,
      currencyContext: currencyContext,
      createUsdCurrencyContext: createUsdCurrencyContext,
      normalizeCurrencyCode: normalizeCurrencyCode,
      onSetup: setupCardCurrencyObserver,
      onDisconnect: disconnectCardCurrencyObserver
    });
  }

  function applyDarkMode(darkModeContext) {
    if (Theme && typeof Theme.applyDarkModeToDocument === "function") {
      try {
        Theme.applyDarkModeToDocument(document, darkModeContext || createDefaultDarkModeContext());
      } catch (_) {
        // Theme application should not block the rest of the extension.
      }
    }

    syncFilterScopeObserver(Boolean(darkModeContext && darkModeContext.enabled));
    refreshFilterTargets();
    scheduleFilterTargetsRefreshBurst();
  }

  function refreshDarkMode() {
    if (!DarkModeLifecycle || typeof DarkModeLifecycle.refreshDarkMode !== "function") {
      return;
    }
    DarkModeLifecycle.refreshDarkMode({
      state: state,
      settings: Settings,
      onApply: applyDarkMode
    });
  }

  function setupDarkModeMediaListener() {
    if (
      !DarkModeLifecycle ||
      typeof DarkModeLifecycle.setupDarkModeMediaListener !== "function"
    ) {
      return;
    }
    DarkModeLifecycle.setupDarkModeMediaListener({
      state: state,
      onChange: refreshDarkMode
    });
  }

  function refreshFilterTargets() {
    if (!FilterScopeLifecycle || typeof FilterScopeLifecycle.refreshFilterTargets !== "function") {
      return;
    }
    FilterScopeLifecycle.refreshFilterTargets({
      documentObj: document,
      theme: Theme,
      headerSelector: HEADER_ROOT_SELECTOR,
      menuSelector: MENU_ROOT_SELECTOR,
      filterTargetAttr: FILTER_TARGET_ATTR,
      filterTargetAttrValue: FILTER_TARGET_ATTR_VALUE,
      filterScopeSkipAttr: FILTER_SCOPE_SKIP_ATTR,
      filterScopeSkipAttrValue: FILTER_SCOPE_SKIP_ATTR_VALUE
    });
  }

  function scheduleFilterTargetsRefresh() {
    if (
      !FilterScopeLifecycle ||
      typeof FilterScopeLifecycle.scheduleFilterTargetsRefresh !== "function"
    ) {
      return;
    }
    FilterScopeLifecycle.scheduleFilterTargetsRefresh({
      state: state,
      onRefresh: refreshFilterTargets
    });
  }

  function scheduleFilterTargetsRefreshBurst() {
    if (
      !FilterScopeLifecycle ||
      typeof FilterScopeLifecycle.scheduleFilterTargetsRefreshBurst !== "function"
    ) {
      return;
    }
    FilterScopeLifecycle.scheduleFilterTargetsRefreshBurst({
      state: state,
      delays: FILTER_TARGET_REFRESH_DELAYS_MS,
      onScheduleRefresh: scheduleFilterTargetsRefresh
    });
  }

  function setupFilterScopeObserver() {
    if (
      !FilterScopeLifecycle ||
      typeof FilterScopeLifecycle.setupFilterScopeObserver !== "function"
    ) {
      return;
    }
    FilterScopeLifecycle.setupFilterScopeObserver({
      state: state,
      documentObj: document,
      onScheduleRefresh: scheduleFilterTargetsRefresh
    });
  }

  function disconnectFilterScopeObserver() {
    if (
      !FilterScopeLifecycle ||
      typeof FilterScopeLifecycle.disconnectFilterScopeObserver !== "function"
    ) {
      return;
    }
    FilterScopeLifecycle.disconnectFilterScopeObserver(state);
  }

  function syncFilterScopeObserver(enabled) {
    if (
      !FilterScopeLifecycle ||
      typeof FilterScopeLifecycle.syncFilterScopeObserver !== "function"
    ) {
      return;
    }
    FilterScopeLifecycle.syncFilterScopeObserver({
      enabled: enabled,
      onSetup: setupFilterScopeObserver,
      onDisconnect: disconnectFilterScopeObserver
    });
  }

  function renderUnavailable(statusMessage) {
    if (!UnavailableLifecycle || typeof UnavailableLifecycle.renderUnavailable !== "function") {
      return;
    }
    UnavailableLifecycle.renderUnavailable({
      state: state,
      urlApi: Url,
      locationObj: location,
      documentObj: document,
      resolveMountTarget: resolveMountTarget,
      resolveCurrencyContext: resolveCurrencyContext,
      renderPanelWithMarketCompare: renderPanelWithMarketCompare,
      applySidebarCurrency: applySidebarCurrency,
      applyCardCurrency: applyCardCurrency,
      syncCardCurrencyObserver: syncCardCurrencyObserver,
      statusMessage: statusMessage
    });
  }

  function scheduleRetry(reason, attempt) {
    if (!RetryLifecycle || typeof RetryLifecycle.scheduleRetry !== "function") {
      return;
    }
    RetryLifecycle.scheduleRetry({
      state: state,
      reason: reason,
      attempt: attempt,
      maxRetries: MAX_RETRIES,
      retryDelayMs: RETRY_DELAY_MS,
      shouldStopRetryWindow: shouldStopRetryWindow,
      log: log,
      disconnectHydrationObserver: disconnectHydrationObserver,
      renderUnavailable: renderUnavailable,
      scheduleHydrationObserver: scheduleHydrationObserver,
      clearRetryTimer: clearRetryTimer,
      run: run
    });
  }

  function run(reason, attempt) {
    if (!RunLifecycle || typeof RunLifecycle.handleNonListingRoute !== "function") {
      return;
    }

    if (
      RunLifecycle.handleNonListingRoute({
        state: state,
        urlApi: Url,
        locationObj: location,
        documentObj: document,
        clearRetryTimer: clearRetryTimer,
        disconnectHydrationObserver: disconnectHydrationObserver,
        insightsPanel: InsightsPanel,
        resolveCurrencyContext: resolveCurrencyContext,
        createUsdCurrencyContext: createUsdCurrencyContext,
        applyCardCurrency: applyCardCurrency,
        syncCardCurrencyObserver: syncCardCurrencyObserver
      })
    ) {
      return;
    }

    if (!Url.isListingPath(location.pathname)) {
      return;
    }

    syncCardCurrencyObserver(null);

    resolveListingInsightsEnabled().then(function (listingInsightsEnabled) {
      if (!Url.isListingPath(location.pathname)) {
        return;
      }

      if (typeof RunLifecycle.handleListingInsightsDisabled !== "function") {
        return;
      }

      if (
        RunLifecycle.handleListingInsightsDisabled({
          state: state,
          listingInsightsEnabled: listingInsightsEnabled,
          urlApi: Url,
          locationObj: location,
          documentObj: document,
          clearRetryTimer: clearRetryTimer,
          disconnectHydrationObserver: disconnectHydrationObserver,
          insightsPanel: InsightsPanel,
          resolveCurrencyContext: resolveCurrencyContext,
          createUsdCurrencyContext: createUsdCurrencyContext,
          applySidebarCurrency: applySidebarCurrency,
          applyCardCurrency: applyCardCurrency,
          syncCardCurrencyObserver: syncCardCurrencyObserver,
          log: log,
          reason: reason,
          attempt: attempt
        })
      ) {
        return;
      }

      if (!listingInsightsEnabled) {
        return;
      }

      var listing = null;
      var metrics = null;
      var mountTarget = null;
      var renderToken = null;

      if (
        !ListingPipelineLifecycle ||
        typeof ListingPipelineLifecycle.prepareListingRenderContext !== "function"
      ) {
        return;
      }

      var preparedContext = ListingPipelineLifecycle.prepareListingRenderContext({
        state: state,
        listingExtractor: ListingExtractor,
        documentObj: document,
        normalizeListingModel: normalizeListingModel,
        resolveMountTarget: resolveMountTarget,
        computeListingInsights: computeListingInsights,
        scheduleRetry: scheduleRetry,
        attempt: attempt
      });
      if (!preparedContext) {
        return;
      }

      listing = preparedContext.listing;
      metrics = preparedContext.metrics;
      mountTarget = preparedContext.mountTarget;
      renderToken = preparedContext.renderToken;

      if (!ListingRenderLifecycle || typeof ListingRenderLifecycle.renderListingWithCurrency !== "function") {
        return;
      }

      ListingRenderLifecycle.renderListingWithCurrency({
        state: state,
        urlApi: Url,
        locationObj: location,
        renderToken: renderToken,
        listing: listing,
        metrics: metrics,
        mountTarget: mountTarget,
        resolveCurrencyContext: resolveCurrencyContext,
        createUsdCurrencyContext: createUsdCurrencyContext,
        renderPanelWithMarketCompare: renderPanelWithMarketCompare,
        applySidebarCurrency: applySidebarCurrency,
        applyCardCurrency: applyCardCurrency,
        syncCardCurrencyObserver: syncCardCurrencyObserver,
        disconnectHydrationObserver: disconnectHydrationObserver,
        log: log,
        reason: reason,
        attempt: attempt
      });
    });
  }

  function refresh(reason) {
    clearRetryTimer(true);
    refreshDarkMode();
    run(reason, 0);
  }

  function onNavigation(reason) {
    if (location.href === state.lastUrl && reason !== "initial") {
      return;
    }

    state.lastUrl = String(location.href);
    refresh(reason);
  }

  function setupNavigationListeners() {
    if (!NavigationLifecycle || typeof NavigationLifecycle.setupNavigationListeners !== "function") {
      return;
    }

    NavigationLifecycle.setupNavigationListeners({
      state: state,
      onNavigation: onNavigation,
      pollIntervalMs: URL_POLL_INTERVAL_MS,
      history: history,
      window: window,
      location: location
    });
  }

  setupNavigationListeners();
  setupDarkModeMediaListener();

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        onNavigation("dom_content_loaded");
      },
      { once: true }
    );
  }

  onNavigation("initial");
})();
