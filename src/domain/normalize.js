(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusNormalize = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function getNestedValue(input, paths, fallback) {
    var i;
    var path;
    var value;
    var cursor;
    var j;

    for (i = 0; i < paths.length; i += 1) {
      path = paths[i];
      cursor = input;

      for (j = 0; j < path.length; j += 1) {
        if (cursor == null || typeof cursor !== "object") {
          cursor = undefined;
          break;
        }
        cursor = cursor[path[j]];
      }

      value = cursor;
      if (value !== undefined && value !== null) {
        return value;
      }
    }

    return fallback;
  }

  function normalizeDate(value) {
    if (!value) {
      return null;
    }

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  function normalizeString(value, fallback) {
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

  function normalizeListingId(value) {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      var parsed = Number(value.trim());
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }

    return null;
  }

  function normalizePriceDrops(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(function (entry) {
        if (typeof entry === "object" && entry !== null) {
          return Number(entry.amount || entry.price || entry.value);
        }
        return Number(entry);
      })
      .filter(function (entry) {
        return Number.isFinite(entry) && entry > 0;
      });
  }

  return {
    getNestedValue: getNestedValue,
    normalizeDate: normalizeDate,
    normalizeString: normalizeString,
    normalizeListingId: normalizeListingId,
    normalizePriceDrops: normalizePriceDrops
  };
});
