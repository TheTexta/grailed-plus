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
  var InsightsPanel =
    globalThis.GrailedPlusInsightsPanel || globalThis.GrailedPlusRender;
  var Theme = globalThis.GrailedPlusTheme;

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

  var state = {
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
    cardCurrencyContext: null
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
    if (state.retryTimer) {
      clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }
    if (resetWindow) {
      state.retryStartedAtMs = null;
    }
  }

  function shouldStopRetryWindow() {
    if (state.retryStartedAtMs == null) {
      state.retryStartedAtMs = Date.now();
      return false;
    }

    return Date.now() - state.retryStartedAtMs > MAX_RETRY_WINDOW_MS;
  }

  function scheduleHydrationObserver() {
    if (typeof MutationObserver !== "function") {
      return;
    }
    if (state.mutationObserver) {
      return;
    }

    var obs = new MutationObserver(function () {
      if (!Url.isListingPath(location.pathname)) {
        return;
      }

      var nextDataNode = document.getElementById("__NEXT_DATA__");
      if (nextDataNode && nextDataNode.textContent) {
        log("hydration observer detected next data");
        refresh("mutation_observer");
      }
    });

    obs.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });

    state.mutationObserver = obs;
  }

  function disconnectHydrationObserver() {
    if (state.mutationObserver && typeof state.mutationObserver.disconnect === "function") {
      state.mutationObserver.disconnect();
    }
    state.mutationObserver = null;
  }

  function resolveMountTarget(doc) {
    if (!InsightsPanel) {
      return null;
    }

    if (typeof InsightsPanel.findMountTarget === "function") {
      return InsightsPanel.findMountTarget(doc);
    }

    if (typeof InsightsPanel.findMountNode === "function") {
      var legacyMountNode = InsightsPanel.findMountNode(doc);
      if (!legacyMountNode) {
        return null;
      }
      return {
        mountNode: legacyMountNode,
        mountPosition: "afterend",
        strategy: "legacy_mount_node"
      };
    }

    return null;
  }

  function normalizeListingModel(listing) {
    if (!listing || typeof listing !== "object") {
      return {
        id: null,
        title: "",
        createdAt: null,
        pricing: {
          history: [],
          updatedAt: null
        },
        seller: {
          createdAt: null
        },
        prettyPath: null,
        sold: false,
        rawListing: null,
        sourceStatus: "missing_listing"
      };
    }

    var existingPricing = listing.pricing && typeof listing.pricing === "object" ? listing.pricing : {};
    var history = Array.isArray(existingPricing.history)
      ? existingPricing.history
      : Array.isArray(listing.priceDrops)
      ? listing.priceDrops
      : [];
    var updatedAt =
      typeof existingPricing.updatedAt === "string" || existingPricing.updatedAt === null
        ? existingPricing.updatedAt
        : listing.priceUpdatedAt || null;

    return {
      id: listing.id || null,
      title: typeof listing.title === "string" ? listing.title : "",
      createdAt: listing.createdAt || null,
      pricing: {
        history: history,
        updatedAt: updatedAt
      },
      seller:
        listing.seller && typeof listing.seller === "object"
          ? {
              createdAt: listing.seller.createdAt || null
            }
          : {
              createdAt: null
            },
      prettyPath: listing.prettyPath || null,
      sold: Boolean(listing.sold),
      rawListing: listing.rawListing || null,
      sourceStatus: listing.sourceStatus || "ok"
    };
  }

  function computeListingInsights(listing) {
    if (PricingInsights && typeof PricingInsights.computePricingInsights === "function") {
      return PricingInsights.computePricingInsights(listing);
    }

    if (PricingInsights && typeof PricingInsights.computeMetrics === "function") {
      var legacy = PricingInsights.computeMetrics({
        priceDrops: listing && listing.pricing ? listing.pricing.history : [],
        createdAt: listing ? listing.createdAt : null,
        priceUpdatedAt: listing && listing.pricing ? listing.pricing.updatedAt : null
      });
      return {
        averageDropAmountUsd: legacy && Number.isFinite(legacy.avgDropAmount) ? legacy.avgDropAmount : null,
        averageDropPercent: legacy && Number.isFinite(legacy.avgDropPercent) ? legacy.avgDropPercent : null,
        expectedNextDropDays:
          legacy && Number.isFinite(legacy.expectedDropDays) ? legacy.expectedDropDays : null,
        expectedDropState:
          legacy && typeof legacy.expectedDropState === "string"
            ? legacy.expectedDropState
            : "insufficient_data",
        totalDrops: legacy && Number.isFinite(legacy.totalDrops) ? legacy.totalDrops : 0
      };
    }

    return {
      averageDropAmountUsd: null,
      averageDropPercent: null,
      expectedNextDropDays: null,
      expectedDropState: "insufficient_data",
      totalDrops: 0
    };
  }

  function renderListingInsightsPanel(options) {
    if (InsightsPanel && typeof InsightsPanel.renderInsightsPanel === "function") {
      return InsightsPanel.renderInsightsPanel(options);
    }

    if (InsightsPanel && typeof InsightsPanel.renderPanel === "function") {
      var listing = normalizeListingModel(options && options.listing ? options.listing : null);
      var metrics = options && options.metrics ? options.metrics : {};
      var legacyMetrics = {
        avgDropAmount:
          Number.isFinite(metrics.averageDropAmountUsd) ? metrics.averageDropAmountUsd : null,
        avgDropPercent:
          Number.isFinite(metrics.averageDropPercent) ? metrics.averageDropPercent : null,
        expectedDropDays:
          Number.isFinite(metrics.expectedNextDropDays) ? metrics.expectedNextDropDays : null,
        expectedDropState:
          typeof metrics.expectedDropState === "string"
            ? metrics.expectedDropState
            : "insufficient_data",
        totalDrops: Number.isFinite(metrics.totalDrops) ? metrics.totalDrops : 0
      };

      return InsightsPanel.renderPanel({
        listing: {
          id: listing.id,
          title: listing.title,
          priceDrops: listing.pricing.history,
          createdAt: listing.createdAt,
          priceUpdatedAt: listing.pricing.updatedAt,
          seller: listing.seller,
          prettyPath: listing.prettyPath,
          sold: listing.sold,
          rawListing: listing.rawListing
        },
        metrics: legacyMetrics,
        mountNode: options && options.mountNode ? options.mountNode : null,
        mountPosition: options && options.mountPosition ? options.mountPosition : "afterend",
        rawListing: options && options.rawListing ? options.rawListing : null,
        statusMessage: options && options.statusMessage ? options.statusMessage : "",
        currencyContext: options && options.currencyContext ? options.currencyContext : null
      });
    }

    return null;
  }

  function createUsdCurrencyContext() {
    return {
      selectedCurrency: "USD",
      rate: null,
      mode: "dual"
    };
  }

  function normalizeCurrencyCode(input) {
    if (Settings && typeof Settings.normalizeCurrencyCode === "function") {
      return Settings.normalizeCurrencyCode(input);
    }

    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  function normalizeHexColor(input) {
    if (Settings && typeof Settings.normalizeHexColor === "function") {
      return Settings.normalizeHexColor(input);
    }

    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    var shortMatch = trimmed.match(/^#?([0-9a-fA-F]{3})$/);
    if (shortMatch && shortMatch[1]) {
      var shortHex = shortMatch[1].toUpperCase();
      return (
        "#" +
        shortHex.charAt(0) +
        shortHex.charAt(0) +
        shortHex.charAt(1) +
        shortHex.charAt(1) +
        shortHex.charAt(2) +
        shortHex.charAt(2)
      );
    }

    var longMatch = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
    if (longMatch && longMatch[1]) {
      return "#" + longMatch[1].toUpperCase();
    }

    return null;
  }

  function normalizeDarkModeBehavior(input) {
    if (Settings && typeof Settings.normalizeDarkModeBehavior === "function") {
      return Settings.normalizeDarkModeBehavior(input);
    }

    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim().toLowerCase();
    if (trimmed !== "system" && trimmed !== "permanent") {
      return null;
    }

    return trimmed;
  }

  function getSystemDarkModeQuery() {
    if (typeof globalThis.matchMedia !== "function") {
      return null;
    }

    try {
      return globalThis.matchMedia("(prefers-color-scheme: dark)");
    } catch (_) {
      return null;
    }
  }

  function getSystemPrefersDark() {
    var query = getSystemDarkModeQuery();
    return Boolean(query && query.matches);
  }

  function createDefaultDarkModeContext() {
    return {
      enabled: getSystemPrefersDark(),
      behavior: "system",
      primaryColor: "#000000"
    };
  }

  function resolveDarkModeContext() {
    var defaultContext = createDefaultDarkModeContext();
    if (!Settings) {
      return Promise.resolve(defaultContext);
    }

    var enabledPromise =
      typeof Settings.getDarkModeEnabled === "function"
        ? Settings.getDarkModeEnabled()
        : Promise.resolve(defaultContext.enabled);
    var behaviorPromise =
      typeof Settings.getDarkModeBehavior === "function"
        ? Settings.getDarkModeBehavior()
        : Promise.resolve(defaultContext.behavior);
    var colorPromise =
      typeof Settings.getDarkModePrimaryColor === "function"
        ? Settings.getDarkModePrimaryColor()
        : Promise.resolve(defaultContext.primaryColor);

    return Promise.all([enabledPromise, behaviorPromise, colorPromise])
      .then(function (values) {
        var configuredEnabled = Boolean(values[0]);
        var behavior = normalizeDarkModeBehavior(values[1]) || defaultContext.behavior;
        var primaryColor = normalizeHexColor(values[2]) || defaultContext.primaryColor;
        var enabled = configuredEnabled && (behavior === "permanent" ? true : getSystemPrefersDark());
        return {
          enabled: enabled,
          behavior: behavior,
          primaryColor: primaryColor
        };
      })
      .catch(function () {
        return defaultContext;
      });
  }

  function resolveCurrencyContext() {
    var defaultContext = createUsdCurrencyContext();

    if (!Settings || typeof Settings.getSelectedCurrency !== "function") {
      return Promise.resolve(defaultContext);
    }

    var enabledPromise =
      typeof Settings.getCurrencyConversionEnabled === "function"
        ? Settings.getCurrencyConversionEnabled()
        : Promise.resolve(false);

    return enabledPromise
      .then(function (enabled) {
        if (!enabled) {
          return defaultContext;
        }
        return Settings.getSelectedCurrency();
      })
      .then(function (savedCurrency) {
        if (typeof savedCurrency !== "string") {
          return defaultContext;
        }

        var selectedCurrency = normalizeCurrencyCode(savedCurrency) || defaultContext.selectedCurrency;
        var context = {
          selectedCurrency: selectedCurrency,
          rate: null,
          mode: "dual"
        };

        if (selectedCurrency === "USD") {
          return context;
        }

        if (!Currency || typeof Currency.getRates !== "function") {
          return context;
        }

        return Currency.getRates("USD")
          .then(function (result) {
            var rates = result && result.rates && typeof result.rates === "object" ? result.rates : {};
            var rate = Number(rates[selectedCurrency]);
            if (Number.isFinite(rate) && rate > 0) {
              context.rate = rate;
            }
            return context;
          })
          .catch(function () {
            return context;
          });
      })
      .catch(function () {
        return defaultContext;
      });
  }

  function resolveListingInsightsEnabled() {
    var defaultEnabled =
      Settings && typeof Settings.DEFAULT_LISTING_INSIGHTS_ENABLED === "boolean"
        ? Settings.DEFAULT_LISTING_INSIGHTS_ENABLED
        : true;

    if (!Settings || typeof Settings.getListingInsightsEnabled !== "function") {
      return Promise.resolve(defaultEnabled);
    }

    return Settings.getListingInsightsEnabled()
      .then(function (enabled) {
        return typeof enabled === "boolean" ? enabled : defaultEnabled;
      })
      .catch(function () {
        return defaultEnabled;
      });
  }

  function applySidebarCurrency(currencyContext) {
    if (!InsightsPanel || typeof InsightsPanel.applySidebarCurrency !== "function") {
      return false;
    }

    try {
      return InsightsPanel.applySidebarCurrency(document, currencyContext || createUsdCurrencyContext());
    } catch (_) {
      // Sidebar rewrite should never block panel rendering.
      return false;
    }
  }

  function applyCardCurrency(currencyContext) {
    if (!InsightsPanel || typeof InsightsPanel.applyCardCurrency !== "function") {
      return false;
    }

    try {
      return InsightsPanel.applyCardCurrency(document, currencyContext || createUsdCurrencyContext());
    } catch (_) {
      // Card rewrite should never block the rest of the extension.
      return false;
    }
  }

  function isConversionContextEnabled(currencyContext) {
    var selectedCurrency = normalizeCurrencyCode(currencyContext && currencyContext.selectedCurrency);
    var rate = Number(currencyContext && currencyContext.rate);
    return Boolean(selectedCurrency && selectedCurrency !== "USD" && Number.isFinite(rate) && rate > 0);
  }

  function isElementNode(node) {
    if (!node) {
      return false;
    }

    if (node.nodeType === 1) {
      return true;
    }

    return typeof node.querySelector === "function";
  }

  function nodeContainsCardPriceTarget(node) {
    if (!isElementNode(node)) {
      return false;
    }

    if (typeof node.matches === "function") {
      if (node.matches(CARD_PRICE_CONTAINER_SELECTOR) || node.matches(CARD_PRICE_CURRENT_SELECTOR)) {
        return true;
      }
    }

    if (typeof node.querySelector === "function") {
      return Boolean(node.querySelector(CARD_PRICE_CONTAINER_SELECTOR + ", " + CARD_PRICE_CURRENT_SELECTOR));
    }

    return false;
  }

  function clearCardCurrencyTick() {
    if (state.cardCurrencyTick == null) {
      return;
    }

    if (
      state.cardCurrencyTickUsesAnimationFrame &&
      typeof globalThis.cancelAnimationFrame === "function"
    ) {
      globalThis.cancelAnimationFrame(state.cardCurrencyTick);
    } else {
      clearTimeout(state.cardCurrencyTick);
    }

    state.cardCurrencyTick = null;
    state.cardCurrencyTickUsesAnimationFrame = false;
  }

  function disconnectCardCurrencyObserver() {
    if (state.cardCurrencyObserver && typeof state.cardCurrencyObserver.disconnect === "function") {
      state.cardCurrencyObserver.disconnect();
    }
    state.cardCurrencyObserver = null;
    state.cardCurrencyContext = null;
    clearCardCurrencyTick();
  }

  function scheduleCardCurrencyRefresh() {
    if (state.cardCurrencyTick != null) {
      return;
    }

    var run = function () {
      state.cardCurrencyTick = null;
      state.cardCurrencyTickUsesAnimationFrame = false;

      if (Url.isListingPath(location.pathname)) {
        return;
      }

      applyCardCurrency(state.cardCurrencyContext || createUsdCurrencyContext());
    };

    if (typeof globalThis.requestAnimationFrame === "function") {
      state.cardCurrencyTickUsesAnimationFrame = true;
      state.cardCurrencyTick = globalThis.requestAnimationFrame(run);
      return;
    }

    state.cardCurrencyTickUsesAnimationFrame = false;
    state.cardCurrencyTick = globalThis.setTimeout(run, 16);
  }

  function setupCardCurrencyObserver() {
    if (state.cardCurrencyObserver || typeof MutationObserver !== "function") {
      return;
    }

    var root = document.body || document.documentElement;
    if (!root) {
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      var i;
      var j;
      var mutation;
      var addedNode;
      var shouldRefresh = false;

      for (i = 0; i < mutations.length; i += 1) {
        mutation = mutations[i];
        if (!mutation || mutation.type !== "childList" || !mutation.addedNodes) {
          continue;
        }

        for (j = 0; j < mutation.addedNodes.length; j += 1) {
          addedNode = mutation.addedNodes[j];
          if (nodeContainsCardPriceTarget(addedNode)) {
            shouldRefresh = true;
            break;
          }
        }

        if (shouldRefresh) {
          break;
        }
      }

      if (shouldRefresh) {
        scheduleCardCurrencyRefresh();
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });

    state.cardCurrencyObserver = observer;
  }

  function syncCardCurrencyObserver(currencyContext) {
    if (Url.isListingPath(location.pathname)) {
      disconnectCardCurrencyObserver();
      return;
    }

    state.cardCurrencyContext = currencyContext || createUsdCurrencyContext();
    if (!isConversionContextEnabled(state.cardCurrencyContext)) {
      disconnectCardCurrencyObserver();
      return;
    }

    setupCardCurrencyObserver();
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
    var darkModeToken = state.darkModeToken + 1;
    state.darkModeToken = darkModeToken;

    resolveDarkModeContext().then(function (darkModeContext) {
      if (darkModeToken !== state.darkModeToken) {
        return;
      }
      applyDarkMode(darkModeContext);
    });
  }

  function setupDarkModeMediaListener() {
    if (state.darkModeMediaQuery) {
      return;
    }

    var query = getSystemDarkModeQuery();
    if (!query) {
      return;
    }

    var onChange = function () {
      refreshDarkMode();
    };

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
    } else if (typeof query.addListener === "function") {
      query.addListener(onChange);
    } else {
      return;
    }

    state.darkModeMediaQuery = query;
    state.darkModeMediaListener = onChange;
  }

  function getThemeAttrOrFallback(key, fallback) {
    if (!Theme || typeof Theme !== "object") {
      return fallback;
    }
    return Theme[key] || fallback;
  }

  function clearFilterTargets() {
    if (typeof document.querySelectorAll !== "function") {
      return;
    }

    var nodes = document.querySelectorAll(
      "[" + FILTER_TARGET_ATTR + "],[" + FILTER_SCOPE_SKIP_ATTR + "]"
    );
    var i;
    var node;

    for (i = 0; i < nodes.length; i += 1) {
      node = nodes[i];
      if (typeof node.removeAttribute === "function") {
        node.removeAttribute(FILTER_TARGET_ATTR);
        node.removeAttribute(FILTER_SCOPE_SKIP_ATTR);
      }
    }
  }

  function getDarkModeRootState() {
    var rootNode = document.documentElement || null;
    var bodyNode = document.body || null;
    var nextRoot =
      typeof document.getElementById === "function"
        ? document.getElementById("__next")
        : null;
    var rootAttr = getThemeAttrOrFallback("ROOT_ATTR", "data-grailed-plus-dark-mode");
    var nextRootAttr = getThemeAttrOrFallback("NEXT_ROOT_ATTR", "data-grailed-plus-next-root");
    var rootEnabled = Boolean(rootNode && rootNode.getAttribute(rootAttr) === "1");
    var nextRootEnabled = Boolean(rootNode && rootNode.getAttribute(nextRootAttr) === "1");
    var filterRoot = null;
    var mode = "none";

    if (rootEnabled && nextRootEnabled && nextRoot) {
      filterRoot = nextRoot;
      mode = "next";
    } else if (rootEnabled && bodyNode) {
      filterRoot = bodyNode;
      mode = "legacy";
    }

    return {
      rootNode: rootNode,
      bodyNode: bodyNode,
      nextRoot: nextRoot,
      enabled: Boolean(filterRoot),
      mode: mode,
      filterRoot: filterRoot
    };
  }

  function containsHeaderBoundary(node, headerRoot) {
    if (!node) {
      return false;
    }

    if (headerRoot && node === headerRoot) {
      return true;
    }

    if (typeof node.matches === "function") {
      if (node.matches(HEADER_ROOT_SELECTOR) || node.matches(MENU_ROOT_SELECTOR)) {
        return true;
      }
    }

    if (typeof node.querySelector === "function") {
      return Boolean(node.querySelector(HEADER_ROOT_SELECTOR + ", " + MENU_ROOT_SELECTOR));
    }

    return false;
  }

  function isDirectHeaderBoundary(node, headerRoot) {
    if (!node) {
      return false;
    }

    if (headerRoot && node === headerRoot) {
      return true;
    }

    if (typeof node.matches !== "function") {
      return false;
    }

    return Boolean(node.matches(HEADER_ROOT_SELECTOR) || node.matches(MENU_ROOT_SELECTOR));
  }

  function markFilterTargetsWithin(boundaryNode, headerRoot, depth) {
    if (!boundaryNode || !boundaryNode.children || depth > 6) {
      return;
    }

    var children = boundaryNode.children;
    var i;
    var child;
    var hasBoundary;
    var isDirectBoundary;

    for (i = 0; i < children.length; i += 1) {
      child = children[i];
      isDirectBoundary = isDirectHeaderBoundary(child, headerRoot);

      if (isDirectBoundary) {
        if (typeof child.setAttribute === "function") {
          child.setAttribute(FILTER_SCOPE_SKIP_ATTR, FILTER_SCOPE_SKIP_ATTR_VALUE);
        }
        continue;
      }

      hasBoundary = containsHeaderBoundary(child, headerRoot);

      if (hasBoundary) {
        if (typeof child.setAttribute === "function") {
          child.setAttribute(FILTER_SCOPE_SKIP_ATTR, FILTER_SCOPE_SKIP_ATTR_VALUE);
        }
        markFilterTargetsWithin(child, headerRoot, depth + 1);
        continue;
      }

      if (typeof child.setAttribute === "function") {
        child.setAttribute(FILTER_TARGET_ATTR, FILTER_TARGET_ATTR_VALUE);
      }
    }
  }

  function refreshFilterTargets() {
    clearFilterTargets();

    var modeState = getDarkModeRootState();
    if (!modeState.enabled) {
      return;
    }

    var filterRoot = modeState.filterRoot;
    if (!filterRoot || !filterRoot.children) {
      return;
    }

    var headerRoot =
      typeof filterRoot.querySelector === "function"
        ? filterRoot.querySelector(HEADER_ROOT_SELECTOR)
        : null;
    var topChildren = filterRoot.children;
    var i;
    var topChild;
    var hasBoundary;

    for (i = 0; i < topChildren.length; i += 1) {
      topChild = topChildren[i];
      hasBoundary = containsHeaderBoundary(topChild, headerRoot);

      if (hasBoundary) {
        if (typeof topChild.setAttribute === "function") {
          topChild.setAttribute(FILTER_SCOPE_SKIP_ATTR, FILTER_SCOPE_SKIP_ATTR_VALUE);
        }
        markFilterTargetsWithin(topChild, headerRoot, 0);
        continue;
      }

      if (typeof topChild.setAttribute === "function") {
        topChild.setAttribute(FILTER_TARGET_ATTR, FILTER_TARGET_ATTR_VALUE);
      }
    }
  }

  function scheduleFilterTargetsRefresh() {
    if (state.filterScopeTick != null) {
      return;
    }

    var run = function () {
      state.filterScopeTick = null;
      refreshFilterTargets();
    };

    if (typeof globalThis.requestAnimationFrame === "function") {
      state.filterScopeTick = globalThis.requestAnimationFrame(run);
      return;
    }

    state.filterScopeTick = globalThis.setTimeout(run, 16);
  }

  function clearFilterTargetsRefreshDelayTimers() {
    var timers = state.filterScopeDelayTimers || [];
    var i;
    for (i = 0; i < timers.length; i += 1) {
      clearTimeout(timers[i]);
    }
    state.filterScopeDelayTimers = [];
  }

  function scheduleFilterTargetsRefreshBurst() {
    var timers = [];
    var i;
    var delayMs;

    clearFilterTargetsRefreshDelayTimers();
    scheduleFilterTargetsRefresh();

    for (i = 0; i < FILTER_TARGET_REFRESH_DELAYS_MS.length; i += 1) {
      delayMs = FILTER_TARGET_REFRESH_DELAYS_MS[i];
      timers.push(globalThis.setTimeout(scheduleFilterTargetsRefresh, delayMs));
    }

    state.filterScopeDelayTimers = timers;
  }

  function setupFilterScopeObserver() {
    if (state.filterScopeObserver || typeof MutationObserver !== "function") {
      return;
    }

    var root = document.body || document.documentElement;
    if (!root) {
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      var i;
      var mutation;
      var shouldRefresh = false;

      for (i = 0; i < mutations.length; i += 1) {
        mutation = mutations[i];
        if (!mutation) {
          continue;
        }

        if (mutation.type === "childList") {
          if (
            (mutation.addedNodes && mutation.addedNodes.length > 0) ||
            (mutation.removedNodes && mutation.removedNodes.length > 0)
          ) {
            shouldRefresh = true;
            break;
          }
          continue;
        }

        if (mutation.type === "attributes") {
          shouldRefresh = true;
          break;
        }
      }

      if (shouldRefresh) {
        scheduleFilterTargetsRefresh();
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "id"]
    });

    state.filterScopeObserver = observer;
  }

  function disconnectFilterScopeObserver() {
    if (state.filterScopeObserver && typeof state.filterScopeObserver.disconnect === "function") {
      state.filterScopeObserver.disconnect();
    }
    state.filterScopeObserver = null;
  }

  function syncFilterScopeObserver(enabled) {
    if (!enabled) {
      disconnectFilterScopeObserver();
      return;
    }

    setupFilterScopeObserver();
  }

  function renderUnavailable(statusMessage) {
    if (!Url.isListingPath(location.pathname)) {
      return;
    }

    var renderToken = state.renderToken + 1;
    state.renderToken = renderToken;

    var mountTarget = resolveMountTarget(document);
    if (!mountTarget || !mountTarget.mountNode) {
      return;
    }

    resolveCurrencyContext().then(function (currencyContext) {
      if (renderToken !== state.renderToken || !Url.isListingPath(location.pathname)) {
        return;
      }

      renderListingInsightsPanel({
        listing: {
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
        },
        metrics: {
          averageDropAmountUsd: null,
          averageDropPercent: null,
          expectedNextDropDays: null,
          expectedDropState: "insufficient_data"
        },
        mountNode: mountTarget.mountNode,
        mountPosition: mountTarget.mountPosition,
        rawListing: null,
        statusMessage: statusMessage,
        currencyContext: currencyContext
      });
      applySidebarCurrency(currencyContext);
      applyCardCurrency(currencyContext);
      syncCardCurrencyObserver(null);
    });
  }

  function scheduleRetry(reason, attempt) {
    if (attempt >= MAX_RETRIES || shouldStopRetryWindow()) {
      log("retry limit reached", {
        reason: reason,
        attempt: attempt
      });
      disconnectHydrationObserver();
      renderUnavailable("Feature unavailable: unable to read listing data.");
      return;
    }

    scheduleHydrationObserver();

    clearRetryTimer(false);
    state.retryTimer = setTimeout(function () {
      run("retry:" + reason, attempt + 1);
    }, RETRY_DELAY_MS);

    log("scheduled retry", {
      reason: reason,
      attempt: attempt
    });
  }

  function run(reason, attempt) {
    if (!Url.isListingPath(location.pathname)) {
      var nonListingToken = state.renderToken + 1;
      state.renderToken = nonListingToken;
      clearRetryTimer(true);
      disconnectHydrationObserver();
      InsightsPanel.removeExistingPanels(document);
      resolveCurrencyContext()
        .then(function (currencyContext) {
          if (nonListingToken !== state.renderToken || Url.isListingPath(location.pathname)) {
            return;
          }

          applyCardCurrency(currencyContext);
          syncCardCurrencyObserver(currencyContext);
        })
        .catch(function () {
          if (nonListingToken !== state.renderToken || Url.isListingPath(location.pathname)) {
            return;
          }

          var fallbackCurrency = createUsdCurrencyContext();
          applyCardCurrency(fallbackCurrency);
          syncCardCurrencyObserver(fallbackCurrency);
        });
      return;
    }

    syncCardCurrencyObserver(null);

    resolveListingInsightsEnabled().then(function (listingInsightsEnabled) {
      if (!Url.isListingPath(location.pathname)) {
        return;
      }

      if (!listingInsightsEnabled) {
        var disabledToken = state.renderToken + 1;
        state.renderToken = disabledToken;
        clearRetryTimer(true);
        disconnectHydrationObserver();
        InsightsPanel.removeExistingPanels(document);

        resolveCurrencyContext()
          .then(function (currencyContext) {
            if (disabledToken !== state.renderToken || !Url.isListingPath(location.pathname)) {
              return;
            }

            applySidebarCurrency(currencyContext);
            applyCardCurrency(currencyContext);
            syncCardCurrencyObserver(null);

            log("skipped_listing_insights_panel", {
              reason: reason,
              attempt: attempt,
              currency: currencyContext.selectedCurrency
            });
          })
          .catch(function () {
            if (disabledToken !== state.renderToken || !Url.isListingPath(location.pathname)) {
              return;
            }

            var fallbackCurrency = createUsdCurrencyContext();
            applySidebarCurrency(fallbackCurrency);
            applyCardCurrency(fallbackCurrency);
            syncCardCurrencyObserver(null);
          });
        return;
      }

      var nextData = ListingExtractor.readNextDataFromDocument(document);
      if (!nextData) {
        scheduleRetry("missing_next_data", attempt);
        return;
      }

      var listing = normalizeListingModel(ListingExtractor.extractListing(nextData));
      if (!listing || !listing.id) {
        scheduleRetry("missing_listing", attempt);
        return;
      }

      var mountTarget = resolveMountTarget(document);
      if (!mountTarget || !mountTarget.mountNode) {
        scheduleRetry("missing_mount", attempt);
        return;
      }

      var metrics = computeListingInsights(listing);
      var renderToken = state.renderToken + 1;
      state.renderToken = renderToken;

      resolveCurrencyContext()
        .then(function (currencyContext) {
          if (renderToken !== state.renderToken || !Url.isListingPath(location.pathname)) {
            return;
          }

          renderListingInsightsPanel({
            listing: listing,
            metrics: metrics,
            mountNode: mountTarget.mountNode,
            mountPosition: mountTarget.mountPosition,
            rawListing: listing.rawListing,
            currencyContext: currencyContext
          });
          applySidebarCurrency(currencyContext);
          applyCardCurrency(currencyContext);
          syncCardCurrencyObserver(null);

          disconnectHydrationObserver();
          state.retryStartedAtMs = null;

          log("rendered", {
            reason: reason,
            attempt: attempt,
            listingId: listing.id,
            currency: currencyContext.selectedCurrency
          });
        })
        .catch(function () {
          if (renderToken !== state.renderToken || !Url.isListingPath(location.pathname)) {
            return;
          }

          var fallbackCurrency = createUsdCurrencyContext();
          renderListingInsightsPanel({
            listing: listing,
            metrics: metrics,
            mountNode: mountTarget.mountNode,
            mountPosition: mountTarget.mountPosition,
            rawListing: listing.rawListing,
            currencyContext: fallbackCurrency
          });
          applySidebarCurrency(fallbackCurrency);
          applyCardCurrency(fallbackCurrency);
          syncCardCurrencyObserver(null);

          disconnectHydrationObserver();
          state.retryStartedAtMs = null;

          log("rendered_with_currency_fallback", {
            reason: reason,
            attempt: attempt,
            listingId: listing.id
          });
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

  function patchHistoryMethod(methodName) {
    var original = history[methodName];
    if (typeof original !== "function") {
      return;
    }

    history[methodName] = function () {
      var result = original.apply(this, arguments);
      window.dispatchEvent(new Event("grailed-plus:navigation"));
      return result;
    };
  }

  function setupNavigationListeners() {
    patchHistoryMethod("pushState");
    patchHistoryMethod("replaceState");

    window.addEventListener("grailed-plus:navigation", function () {
      onNavigation("history");
    });

    window.addEventListener("popstate", function () {
      onNavigation("popstate");
    });

    state.urlPollTimer = setInterval(function () {
      if (location.href !== state.lastUrl) {
        onNavigation("url_poll");
      }
    }, URL_POLL_INTERVAL_MS);
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
