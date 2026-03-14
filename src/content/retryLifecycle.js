(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusRetryLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function scheduleRetry(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var attempt = Number.isFinite(Number(config.attempt)) ? Number(config.attempt) : 0;
    var reason = typeof config.reason === "string" ? config.reason : "unknown";
    var maxRetries = Number.isFinite(Number(config.maxRetries)) ? Number(config.maxRetries) : 0;
    var retryDelayMs = Number.isFinite(Number(config.retryDelayMs)) ? Number(config.retryDelayMs) : 0;
    var shouldStopRetryWindow =
      typeof config.shouldStopRetryWindow === "function"
        ? config.shouldStopRetryWindow
        : function () {
            return false;
          };
    var log = typeof config.log === "function" ? config.log : function () {};
    var disconnectHydrationObserver =
      typeof config.disconnectHydrationObserver === "function"
        ? config.disconnectHydrationObserver
        : function () {};
    var renderUnavailable =
      typeof config.renderUnavailable === "function" ? config.renderUnavailable : function () {};
    var scheduleHydrationObserver =
      typeof config.scheduleHydrationObserver === "function"
        ? config.scheduleHydrationObserver
        : function () {};
    var clearRetryTimer =
      typeof config.clearRetryTimer === "function" ? config.clearRetryTimer : function () {};
    var run = typeof config.run === "function" ? config.run : function () {};

    if (!state || typeof state !== "object") {
      return;
    }

    if (attempt >= maxRetries || shouldStopRetryWindow()) {
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
    }, retryDelayMs);

    log("scheduled retry", {
      reason: reason,
      attempt: attempt
    });
  }

  return {
    scheduleRetry: scheduleRetry
  };
});
