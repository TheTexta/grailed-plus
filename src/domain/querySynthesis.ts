interface QSRawListing {
  designers?: Array<{ name?: unknown }>;
  category?: unknown;
  subcategory?: unknown;
  department?: unknown;
  productType?: unknown;
  product_type?: unknown;
  categoryPath?: unknown;
  category_path?: unknown;
  taxonomy?: unknown;
  breadcrumbs?: unknown;
  style?: unknown;
  tags?: unknown;
  size?: unknown;
  [key: string]: unknown;
}

interface QSListing {
  title?: unknown;
  brand?: unknown;
  size?: unknown;
  category?: unknown;
  subcategory?: unknown;
  rawListing?: QSRawListing;
}

interface QSBuildOptions {
  maxQueries?: unknown;
  maxTokens?: unknown;
  allowCategoryFallback?: boolean;
  allowedCategoryKeywords?: string[];
}

interface QSBuildResult {
  ok: boolean;
  errorCode?: "MISSING_LISTING_DATA";
  reason: "unsupported_category" | "no_queries" | "ok" | "category_fallback";
  queries: string[];
}

interface QSQuerySynthesisModule {
  DEFAULT_CATEGORY_KEYWORDS: string[];
  tokenize: (value: unknown, maxTokens: number) => string[];
  isAllowedCategory: (listing: QSListing | null | undefined, allowedKeywords?: string[]) => boolean;
  buildQueries: (listing: QSListing | null | undefined, options?: QSBuildOptions) => QSBuildResult;
}

interface QSGlobalRoot {
  GrailedPlusQuerySynthesis?: QSQuerySynthesisModule;
}

(function (root: QSGlobalRoot, factory: () => QSQuerySynthesisModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusQuerySynthesis = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as QSGlobalRoot) : {},
  function () {
    "use strict";

    const DEFAULT_CATEGORY_KEYWORDS = [
      "outerwear",
      "jacket",
      "coat",
      "hoodie",
      "fleece",
      "parka",
      "bomber",
      "anorak",
      "sweater",
      "knitwear",
      "cardigan",
      "crewneck",
      "sweatshirt",
      "shirt",
      "flannel",
      "polo",
      "tee",
      "t-shirt",
      "long sleeve",
      "longsleeve",
      "denim",
      "jeans",
      "pants",
      "trousers",
      "cargo",
      "shorts",
      "sneakers",
      "shoes",
      "boots",
      "loafers",
      "sandals",
      "bags",
      "bag",
      "backpack",
      "wallet",
      "accessories",
      "accessory",
      "belt",
      "hat",
      "beanie",
      "cap",
      "scarf",
      "jewelry",
      "watch",
      "sunglasses"
    ];

    const STOPWORDS: Record<string, true> = {
      the: true,
      and: true,
      with: true,
      for: true,
      from: true,
      this: true,
      that: true,
      grailed: true,
      depop: true,
      listing: true,
      item: true,
      size: true
    };

    function normalizeString(value: unknown): string {
      if (typeof value !== "string") {
        return "";
      }
      return value.trim();
    }

    function normalizeToken(value: unknown): string {
      return normalizeString(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function collapseRepeatedTokenSequences(tokens: string[]): string[] {
      let output = Array.isArray(tokens) ? tokens.slice() : [];
      if (!output.length) {
        return output;
      }

      output = output.filter(function (token, index) {
        return index === 0 || token !== output[index - 1];
      });

      let changed = true;
      while (changed) {
        changed = false;
        for (let size = Math.min(4, Math.floor(output.length / 2)); size >= 1; size -= 1) {
          for (let start = 0; start + size * 2 <= output.length; start += 1) {
            let isRepeat = true;
            for (let i = 0; i < size; i += 1) {
              if (output[start + i] !== output[start + size + i]) {
                isRepeat = false;
                break;
              }
            }

            if (isRepeat) {
              output.splice(start + size, size);
              changed = true;
              break;
            }
          }

          if (changed) {
            break;
          }
        }
      }

      return output;
    }

    function tokenize(value: unknown, maxTokens: number): string[] {
      const normalized = normalizeToken(value);
      if (!normalized) {
        return [];
      }

      let tokens = normalized.split(" ").filter(function (token) {
        return token && !STOPWORDS[token] && token.length <= 24;
      });

      tokens = collapseRepeatedTokenSequences(tokens);

      if (!Number.isFinite(maxTokens) || maxTokens <= 0 || tokens.length <= maxTokens) {
        return tokens;
      }

      return tokens.slice(0, maxTokens);
    }

    function normalizeQueryPhrase(value: unknown): string {
      const normalized = normalizeToken(value);
      if (!normalized) {
        return "";
      }

      const tokens = normalized.split(" ").filter(Boolean);
      return collapseRepeatedTokenSequences(tokens).join(" ");
    }

    function uniqueStrings(values: unknown[]): string[] {
      const seen: Record<string, true> = Object.create(null);
      const output: string[] = [];

      values.forEach(function (value) {
        const normalized = normalizeQueryPhrase(value);
        if (!normalized || seen[normalized]) {
          return;
        }

        seen[normalized] = true;
        output.push(normalized);
      });

      return output;
    }

    function toSignalFragment(value: unknown): string {
      if (typeof value === "string") {
        return normalizeString(value);
      }

      if (Array.isArray(value)) {
        return value.map(toSignalFragment).filter(Boolean).join(" ");
      }

      if (value && typeof value === "object") {
        const typed = value as Record<string, unknown>;
        const label = normalizeString(typed.name || typed.label || typed.slug || typed.title || "");
        if (label) {
          return label;
        }
      }

      return "";
    }

    function getFirstNonEmpty(values: unknown[]): string {
      for (let i = 0; i < values.length; i += 1) {
        const value = toSignalFragment(values[i]);
        if (value) {
          return value;
        }
      }
      return "";
    }

    function collectCategorySignals(listing: QSListing | null | undefined): string {
      const raw = listing && listing.rawListing && typeof listing.rawListing === "object"
        ? listing.rawListing
        : null;

      return [
        listing && listing.category,
        listing && listing.subcategory,
        raw && raw.category,
        raw && raw.subcategory,
        raw && raw.department,
        raw && raw.productType,
        raw && raw.product_type,
        raw && raw.categoryPath,
        raw && raw.category_path,
        raw && raw.taxonomy,
        raw && raw.breadcrumbs,
        raw && raw.style,
        raw && raw.tags,
        listing && listing.title
      ]
        .map(toSignalFragment)
        .filter(Boolean)
        .join(" ");
    }

    function containsKeyword(signal: string, keyword: string): boolean {
      const normalizedSignal = normalizeToken(signal);
      const normalizedKeyword = normalizeToken(keyword);
      if (!normalizedSignal || !normalizedKeyword) {
        return false;
      }

      const signalTokens = normalizedSignal.split(" ").filter(Boolean);
      const keywordTokens = normalizedKeyword.split(" ").filter(Boolean);
      if (!signalTokens.length || !keywordTokens.length) {
        return false;
      }

      if (keywordTokens.length === 1) {
        return signalTokens.indexOf(keywordTokens[0]) !== -1;
      }

      return normalizedSignal.indexOf(normalizedKeyword) !== -1;
    }

    function inferCategorySignal(listing: QSListing | null | undefined): string {
      return normalizeToken(collectCategorySignals(listing));
    }

    function isAllowedCategory(listing: QSListing | null | undefined, allowedKeywords?: string[]): boolean {
      const signal = inferCategorySignal(listing);
      if (!signal) {
        return false;
      }

      const list = Array.isArray(allowedKeywords) && allowedKeywords.length
        ? allowedKeywords
        : DEFAULT_CATEGORY_KEYWORDS;

      return list.some(function (keyword) {
        return containsKeyword(signal, keyword);
      });
    }

    function buildQueries(listing: QSListing | null | undefined, options?: QSBuildOptions): QSBuildResult {
      const settings = options && typeof options === "object" ? options : {};
      const maxQueries = Number.isFinite(Number(settings.maxQueries)) ? Number(settings.maxQueries) : 4;
      const maxTokens = Number.isFinite(Number(settings.maxTokens)) ? Number(settings.maxTokens) : 6;

      const allowCategoryFallback = settings.allowCategoryFallback !== false;
      const categoryAllowed = isAllowedCategory(listing, settings.allowedCategoryKeywords);
      if (!categoryAllowed && !allowCategoryFallback) {
        return {
          ok: false,
          errorCode: "MISSING_LISTING_DATA",
          reason: "unsupported_category",
          queries: []
        };
      }

      const raw = listing && listing.rawListing && typeof listing.rawListing === "object"
        ? listing.rawListing
        : null;

      const brand = normalizeString(listing && listing.brand) ||
        normalizeString(listing && raw && raw.designers && raw.designers[0] && raw.designers[0].name);
      const size = normalizeString(listing && listing.size) ||
        normalizeString(listing && raw && raw.size);
      const category = getFirstNonEmpty([
        listing && listing.category,
        listing && listing.subcategory,
        raw && raw.category,
        raw && raw.subcategory,
        raw && raw.department,
        raw && raw.productType,
        raw && raw.product_type,
        raw && raw.categoryPath,
        raw && raw.category_path
      ]);
      const title = normalizeString(listing && listing.title);

      const titleTokens = tokenize(title, maxTokens);
      const descriptor = titleTokens.slice(0, 3).join(" ");
      const coreTitle = titleTokens.slice(0, Math.min(titleTokens.length, 5)).join(" ");

      let candidates = [
        [brand, descriptor].filter(Boolean).join(" "),
        [brand, coreTitle].filter(Boolean).join(" "),
        [coreTitle, size].filter(Boolean).join(" "),
        [brand, size, category].filter(Boolean).join(" ")
      ];

      if (!categoryAllowed) {
        candidates = [
          [brand, coreTitle].filter(Boolean).join(" "),
          [coreTitle, size].filter(Boolean).join(" "),
          [brand, descriptor].filter(Boolean).join(" "),
          coreTitle || title
        ];
      }

      if (!brand && title) {
        candidates.unshift(coreTitle || title);
      }

      const queries = uniqueStrings(candidates).slice(0, Math.max(1, maxQueries));

      if (!queries.length) {
        return {
          ok: false,
          errorCode: "MISSING_LISTING_DATA",
          reason: "no_queries",
          queries: []
        };
      }

      return {
        ok: true,
        queries,
        reason: categoryAllowed ? "ok" : "category_fallback"
      };
    }

    return {
      DEFAULT_CATEGORY_KEYWORDS,
      tokenize,
      isAllowedCategory,
      buildQueries
    };
  }
);
