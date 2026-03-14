type LMPrimitivePath = readonly string[];

type LMNestedPaths = readonly LMPrimitivePath[];

interface LMNormalizeHelpers {
  getNestedValue: (input: unknown, paths: LMNestedPaths, fallback: unknown) => unknown;
  normalizeDate: (value: unknown) => string | null;
  normalizeString: (value: unknown, fallback: string | null) => string | null;
  normalizeListingId: (value: unknown) => number | null;
  normalizePriceDrops: (value: unknown) => number[];
}

interface LMListingPricing {
  history: number[];
  updatedAt: string | null;
}

interface LMListingSeller {
  createdAt: string | null;
}

interface LMListingModel {
  id: number | null;
  title: string;
  createdAt: string | null;
  pricing: LMListingPricing;
  seller: LMListingSeller;
  prettyPath: string | null;
  sold: boolean;
  rawListing: Record<string, unknown> | null;
  sourceStatus: string;
}

interface LMRawSeller {
  createdAt?: unknown;
  created_at?: unknown;
  [key: string]: unknown;
}

interface LMRawListing {
  id?: unknown;
  title?: unknown;
  priceDrops?: unknown;
  price_drops?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
  trueCreatedAt?: unknown;
  true_created_at?: unknown;
  priceUpdatedAt?: unknown;
  price_updated_at?: unknown;
  prettyPath?: unknown;
  pretty_path?: unknown;
  sold?: unknown;
  seller?: LMRawSeller;
  [key: string]: unknown;
}

interface LMNextDataPayload {
  props?: {
    pageProps?: {
      listing?: LMRawListing;
    };
    listing?: LMRawListing;
  };
  pageProps?: {
    listing?: LMRawListing;
  };
  listing?: LMRawListing;
  [key: string]: unknown;
}

interface LMListingModelModule {
  createDefaultListing: (sourceStatus?: string) => LMListingModel;
  fromNextData: (rawNextData: unknown) => LMListingModel;
  mapRawListingToModel: (rawListing: unknown) => LMListingModel;
}

interface LMGlobalWithListingModel {
  GrailedPlusListingModel?: LMListingModelModule;
  GrailedPlusNormalize?: LMNormalizeHelpers;
}

(function (root: LMGlobalWithListingModel, factory: () => LMListingModelModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusListingModel = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as LMGlobalWithListingModel) : {},
  function () {
    "use strict";

    let Normalize: LMNormalizeHelpers | null = null;
    const globalScope =
      typeof globalThis !== "undefined" ? (globalThis as unknown as LMGlobalWithListingModel) : null;

    if (globalScope && globalScope.GrailedPlusNormalize) {
      Normalize = globalScope.GrailedPlusNormalize;
    }

    if (!Normalize && typeof require === "function") {
      try {
        const normalizeModule = require("../domain/normalize");
        Normalize = isNormalizeHelpers(normalizeModule) ? normalizeModule : null;
      } catch (_) {
        Normalize = null;
      }
    }

    function isNormalizeHelpers(input: unknown): input is LMNormalizeHelpers {
      if (!input || typeof input !== "object") {
        return false;
      }

      const candidate = input as LMNormalizeHelpers;
      return (
        typeof candidate.getNestedValue === "function" &&
        typeof candidate.normalizeDate === "function" &&
        typeof candidate.normalizeString === "function" &&
        typeof candidate.normalizeListingId === "function" &&
        typeof candidate.normalizePriceDrops === "function"
      );
    }

    function getNormalizeHelpers(): LMNormalizeHelpers | null {
      if (isNormalizeHelpers(Normalize)) {
        return Normalize;
      }

      return null;
    }

    function getNestedValue(input: unknown, paths: LMNestedPaths, fallback: unknown): unknown {
      const helpers = getNormalizeHelpers();
      if (helpers) {
        return helpers.getNestedValue(input, paths, fallback);
      }

      for (let i = 0; i < paths.length; i += 1) {
        const path = paths[i];
        let cursor: unknown = input;

        for (let j = 0; j < path.length; j += 1) {
          if (!cursor || typeof cursor !== "object") {
            cursor = undefined;
            break;
          }

          cursor = (cursor as Record<string, unknown>)[path[j]];
        }

        if (cursor !== undefined && cursor !== null) {
          return cursor;
        }
      }

      return fallback;
    }

    function normalizeDate(value: unknown): string | null {
      const helpers = getNormalizeHelpers();
      if (helpers) {
        return helpers.normalizeDate(value);
      }

      if (!value) {
        return null;
      }

      const date = new Date(value as string | number | Date);
      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date.toISOString();
    }

    function normalizeString(value: unknown, fallback: string | null): string | null {
      const helpers = getNormalizeHelpers();
      if (helpers) {
        return helpers.normalizeString(value, fallback);
      }

      if (typeof value === "string") {
        return value;
      }
      if (value == null) {
        return fallback;
      }

      try {
        return String(value);
      } catch (_) {
        return fallback;
      }
    }

    function normalizeListingId(value: unknown): number | null {
      const helpers = getNormalizeHelpers();
      if (helpers) {
        return helpers.normalizeListingId(value);
      }

      if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return value;
      }

      if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        const parsed = Number(value.trim());
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
      }

      return null;
    }

    function normalizePriceDrops(value: unknown): number[] {
      const helpers = getNormalizeHelpers();
      if (helpers) {
        return helpers.normalizePriceDrops(value);
      }

      if (!Array.isArray(value)) {
        return [];
      }

      return value
        .map(function (entry) {
          if (typeof entry === "object" && entry !== null) {
            const objectEntry = entry as Record<string, unknown>;
            return Number(objectEntry.amount || objectEntry.price || objectEntry.value);
          }
          return Number(entry);
        })
        .filter(function (entry) {
          return Number.isFinite(entry) && entry > 0;
        });
    }

    function createDefaultListing(sourceStatus?: string): LMListingModel {
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
        sourceStatus: sourceStatus || "missing_listing"
      };
    }

    function getRawListing(rawNextData: unknown): LMRawListing | null {
      return getNestedValue(
        rawNextData,
        [
          ["props", "pageProps", "listing"],
          ["pageProps", "listing"],
          ["props", "listing"],
          ["listing"]
        ],
        null
      ) as LMRawListing | null;
    }

    function mapRawListingToModel(rawListing: unknown): LMListingModel {
      if (!rawListing || typeof rawListing !== "object") {
        return createDefaultListing("missing_listing");
      }

      const typedRawListing = rawListing as LMRawListing;
      const seller = getNestedValue(typedRawListing, [["seller"]], {}) as LMRawSeller;
      const model = createDefaultListing("ok");

      model.id = normalizeListingId(getNestedValue(typedRawListing, [["id"]], null));
      model.title = (normalizeString(getNestedValue(typedRawListing, [["title"]], ""), "") || "") as string;
      model.pricing.history = normalizePriceDrops(
        getNestedValue(typedRawListing, [["priceDrops"], ["price_drops"]], [])
      );
      model.createdAt = normalizeDate(
        getNestedValue(
          typedRawListing,
          [["createdAt"], ["created_at"], ["trueCreatedAt"], ["true_created_at"]],
          null
        )
      );
      model.pricing.updatedAt = normalizeDate(
        getNestedValue(typedRawListing, [["priceUpdatedAt"], ["price_updated_at"]], null)
      );
      model.seller.createdAt = normalizeDate(getNestedValue(seller, [["createdAt"], ["created_at"]], null));

      model.prettyPath = normalizeString(
        getNestedValue(typedRawListing, [["prettyPath"], ["pretty_path"]], null),
        null
      );
      model.sold = Boolean(getNestedValue(typedRawListing, [["sold"]], false));
      model.rawListing = typedRawListing as Record<string, unknown>;

      if (!model.id) {
        model.sourceStatus = "missing_listing_id";
      }

      return model;
    }

    function fromNextData(rawNextData: LMNextDataPayload | unknown): LMListingModel {
      const rawListing = getRawListing(rawNextData);
      return mapRawListingToModel(rawListing);
    }

    return {
      createDefaultListing,
      fromNextData,
      mapRawListingToModel
    };
  }
);
