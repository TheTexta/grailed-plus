interface CRetryState {
  retryTimer: ReturnType<typeof setTimeout> | null;
}

interface CRetryScheduleOptions {
  state: CRetryState;
  attempt?: number;
  reason?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  shouldStopRetryWindow?: () => boolean;
  log?: (message: string, details?: Record<string, unknown>) => void;
  disconnectHydrationObserver?: () => void;
  renderUnavailable?: (message: string) => void;
  scheduleHydrationObserver?: () => void;
  clearRetryTimer?: (resetWindow: boolean) => void;
  run?: (source: string, attempt: number) => void;
}

interface CRetryLifecycleModule {
  scheduleRetry: (options: CRetryScheduleOptions | null | undefined) => void;
}

interface CRetryGlobal {
  GrailedPlusRetryLifecycle?: CRetryLifecycleModule;
}

(function (root: CRetryGlobal, factory: () => CRetryLifecycleModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusRetryLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as CRetryGlobal) : {}, function () {
  "use strict";

  function scheduleRetry(options: CRetryScheduleOptions | null | undefined): void {
    var config = options && typeof options === "object" ? options : ({} as CRetryScheduleOptions);
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
