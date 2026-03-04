(function () {
  "use strict";

  if (globalThis.__grailedPlusBooted) {
    return;
  }
  globalThis.__grailedPlusBooted = true;

  var Url = globalThis.GrailedPlusUrl;
  var Extract = globalThis.GrailedPlusExtractListing;
  var Metrics = globalThis.GrailedPlusMetrics;
  var Render = globalThis.GrailedPlusRender;

  if (!Url || !Extract || !Metrics || !Render) {
    console.error("[Grailed+] Failed to initialize: missing modules");
    return;
  }

  var MAX_RETRIES = 12;
  var RETRY_DELAY_MS = 500;
  var MAX_RETRY_WINDOW_MS = 15000;
  var URL_POLL_INTERVAL_MS = 1000;

  var state = {
    lastUrl: String(location.href),
    retryTimer: null,
    urlPollTimer: null,
    retryStartedAtMs: null,
    mutationObserver: null
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
    if (!Render) {
      return null;
    }

    if (typeof Render.findMountTarget === "function") {
      return Render.findMountTarget(doc);
    }

    if (typeof Render.findMountNode === "function") {
      var legacyMountNode = Render.findMountNode(doc);
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

  function renderUnavailable(statusMessage) {
    if (!Url.isListingPath(location.pathname)) {
      return;
    }

    var mountTarget = resolveMountTarget(document);
    if (!mountTarget || !mountTarget.mountNode) {
      return;
    }

    Render.renderPanel({
      listing: {
        id: "unknown",
        title: "",
        priceDrops: [],
        createdAt: null,
        priceUpdatedAt: null,
        seller: {
          createdAt: null
        },
        rawListing: null
      },
      metrics: {
        avgDropAmount: null,
        avgDropPercent: null,
        expectedDropDays: null,
        expectedDropState: "insufficient_data"
      },
      mountNode: mountTarget.mountNode,
      mountPosition: mountTarget.mountPosition,
      rawListing: null,
      statusMessage: statusMessage
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
      clearRetryTimer(true);
      disconnectHydrationObserver();
      Render.removeExistingPanels(document);
      return;
    }

    var nextData = Extract.readNextDataFromDocument(document);
    if (!nextData) {
      scheduleRetry("missing_next_data", attempt);
      return;
    }

    var listing = Extract.extractListing(nextData);
    if (!listing || !listing.id) {
      scheduleRetry("missing_listing", attempt);
      return;
    }

    var mountTarget = resolveMountTarget(document);
    if (!mountTarget || !mountTarget.mountNode) {
      scheduleRetry("missing_mount", attempt);
      return;
    }

    var metrics = Metrics.computeMetrics(listing);
    Render.renderPanel({
      listing: listing,
      metrics: metrics,
      mountNode: mountTarget.mountNode,
      mountPosition: mountTarget.mountPosition,
      rawListing: listing.rawListing
    });

    disconnectHydrationObserver();
    state.retryStartedAtMs = null;

    log("rendered", {
      reason: reason,
      attempt: attempt,
      listingId: listing.id
    });
  }

  function refresh(reason) {
    clearRetryTimer(true);
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
