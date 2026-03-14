interface CListingPricing {
  history: unknown[];
  updatedAt: string | null;
}

interface CListingSeller {
  createdAt: string | null;
}

interface CListingModel {
  id: string | number | null;
  title: string;
  createdAt: string | null;
  pricing: CListingPricing;
  seller: CListingSeller;
  prettyPath: string | null;
  sold: boolean;
  rawListing: unknown;
  sourceStatus: string;
}

interface CMountTarget {
  mountNode: Node | null;
  mountPosition?: "beforebegin" | "afterend";
  strategy?: string;
}

interface CInsightsPanelLike {
  findMountTarget?: (doc: Document | null | undefined) => CMountTarget | null;
  findMountNode?: (doc: Document | null | undefined) => Node | null;
  renderInsightsPanel?: (options: any) => unknown;
  renderPanel?: (options: any) => unknown;
}

interface CPricingInsightsLike {
  computePricingInsights?: (listing: CListingModel) => any;
  computeMetrics?: (options: {
    priceDrops: unknown[];
    createdAt: string | null;
    priceUpdatedAt: string | null;
  }) => any;
}

interface CSettingsLike {
  DEFAULT_LISTING_INSIGHTS_ENABLED?: boolean;
  getListingInsightsEnabled?: () => Promise<boolean | unknown>;
}

interface CListingInsightsLifecycleModule {
  createDefaultListingModel: () => CListingModel;
  resolveMountTarget: (
    insightsPanel: CInsightsPanelLike | null | undefined,
    doc: Document | null | undefined
  ) => CMountTarget | null;
  normalizeListingModel: (listing: any) => CListingModel;
  computeListingInsights: (options: {
    listing: CListingModel;
    pricingInsights: CPricingInsightsLike | null | undefined;
  }) => any;
  renderListingInsightsPanel: (options: {
    insightsPanel: CInsightsPanelLike | null | undefined;
    panelOptions: any;
  }) => unknown;
  resolveListingInsightsEnabled: (settings: CSettingsLike | null | undefined) => Promise<boolean>;
}

interface CListingInsightsGlobal {
  GrailedPlusListingInsightsLifecycle?: CListingInsightsLifecycleModule;
}

(function (root: CListingInsightsGlobal, factory: () => CListingInsightsLifecycleModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusListingInsightsLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as CListingInsightsGlobal) : {}, function () {
  "use strict";

  function createDefaultListingModel(): CListingModel {
    return {
      id: null,
      title: "",
      createdAt: null,
      pricing: {
        history: [],
        updatedAt: null
      },
      seller: {
        createdAt: null
      },
      prettyPath: null,
      sold: false,
      rawListing: null,
      sourceStatus: "missing_listing"
    };
  }

  function resolveMountTarget(
    insightsPanel: CInsightsPanelLike | null | undefined,
    doc: Document | null | undefined
  ): CMountTarget | null {
    if (!insightsPanel) {
      return null;
    }

    if (typeof insightsPanel.findMountTarget === "function") {
      return insightsPanel.findMountTarget(doc);
    }

    if (typeof insightsPanel.findMountNode === "function") {
      var legacyMountNode = insightsPanel.findMountNode(doc);
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

  function normalizeListingModel(listing: any): CListingModel {
    if (!listing || typeof listing !== "object") {
      return createDefaultListingModel();
    }

    var existingPricing = listing.pricing && typeof listing.pricing === "object" ? listing.pricing : {};
    var history = Array.isArray(existingPricing.history)
      ? existingPricing.history
      : Array.isArray(listing.priceDrops)
      ? listing.priceDrops
      : [];
    var updatedAt =
      typeof existingPricing.updatedAt === "string" || existingPricing.updatedAt === null
        ? existingPricing.updatedAt
        : listing.priceUpdatedAt || null;

    return {
      id: listing.id || null,
      title: typeof listing.title === "string" ? listing.title : "",
      createdAt: listing.createdAt || null,
      pricing: {
        history: history,
        updatedAt: updatedAt
      },
      seller:
        listing.seller && typeof listing.seller === "object"
          ? {
              createdAt: listing.seller.createdAt || null
            }
          : {
              createdAt: null
            },
      prettyPath: listing.prettyPath || null,
      sold: Boolean(listing.sold),
      rawListing: listing.rawListing || null,
      sourceStatus: listing.sourceStatus || "ok"
    };
  }

  function computeListingInsights(options: {
    listing: CListingModel;
    pricingInsights: CPricingInsightsLike | null | undefined;
  }): any {
    var config = options && typeof options === "object" ? options : ({} as any);
    var listing = config.listing;
    var pricingInsights = config.pricingInsights;

    if (pricingInsights && typeof pricingInsights.computePricingInsights === "function") {
      return pricingInsights.computePricingInsights(listing);
    }

    if (pricingInsights && typeof pricingInsights.computeMetrics === "function") {
      var legacy = pricingInsights.computeMetrics({
        priceDrops: listing && listing.pricing ? listing.pricing.history : [],
        createdAt: listing ? listing.createdAt : null,
        priceUpdatedAt: listing && listing.pricing ? listing.pricing.updatedAt : null
      });
      return {
        averageDropAmountUsd: legacy && Number.isFinite(legacy.avgDropAmount) ? legacy.avgDropAmount : null,
        averageDropPercent: legacy && Number.isFinite(legacy.avgDropPercent) ? legacy.avgDropPercent : null,
        expectedNextDropDays:
          legacy && Number.isFinite(legacy.expectedDropDays) ? legacy.expectedDropDays : null,
        expectedDropState:
          legacy && typeof legacy.expectedDropState === "string"
            ? legacy.expectedDropState
            : "insufficient_data",
        totalDrops: legacy && Number.isFinite(legacy.totalDrops) ? legacy.totalDrops : 0
      };
    }

    return {
      averageDropAmountUsd: null,
      averageDropPercent: null,
      expectedNextDropDays: null,
      expectedDropState: "insufficient_data",
      totalDrops: 0
    };
  }

  function renderListingInsightsPanel(options: {
    insightsPanel: CInsightsPanelLike | null | undefined;
    panelOptions: any;
  }): unknown {
    var config = options && typeof options === "object" ? options : ({} as any);
    var insightsPanel = config.insightsPanel;

    if (insightsPanel && typeof insightsPanel.renderInsightsPanel === "function") {
      return insightsPanel.renderInsightsPanel(config.panelOptions || {});
    }

    if (insightsPanel && typeof insightsPanel.renderPanel === "function") {
      var panelOptions =
        config.panelOptions && typeof config.panelOptions === "object" ? config.panelOptions : {};
      var listing = normalizeListingModel(panelOptions.listing || null);
      var metrics = panelOptions.metrics && typeof panelOptions.metrics === "object" ? panelOptions.metrics : {};
      var legacyMetrics = {
        avgDropAmount:
          Number.isFinite(metrics.averageDropAmountUsd) ? metrics.averageDropAmountUsd : null,
        avgDropPercent:
          Number.isFinite(metrics.averageDropPercent) ? metrics.averageDropPercent : null,
        expectedDropDays:
          Number.isFinite(metrics.expectedNextDropDays) ? metrics.expectedNextDropDays : null,
        expectedDropState:
          typeof metrics.expectedDropState === "string"
            ? metrics.expectedDropState
            : "insufficient_data",
        totalDrops: Number.isFinite(metrics.totalDrops) ? metrics.totalDrops : 0
      };

      return insightsPanel.renderPanel({
        listing: {
          id: listing.id,
          title: listing.title,
          priceDrops: listing.pricing.history,
          createdAt: listing.createdAt,
          priceUpdatedAt: listing.pricing.updatedAt,
          seller: listing.seller,
          prettyPath: listing.prettyPath,
          sold: listing.sold,
          rawListing: listing.rawListing
        },
        metrics: legacyMetrics,
        mountNode: panelOptions.mountNode || null,
        mountPosition: panelOptions.mountPosition || "afterend",
        rawListing: panelOptions.rawListing || null,
        statusMessage: panelOptions.statusMessage || "",
        currencyContext: panelOptions.currencyContext || null,
        marketCompare: panelOptions.marketCompare || null,
        onMarketCompareClick:
          typeof panelOptions.onMarketCompareClick === "function"
            ? panelOptions.onMarketCompareClick
            : function () {}
      });
    }

    return null;
  }

  function resolveListingInsightsEnabled(settings: CSettingsLike | null | undefined): Promise<boolean> {
    var defaultEnabled =
      settings && typeof settings.DEFAULT_LISTING_INSIGHTS_ENABLED === "boolean"
        ? settings.DEFAULT_LISTING_INSIGHTS_ENABLED
        : true;

    if (!settings || typeof settings.getListingInsightsEnabled !== "function") {
      return Promise.resolve(defaultEnabled);
    }

    return settings
      .getListingInsightsEnabled()
      .then(function (enabled) {
        return typeof enabled === "boolean" ? enabled : defaultEnabled;
      })
      .catch(function () {
        return defaultEnabled;
      });
  }

  return {
    createDefaultListingModel: createDefaultListingModel,
    resolveMountTarget: resolveMountTarget,
    normalizeListingModel: normalizeListingModel,
    computeListingInsights: computeListingInsights,
    renderListingInsightsPanel: renderListingInsightsPanel,
    resolveListingInsightsEnabled: resolveListingInsightsEnabled
  };
});
