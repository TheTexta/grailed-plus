(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusProviderFilters = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalizeString(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim();
  }

  function normalizeList(values) {
    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .map(function (value) {
        return normalizeString(value).toLowerCase();
      })
      .filter(Boolean);
  }

  function applyCandidateFilters(candidates, filters) {
    var list = Array.isArray(candidates) ? candidates.slice() : [];
    var rules = filters && typeof filters === "object" ? filters : {};
    var blockedTerms = normalizeList(rules.blockedTerms);
    var blockedSellers = normalizeList(rules.blockedSellers);
    var allowSizes = normalizeList(rules.allowSizes);
    var minPrice = Number(rules.minPrice);
    var maxPrice = Number(rules.maxPrice);

    return list.filter(function (candidate) {
      var title = normalizeString(candidate && candidate.title).toLowerCase();
      var description = normalizeString(candidate && candidate.description).toLowerCase();
      var seller = normalizeString(candidate && candidate.seller).toLowerCase();
      var size = normalizeString(candidate && candidate.size).toLowerCase();
      var price = Number(candidate && candidate.price);

      if (blockedTerms.some(function (term) { return title.indexOf(term) !== -1 || description.indexOf(term) !== -1; })) {
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
    applyCandidateFilters: applyCandidateFilters
  };
});
