(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusListingInsightsLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createDefaultListingModel() {
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

  function resolveMountTarget(insightsPanel, doc) {
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

  function normalizeListingModel(listing) {
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

  function computeListingInsights(options) {
    var config = options && typeof options === "object" ? options : {};
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

  function renderListingInsightsPanel(options) {
    var config = options && typeof options === "object" ? options : {};
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

  function resolveListingInsightsEnabled(settings) {
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
