interface CNavigationState {
  lastUrl: string;
  urlPollTimer: ReturnType<typeof setInterval> | null;
}

interface CNavigationOptions {
  state: CNavigationState;
  onNavigation?: (source: "history" | "popstate" | "url_poll") => void;
  pollIntervalMs?: number;
  history?: History;
  window?: Window;
  location?: Location;
  eventName?: string;
}

interface CNavigationLifecycleModule {
  patchHistoryMethod: (
    historyApi: History | null | undefined,
    methodName: "pushState" | "replaceState",
    dispatchNavigationEvent: () => void
  ) => void;
  setupNavigationListeners: (options: CNavigationOptions) => void;
}

interface CNavigationGlobal {
  GrailedPlusNavigationLifecycle?: CNavigationLifecycleModule;
}

(function (root: CNavigationGlobal, factory: () => CNavigationLifecycleModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusNavigationLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as CNavigationGlobal) : {}, function () {
  "use strict";

  function patchHistoryMethod(
    historyApi: History | null | undefined,
    methodName: "pushState" | "replaceState",
    dispatchNavigationEvent: () => void
  ): void {
    if (!historyApi || typeof historyApi[methodName] !== "function") {
      return;
    }

    var original = historyApi[methodName];
    historyApi[methodName] = function (this: any) {
      var args = Array.prototype.slice.call(arguments) as unknown[];
      var result = (original as (...args: unknown[]) => unknown).apply(this, args);
      dispatchNavigationEvent();
      return result;
    } as History["pushState"];
  }

  function setupNavigationListeners(options: CNavigationOptions): void {
    var config = options && typeof options === "object" ? options : ({} as CNavigationOptions);
    var state = config.state;
    var onNavigation =
      typeof config.onNavigation === "function" ? config.onNavigation : function () {};
    var pollIntervalMs = Number(config.pollIntervalMs);
    var historyApi = config.history || history;
    var windowApi = config.window || window;
    var locationApi = config.location || location;
    var eventName =
      typeof config.eventName === "string" && config.eventName.trim()
        ? config.eventName.trim()
        : "grailed-plus:navigation";

    if (!state || typeof state !== "object") {
      return;
    }

    if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
      pollIntervalMs = 1000;
    }

    var dispatchNavigationEvent = function () {
      if (!windowApi || typeof windowApi.dispatchEvent !== "function") {
        return;
      }

      try {
        windowApi.dispatchEvent(new Event(eventName));
      } catch (_) {
        // Ignore environments that cannot construct Event directly.
      }
    };

    patchHistoryMethod(historyApi, "pushState", dispatchNavigationEvent);
    patchHistoryMethod(historyApi, "replaceState", dispatchNavigationEvent);

    windowApi.addEventListener(eventName, function () {
      onNavigation("history");
    });

    windowApi.addEventListener("popstate", function () {
      onNavigation("popstate");
    });

    state.urlPollTimer = setInterval(function () {
      if (locationApi.href !== state.lastUrl) {
        onNavigation("url_poll");
      }
    }, pollIntervalMs);
  }

  return {
    patchHistoryMethod: patchHistoryMethod,
    setupNavigationListeners: setupNavigationListeners
  };
});
