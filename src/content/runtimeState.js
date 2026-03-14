(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusContentRuntime = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createRuntimeState() {
    return {
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
  }

  function clearRetryTimer(state, resetWindow) {
    if (!state || typeof state !== "object") {
      return;
    }

    if (state.retryTimer) {
      clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }

    if (resetWindow) {
      state.retryStartedAtMs = null;
    }
  }

  function shouldStopRetryWindow(state, maxRetryWindowMs) {
    if (!state || typeof state !== "object") {
      return true;
    }

    if (state.retryStartedAtMs == null) {
      state.retryStartedAtMs = Date.now();
      return false;
    }

    return Date.now() - state.retryStartedAtMs > maxRetryWindowMs;
  }

  function scheduleHydrationObserver(options) {
    if (!options || typeof options !== "object") {
      return;
    }

    var state = options.state;
    if (!state || typeof state !== "object") {
      return;
    }

    if (typeof MutationObserver !== "function") {
      return;
    }

    if (state.mutationObserver) {
      return;
    }

    var isListingPath =
      typeof options.isListingPath === "function" ? options.isListingPath : function () {
        return false;
      };
    var getPathname =
      typeof options.getPathname === "function" ? options.getPathname : function () {
        return "";
      };
    var getNextDataNode =
      typeof options.getNextDataNode === "function"
        ? options.getNextDataNode
        : function () {
            return null;
          };
    var onHydrated =
      typeof options.onHydrated === "function"
        ? options.onHydrated
        : function () {};
    var log = typeof options.log === "function" ? options.log : null;

    var obs = new MutationObserver(function () {
      if (!isListingPath(getPathname())) {
        return;
      }

      var nextDataNode = getNextDataNode();
      if (nextDataNode && nextDataNode.textContent) {
        if (log) {
          log("hydration observer detected next data");
        }
        onHydrated();
      }
    });

    obs.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });

    state.mutationObserver = obs;
  }

  function disconnectHydrationObserver(state) {
    if (!state || typeof state !== "object") {
      return;
    }

    if (state.mutationObserver && typeof state.mutationObserver.disconnect === "function") {
      state.mutationObserver.disconnect();
    }
    state.mutationObserver = null;
  }

  return {
    createRuntimeState: createRuntimeState,
    clearRetryTimer: clearRetryTimer,
    shouldStopRetryWindow: shouldStopRetryWindow,
    scheduleHydrationObserver: scheduleHydrationObserver,
    disconnectHydrationObserver: disconnectHydrationObserver
  };
});
