type NPrimitivePath = readonly string[];

type NNestedPaths = readonly NPrimitivePath[];

interface NNormalizeModule {
  getNestedValue: (input: unknown, paths: NNestedPaths, fallback: unknown) => unknown;
  normalizeDate: (value: unknown) => string | null;
  normalizeString: (value: unknown, fallback: string | null) => string | null;
  normalizeListingId: (value: unknown) => number | null;
  normalizePriceDrops: (value: unknown) => number[];
}

interface NGlobalRoot {
  GrailedPlusNormalize?: NNormalizeModule;
}

(function (root: NGlobalRoot, factory: () => NNormalizeModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusNormalize = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as NGlobalRoot) : {},
  function () {
    "use strict";

    function getNestedValue(input: unknown, paths: NNestedPaths, fallback: unknown): unknown {
      for (let i = 0; i < paths.length; i += 1) {
        const path = paths[i];
        let cursor: unknown = input;

        for (let j = 0; j < path.length; j += 1) {
          if (cursor == null || typeof cursor !== "object") {
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

    return {
      getNestedValue,
      normalizeDate,
      normalizeString,
      normalizeListingId,
      normalizePriceDrops
    };
  }
);
