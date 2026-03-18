interface CRuntimeState {
  lastUrl: string;
  retryTimer: ReturnType<typeof setTimeout> | null;
  urlPollTimer: ReturnType<typeof setTimeout> | null;
  retryStartedAtMs: number | null;
  mutationObserver: MutationObserver | null;
  renderToken: number;
  darkModeToken: number;
  darkModeMediaQuery: MediaQueryList | null;
  darkModeMediaListener: ((event: MediaQueryListEvent) => void) | null;
  filterScopeTick: number | null;
  filterScopeDelayTimers: Array<number | ReturnType<typeof setTimeout>>;
  filterScopeObserver: MutationObserver | null;
  cardCurrencyObserver: MutationObserver | null;
  cardCurrencyTick: number | null;
  cardCurrencyTickUsesAnimationFrame: boolean;
  cardCurrencyContext: unknown;
  marketCompareController: unknown;
  marketCompareUnsubscribe: (() => void) | null;
  marketCompareAutoSearchRenderToken: number | null;
  latestPanelContext: unknown;
}

interface CHydrationObserverOptions {
  state: CRuntimeState;
  isListingPath?: (pathname: string) => boolean;
  getPathname?: () => string;
  getNextDataNode?: () => Element | null;
  onHydrated?: () => void;
  log?: (message: string) => void;
}

interface CContentRuntimeModule {
  createRuntimeState: () => CRuntimeState;
  clearRetryTimer: (state: CRuntimeState | null | undefined, resetWindow?: boolean) => void;
  shouldStopRetryWindow: (
    state: CRuntimeState | null | undefined,
    maxRetryWindowMs: number
  ) => boolean;
  scheduleHydrationObserver: (options: CHydrationObserverOptions | null | undefined) => void;
  disconnectHydrationObserver: (state: CRuntimeState | null | undefined) => void;
}

interface CContentRuntimeGlobal {
  GrailedPlusContentRuntime?: CContentRuntimeModule;
}

(function (root: CContentRuntimeGlobal, factory: () => CContentRuntimeModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusContentRuntime = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as CContentRuntimeGlobal) : {}, function () {
  "use strict";

  function createRuntimeState(): CRuntimeState {
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
      marketCompareAutoSearchRenderToken: null,
      latestPanelContext: null
    };
  }

  function clearRetryTimer(state: CRuntimeState | null | undefined, resetWindow?: boolean): void {
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

  function shouldStopRetryWindow(
    state: CRuntimeState | null | undefined,
    maxRetryWindowMs: number
  ): boolean {
    if (!state || typeof state !== "object") {
      return true;
    }

    if (state.retryStartedAtMs == null) {
      state.retryStartedAtMs = Date.now();
      return false;
    }

    return Date.now() - state.retryStartedAtMs > maxRetryWindowMs;
  }

  function scheduleHydrationObserver(options: CHydrationObserverOptions | null | undefined): void {
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

  function disconnectHydrationObserver(state: CRuntimeState | null | undefined): void {
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
