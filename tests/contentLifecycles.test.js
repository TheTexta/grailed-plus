"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { scheduleRetry } = require("../.tmp/ts-build/src/content/retryLifecycle");
const {
  handleNonListingRoute,
  handleListingInsightsDisabled
} = require("../.tmp/ts-build/src/content/runLifecycle");
const { prepareListingRenderContext } = require("../.tmp/ts-build/src/content/listingPipelineLifecycle");
const { renderListingWithCurrency } = require("../.tmp/ts-build/src/content/listingRenderLifecycle");
const { renderUnavailable } = require("../.tmp/ts-build/src/content/unavailableLifecycle");

function waitForAsyncTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("retry lifecycle renders unavailable when retry budget is exhausted", () => {
  const state = {};
  const calls = {
    disconnected: false,
    unavailableMessage: null,
    scheduledHydration: false
  };

  scheduleRetry({
    state,
    reason: "missing_next_data",
    attempt: 3,
    maxRetries: 3,
    retryDelayMs: 0,
    shouldStopRetryWindow: () => false,
    disconnectHydrationObserver: () => {
      calls.disconnected = true;
    },
    renderUnavailable: (message) => {
      calls.unavailableMessage = message;
    },
    scheduleHydrationObserver: () => {
      calls.scheduledHydration = true;
    }
  });

  assert.equal(calls.disconnected, true);
  assert.equal(calls.unavailableMessage, "Feature unavailable: unable to read listing data.");
  assert.equal(calls.scheduledHydration, false);
});

test("retry lifecycle schedules next run inside retry window", async () => {
  const state = {};
  let clearRetryTimerArg = null;
  let runArgs = null;
  let hydrationScheduled = false;

  scheduleRetry({
    state,
    reason: "missing_mount",
    attempt: 0,
    maxRetries: 5,
    retryDelayMs: 0,
    shouldStopRetryWindow: () => false,
    scheduleHydrationObserver: () => {
      hydrationScheduled = true;
    },
    clearRetryTimer: (resetWindow) => {
      clearRetryTimerArg = resetWindow;
    },
    run: (reason, attempt) => {
      runArgs = [reason, attempt];
    }
  });

  await waitForAsyncTick();

  assert.equal(hydrationScheduled, true);
  assert.equal(clearRetryTimerArg, false);
  assert.deepEqual(runArgs, ["retry:missing_mount", 1]);
});

test("run lifecycle handles non-listing route currency sync", async () => {
  const state = {
    renderToken: 0,
    latestPanelContext: { id: "stale" }
  };
  const calls = {
    clearedRetry: null,
    disconnectedHydration: false,
    removedPanels: false,
    appliedCurrency: null,
    syncedCurrency: null
  };

  const handled = handleNonListingRoute({
    state,
    urlApi: {
      isListingPath: () => false
    },
    locationObj: {
      pathname: "/feed"
    },
    documentObj: {},
    clearRetryTimer: (resetWindow) => {
      calls.clearedRetry = resetWindow;
    },
    disconnectHydrationObserver: () => {
      calls.disconnectedHydration = true;
    },
    insightsPanel: {
      removeExistingPanels: () => {
        calls.removedPanels = true;
      }
    },
    resolveCurrencyContext: () => Promise.resolve({ selectedCurrency: "EUR" }),
    applyCardCurrency: (currency) => {
      calls.appliedCurrency = currency;
    },
    syncCardCurrencyObserver: (currency) => {
      calls.syncedCurrency = currency;
    }
  });

  await waitForAsyncTick();

  assert.equal(handled, true);
  assert.equal(state.renderToken, 1);
  assert.equal(state.latestPanelContext, null);
  assert.equal(calls.clearedRetry, true);
  assert.equal(calls.disconnectedHydration, true);
  assert.equal(calls.removedPanels, true);
  assert.deepEqual(calls.appliedCurrency, { selectedCurrency: "EUR" });
  assert.deepEqual(calls.syncedCurrency, { selectedCurrency: "EUR" });
});

test("run lifecycle handles listing-insights-disabled branch", async () => {
  const state = {
    renderToken: 4,
    latestPanelContext: { id: "stale" }
  };
  const calls = {
    removedPanels: false,
    sidebarCurrency: null,
    cardCurrency: null,
    syncedCurrency: null,
    logs: []
  };

  const handled = handleListingInsightsDisabled({
    state,
    listingInsightsEnabled: false,
    urlApi: {
      isListingPath: () => true
    },
    locationObj: {
      pathname: "/listings/123"
    },
    documentObj: {},
    clearRetryTimer: () => {},
    disconnectHydrationObserver: () => {},
    insightsPanel: {
      removeExistingPanels: () => {
        calls.removedPanels = true;
      }
    },
    resolveCurrencyContext: () => Promise.resolve({ selectedCurrency: "JPY" }),
    applySidebarCurrency: (currency) => {
      calls.sidebarCurrency = currency;
    },
    applyCardCurrency: (currency) => {
      calls.cardCurrency = currency;
    },
    syncCardCurrencyObserver: (currency) => {
      calls.syncedCurrency = currency;
    },
    log: (event, payload) => {
      calls.logs.push([event, payload]);
    },
    reason: "initial",
    attempt: 0
  });

  await waitForAsyncTick();

  assert.equal(handled, true);
  assert.equal(state.renderToken, 5);
  assert.equal(state.latestPanelContext, null);
  assert.equal(calls.removedPanels, true);
  assert.deepEqual(calls.sidebarCurrency, { selectedCurrency: "JPY" });
  assert.deepEqual(calls.cardCurrency, { selectedCurrency: "JPY" });
  assert.deepEqual(calls.syncedCurrency, { selectedCurrency: "JPY" });
  assert.equal(calls.logs[0][0], "skipped_listing_insights_panel");
});

test("listing pipeline lifecycle prepares render context", () => {
  const state = {
    renderToken: 10
  };

  const context = prepareListingRenderContext({
    state,
    listingExtractor: {
      readNextDataFromDocument: () => ({ listing: "raw" }),
      extractListing: () => ({ id: 42, rawListing: { id: 42 } })
    },
    documentObj: {},
    normalizeListingModel: (listing) => listing,
    resolveMountTarget: () => ({ mountNode: { id: "anchor" }, mountPosition: "afterend" }),
    computeListingInsights: () => ({ expectedDropState: "insufficient_data" }),
    scheduleRetry: () => {
      throw new Error("should not retry in success case");
    },
    attempt: 0
  });

  assert.equal(state.renderToken, 11);
  assert.equal(context.renderToken, 11);
  assert.equal(context.listing.id, 42);
  assert.equal(context.mountTarget.mountPosition, "afterend");
  assert.equal(context.metrics.expectedDropState, "insufficient_data");
});

test("listing pipeline lifecycle schedules retry when next data is missing", () => {
  const retries = [];

  const context = prepareListingRenderContext({
    state: {
      renderToken: 0
    },
    listingExtractor: {
      readNextDataFromDocument: () => null
    },
    documentObj: {},
    scheduleRetry: (reason, attempt) => {
      retries.push([reason, attempt]);
    },
    attempt: 2
  });

  assert.equal(context, null);
  assert.deepEqual(retries, [["missing_next_data", 2]]);
});

test("listing render lifecycle renders with resolved currency", async () => {
  const state = {
    renderToken: 3,
    retryStartedAtMs: 999
  };
  const calls = {
    renderedOptions: null,
    sidebarCurrency: null,
    cardCurrency: null,
    syncedCurrency: null,
    disconnectedHydration: false,
    logs: []
  };

  renderListingWithCurrency({
    state,
    urlApi: {
      isListingPath: () => true
    },
    locationObj: {
      pathname: "/listings/3"
    },
    renderToken: 3,
    listing: {
      id: 3,
      rawListing: { id: 3 }
    },
    metrics: {
      totalDrops: 1
    },
    mountTarget: {
      mountNode: { id: "mount" },
      mountPosition: "afterend"
    },
    resolveCurrencyContext: () => Promise.resolve({ selectedCurrency: "EUR", rate: 0.9 }),
    renderPanelWithMarketCompare: (options) => {
      calls.renderedOptions = options;
    },
    applySidebarCurrency: (currency) => {
      calls.sidebarCurrency = currency;
    },
    applyCardCurrency: (currency) => {
      calls.cardCurrency = currency;
    },
    syncCardCurrencyObserver: (currency) => {
      calls.syncedCurrency = currency;
    },
    disconnectHydrationObserver: () => {
      calls.disconnectedHydration = true;
    },
    log: (event, payload) => {
      calls.logs.push([event, payload]);
    },
    reason: "initial",
    attempt: 0
  });

  await waitForAsyncTick();

  assert.equal(calls.renderedOptions.listing.id, 3);
  assert.equal(calls.renderedOptions.mountPosition, "afterend");
  assert.deepEqual(calls.sidebarCurrency, { selectedCurrency: "EUR", rate: 0.9 });
  assert.deepEqual(calls.cardCurrency, { selectedCurrency: "EUR", rate: 0.9 });
  assert.deepEqual(calls.syncedCurrency, { selectedCurrency: "EUR", rate: 0.9 });
  assert.equal(calls.disconnectedHydration, true);
  assert.equal(state.retryStartedAtMs, null);
  assert.equal(calls.logs[0][0], "rendered");
});

test("listing render lifecycle uses USD fallback when currency resolution fails", async () => {
  const state = {
    renderToken: 2,
    retryStartedAtMs: 50
  };
  const calls = {
    renderedOptions: null,
    logs: []
  };

  renderListingWithCurrency({
    state,
    urlApi: {
      isListingPath: () => true
    },
    locationObj: {
      pathname: "/listings/2"
    },
    renderToken: 2,
    listing: {
      id: 2
    },
    metrics: {},
    mountTarget: {
      mountNode: { id: "mount" },
      mountPosition: "afterend"
    },
    resolveCurrencyContext: () => Promise.reject(new Error("no rates")),
    createUsdCurrencyContext: () => ({ selectedCurrency: "USD", rate: null, mode: "dual" }),
    renderPanelWithMarketCompare: (options) => {
      calls.renderedOptions = options;
    },
    applySidebarCurrency: () => {},
    applyCardCurrency: () => {},
    syncCardCurrencyObserver: () => {},
    disconnectHydrationObserver: () => {},
    log: (event, payload) => {
      calls.logs.push([event, payload]);
    },
    reason: "retry",
    attempt: 1
  });

  await waitForAsyncTick();

  assert.equal(calls.renderedOptions.currencyContext.selectedCurrency, "USD");
  assert.equal(state.retryStartedAtMs, null);
  assert.equal(calls.logs[0][0], "rendered_with_currency_fallback");
});

test("unavailable lifecycle renders unavailable panel on listing routes", async () => {
  const state = {
    renderToken: 0
  };
  const calls = {
    renderedOptions: null,
    sidebarCurrency: null,
    cardCurrency: null,
    syncedCurrency: null
  };

  renderUnavailable({
    state,
    urlApi: {
      isListingPath: () => true
    },
    locationObj: {
      pathname: "/listings/999"
    },
    documentObj: {},
    resolveMountTarget: () => ({ mountNode: { id: "mount" }, mountPosition: "afterend" }),
    resolveCurrencyContext: () => Promise.resolve({ selectedCurrency: "USD", rate: null }),
    renderPanelWithMarketCompare: (options) => {
      calls.renderedOptions = options;
    },
    applySidebarCurrency: (currency) => {
      calls.sidebarCurrency = currency;
    },
    applyCardCurrency: (currency) => {
      calls.cardCurrency = currency;
    },
    syncCardCurrencyObserver: (currency) => {
      calls.syncedCurrency = currency;
    },
    statusMessage: "Feature unavailable"
  });

  await waitForAsyncTick();

  assert.equal(state.renderToken, 1);
  assert.equal(calls.renderedOptions.listing.id, "unknown");
  assert.equal(calls.renderedOptions.statusMessage, "Feature unavailable");
  assert.deepEqual(calls.sidebarCurrency, { selectedCurrency: "USD", rate: null });
  assert.deepEqual(calls.cardCurrency, { selectedCurrency: "USD", rate: null });
  assert.deepEqual(calls.syncedCurrency, { selectedCurrency: "USD", rate: null });
});
