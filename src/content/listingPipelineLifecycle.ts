interface CListingPipelineState {
  renderToken: number;
}

interface CListingExtractor {
  readNextDataFromDocument: (doc: Document | null | undefined) => unknown;
  extractListing: (rawNextData: unknown) => unknown;
}

interface CListingMountTarget {
  mountNode: Node | null;
  mountPosition?: "beforebegin" | "afterend";
}

interface CPreparedListingRenderContext {
  listing: any;
  metrics: any;
  mountTarget: CListingMountTarget;
  renderToken: number;
}

interface CListingPipelineOptions {
  state: CListingPipelineState;
  listingExtractor: CListingExtractor;
  documentObj?: Document | null;
  normalizeListingModel?: (value: unknown) => any;
  resolveMountTarget?: (doc: Document | null | undefined) => CListingMountTarget | null;
  computeListingInsights?: (listing: any) => any;
  scheduleRetry?: (reason: string, attempt: number) => void;
  attempt?: number;
}

interface CListingPipelineLifecycleModule {
  prepareListingRenderContext: (
    options: CListingPipelineOptions | null | undefined
  ) => CPreparedListingRenderContext | null;
}

interface CListingPipelineGlobal {
  GrailedPlusListingPipelineLifecycle?: CListingPipelineLifecycleModule;
}

(function (root: CListingPipelineGlobal, factory: () => CListingPipelineLifecycleModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusListingPipelineLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as CListingPipelineGlobal) : {}, function () {
  "use strict";

  function prepareListingRenderContext(
    options: CListingPipelineOptions | null | undefined
  ): CPreparedListingRenderContext | null {
    var config = options && typeof options === "object" ? options : ({} as CListingPipelineOptions);
    var state = config.state;
    var listingExtractor = config.listingExtractor;
    var documentObj = config.documentObj;
    var normalizeListingModel =
      typeof config.normalizeListingModel === "function"
        ? config.normalizeListingModel
        : function (value: unknown) {
            return value;
          };
    var resolveMountTarget =
      typeof config.resolveMountTarget === "function"
        ? config.resolveMountTarget
        : function () {
            return null;
          };
    var computeListingInsights =
      typeof config.computeListingInsights === "function"
        ? config.computeListingInsights
        : function () {
            return null;
          };
    var scheduleRetry =
      typeof config.scheduleRetry === "function" ? config.scheduleRetry : function () {};
    var attempt = Number.isFinite(Number(config.attempt)) ? Number(config.attempt) : 0;

    if (!state || typeof state !== "object") {
      return null;
    }

    if (!listingExtractor || typeof listingExtractor.readNextDataFromDocument !== "function") {
      return null;
    }

    var nextData = listingExtractor.readNextDataFromDocument(documentObj);
    if (!nextData) {
      scheduleRetry("missing_next_data", attempt);
      return null;
    }

    var listing = normalizeListingModel(listingExtractor.extractListing(nextData));
    if (!listing || !listing.id) {
      scheduleRetry("missing_listing", attempt);
      return null;
    }

    var mountTarget = resolveMountTarget(documentObj);
    if (!mountTarget || !mountTarget.mountNode) {
      scheduleRetry("missing_mount", attempt);
      return null;
    }

    var metrics = computeListingInsights(listing);
    var renderToken = state.renderToken + 1;
    state.renderToken = renderToken;

    return {
      listing: listing,
      metrics: metrics,
      mountTarget: mountTarget,
      renderToken: renderToken
    };
  }

  return {
    prepareListingRenderContext: prepareListingRenderContext
  };
});
