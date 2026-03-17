interface LEListingPricing {
  history: number[];
  updatedAt: string | null;
}

interface LEListingSeller {
  createdAt: string | null;
}

interface LEListingModel {
  id: number | null;
  title: string;
  createdAt: string | null;
  pricing: LEListingPricing;
  seller: LEListingSeller;
  prettyPath: string | null;
  sold: boolean;
  rawListing: Record<string, unknown> | null;
  sourceStatus: string;
}

interface LERawSeller {
  createdAt?: unknown;
  created_at?: unknown;
  [key: string]: unknown;
}

interface LERawListing {
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
  seller?: LERawSeller;
  [key: string]: unknown;
}

interface LENextDataPageProps {
  listing?: LERawListing;
  [key: string]: unknown;
}

interface LENextDataProps {
  pageProps?: LENextDataPageProps;
  listing?: LERawListing;
  [key: string]: unknown;
}

interface LENextDataPayload {
  props?: LENextDataProps;
  pageProps?: LENextDataPageProps;
  listing?: LERawListing;
  [key: string]: unknown;
}

interface LEListingModelModule {
  fromNextData: (rawNextData: unknown) => LEListingModel;
}

interface LEListingExtractorModule {
  readNextDataFromDocument: (doc: Document | null | undefined) => LENextDataPayload | null;
  extractListing: (rawNextData: unknown) => LEListingModel;
}

interface LEGlobalWithExtractor {
  GrailedPlusListingExtractor?: LEListingExtractorModule;
  GrailedPlusListingModel?: LEListingModelModule;
}

(function (root: LEGlobalWithExtractor, factory: () => LEListingExtractorModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusListingExtractor = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as LEGlobalWithExtractor) : {},
  function () {
    "use strict";

    let ListingModel: LEListingModelModule | null = null;
    const globalScope =
      typeof globalThis !== "undefined" ? (globalThis as unknown as LEGlobalWithExtractor) : null;

    if (globalScope && globalScope.GrailedPlusListingModel) {
      ListingModel = globalScope.GrailedPlusListingModel;
    }

    if (!ListingModel && typeof require === "function") {
      try {
        const listingModelModule = require("./listingModel");
        ListingModel = isListingModelModule(listingModelModule) ? listingModelModule : null;
      } catch (_) {
        ListingModel = null;
      }
    }

    function isListingModelModule(input: unknown): input is LEListingModelModule {
      if (!input || typeof input !== "object") {
        return false;
      }

      return typeof (input as LEListingModelModule).fromNextData === "function";
    }

    function safeParseJson<T>(text: string | null | undefined): T | null {
      if (!text || typeof text !== "string") {
        return null;
      }

      try {
        return JSON.parse(text) as T;
      } catch (_) {
        return null;
      }
    }

    function readNextDataFromDocument(doc: Document | null | undefined): LENextDataPayload | null {
      if (!doc || typeof doc.getElementById !== "function") {
        return null;
      }

      const node = doc.getElementById("__NEXT_DATA__");
      if (!node || !node.textContent) {
        return null;
      }

      return safeParseJson<LENextDataPayload>(node.textContent);
    }

    function extractListing(rawNextData: unknown): LEListingModel {
      if (ListingModel && typeof ListingModel.fromNextData === "function") {
        return ListingModel.fromNextData(rawNextData);
      }

      // Fallback defaults if the listing model module fails to load.
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
        sourceStatus: "listing_model_unavailable"
      };
    }

    return {
      readNextDataFromDocument,
      extractListing
    };
  }
);
