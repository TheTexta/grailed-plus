(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusNavigationLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function patchHistoryMethod(historyApi, methodName, dispatchNavigationEvent) {
    if (!historyApi || typeof historyApi[methodName] !== "function") {
      return;
    }

    var original = historyApi[methodName];
    historyApi[methodName] = function () {
      var result = original.apply(this, arguments);
      dispatchNavigationEvent();
      return result;
    };
  }

  function setupNavigationListeners(options) {
    var config = options && typeof options === "object" ? options : {};
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
