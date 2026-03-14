interface UUnavailableListing {
  id: string;
  title: string;
  createdAt: string | null;
  pricing: {
    history: unknown[];
    updatedAt: string | null;
  };
  seller: {
    createdAt: string | null;
  };
  rawListing: null;
}

interface UUnavailableMetrics {
  averageDropAmountUsd: number | null;
  averageDropPercent: number | null;
  expectedNextDropDays: number | null;
  expectedDropState: string;
}

interface UMountTarget {
  mountNode: Element | null;
  mountPosition?: string;
}

interface URenderUnavailableOptions {
  state?: {
    renderToken: number;
  } | null;
  urlApi?: {
    isListingPath?: (pathname: string) => boolean;
  } | null;
  locationObj?: {
    pathname?: string;
  } | null;
  documentObj?: Document | null;
  resolveMountTarget?: ((documentObj?: Document | null) => UMountTarget | null) | null;
  resolveCurrencyContext?: (() => Promise<any>) | null;
  renderPanelWithMarketCompare?:
    | ((options: {
        listing: UUnavailableListing;
        metrics: UUnavailableMetrics;
        mountNode: Element;
        mountPosition?: string;
        rawListing: null;
        statusMessage: string;
        currencyContext: any;
      }) => void)
    | null;
  applySidebarCurrency?: ((currencyContext: any) => void) | null;
  applyCardCurrency?: ((currencyContext: any) => void) | null;
  syncCardCurrencyObserver?: ((currencyContext: any) => void) | null;
  statusMessage?: string;
}

interface UUnavailableLifecycleModule {
  renderUnavailable: (options: URenderUnavailableOptions | null | undefined) => void;
}

interface UUnavailableGlobal {
  GrailedPlusUnavailableLifecycle?: UUnavailableLifecycleModule;
}

(function (root: UUnavailableGlobal, factory: () => UUnavailableLifecycleModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusUnavailableLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as UUnavailableGlobal) : {}, function () {
  "use strict";

  function createUnavailableListing(): UUnavailableListing {
    return {
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
    };
  }

  function createUnavailableMetrics(): UUnavailableMetrics {
    return {
      averageDropAmountUsd: null,
      averageDropPercent: null,
      expectedNextDropDays: null,
      expectedDropState: "insufficient_data"
    };
  }

  function renderUnavailable(options: URenderUnavailableOptions | null | undefined): void {
    var config = options && typeof options === "object" ? options : ({} as URenderUnavailableOptions);
    var state = config.state;
    var urlApi = config.urlApi;
    var locationObj = config.locationObj;
    var documentObj = config.documentObj;
    var resolveMountTarget =
      typeof config.resolveMountTarget === "function" ? config.resolveMountTarget : function () {
        return null;
      };
    var resolveCurrencyContext =
      typeof config.resolveCurrencyContext === "function"
        ? config.resolveCurrencyContext
        : function () {
            return Promise.resolve(null);
          };
    var renderPanelWithMarketCompare =
      typeof config.renderPanelWithMarketCompare === "function"
        ? config.renderPanelWithMarketCompare
        : function () {};
    var applySidebarCurrency =
      typeof config.applySidebarCurrency === "function" ? config.applySidebarCurrency : function () {};
    var applyCardCurrency =
      typeof config.applyCardCurrency === "function" ? config.applyCardCurrency : function () {};
    var syncCardCurrencyObserver =
      typeof config.syncCardCurrencyObserver === "function"
        ? config.syncCardCurrencyObserver
        : function () {};
    var statusMessage = typeof config.statusMessage === "string" ? config.statusMessage : "";

    if (!state || typeof state !== "object") {
      return;
    }

    var pathname = locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
    if (!urlApi || typeof urlApi.isListingPath !== "function" || !urlApi.isListingPath(pathname)) {
      return;
    }

    var renderToken = state.renderToken + 1;
    state.renderToken = renderToken;

    var mountTarget = resolveMountTarget(documentObj);
    if (!mountTarget || !mountTarget.mountNode) {
      return;
    }

    var safeState = state;
    var isListingPath = urlApi.isListingPath;
    var resolvedMountTarget = mountTarget;
    var mountNode = resolvedMountTarget.mountNode;
    if (!mountNode) {
      return;
    }

    resolveCurrencyContext().then(function (currencyContext) {
      var latestPathname = locationObj && typeof locationObj.pathname === "string" ? locationObj.pathname : "";
      if (renderToken !== safeState.renderToken || !isListingPath(latestPathname)) {
        return;
      }

      renderPanelWithMarketCompare({
        listing: createUnavailableListing(),
        metrics: createUnavailableMetrics(),
        mountNode: mountNode as Element,
        mountPosition: resolvedMountTarget.mountPosition,
        rawListing: null,
        statusMessage: statusMessage,
        currencyContext: currencyContext
      });
      applySidebarCurrency(currencyContext);
      applyCardCurrency(currencyContext);
      syncCardCurrencyObserver(currencyContext);
    });
  }

  return {
    renderUnavailable: renderUnavailable
  };
});
