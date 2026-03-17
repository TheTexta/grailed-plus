interface PFCandidate {
  title?: unknown;
  description?: unknown;
  seller?: unknown;
  size?: unknown;
  price?: unknown;
}

interface PFFilters {
  blockedTerms?: unknown;
  blockedSellers?: unknown;
  allowSizes?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
}

interface PFProviderFiltersModule {
  applyCandidateFilters: (candidates: unknown, filters: unknown) => PFCandidate[];
}

interface PFGlobalRoot {
  GrailedPlusProviderFilters?: PFProviderFiltersModule;
}

(function (root: PFGlobalRoot, factory: () => PFProviderFiltersModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusProviderFilters = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as PFGlobalRoot) : {},
  function () {
    "use strict";

    function normalizeString(value: unknown): string {
      if (typeof value !== "string") {
        return "";
      }
      return value.trim();
    }

    function normalizeList(values: unknown): string[] {
      if (!Array.isArray(values)) {
        return [];
      }

      return values
        .map(function (value) {
          return normalizeString(value).toLowerCase();
        })
        .filter(Boolean);
    }

    function applyCandidateFilters(candidates: unknown, filters: unknown): PFCandidate[] {
      const list = Array.isArray(candidates) ? (candidates.slice() as PFCandidate[]) : [];
      const rules = filters && typeof filters === "object" ? (filters as PFFilters) : {};

      const blockedTerms = normalizeList(rules.blockedTerms);
      const blockedSellers = normalizeList(rules.blockedSellers);
      const allowSizes = normalizeList(rules.allowSizes);
      const minPrice = Number(rules.minPrice);
      const maxPrice = Number(rules.maxPrice);

      return list.filter(function (candidate) {
        const title = normalizeString(candidate && candidate.title).toLowerCase();
        const description = normalizeString(candidate && candidate.description).toLowerCase();
        const seller = normalizeString(candidate && candidate.seller).toLowerCase();
        const size = normalizeString(candidate && candidate.size).toLowerCase();
        const price = Number(candidate && candidate.price);

        if (
          blockedTerms.some(function (term) {
            return title.indexOf(term) !== -1 || description.indexOf(term) !== -1;
          })
        ) {
          return false;
        }

        if (blockedSellers.length && seller && blockedSellers.indexOf(seller) !== -1) {
          return false;
        }

        if (allowSizes.length && size && allowSizes.indexOf(size) === -1) {
          return false;
        }

        if (Number.isFinite(minPrice) && Number.isFinite(price) && price < minPrice) {
          return false;
        }

        if (Number.isFinite(maxPrice) && Number.isFinite(price) && price > maxPrice) {
          return false;
        }

        return true;
      });
    }

    return {
      applyCandidateFilters
    };
  }
);
