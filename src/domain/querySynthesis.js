(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusQuerySynthesis = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Shared clothing taxonomy terms commonly present across Grailed and Depop listing metadata.
  var DEFAULT_CATEGORY_KEYWORDS = [
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
  var STOPWORDS = {
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

  function normalizeString(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim();
  }

  function normalizeToken(value) {
    return normalizeString(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(value, maxTokens) {
    var normalized = normalizeToken(value);
    if (!normalized) {
      return [];
    }

    var tokens = normalized.split(" ").filter(function (token) {
      return token && !STOPWORDS[token] && token.length <= 24;
    });

    tokens = collapseRepeatedTokenSequences(tokens);

    if (!Number.isFinite(maxTokens) || maxTokens <= 0 || tokens.length <= maxTokens) {
      return tokens;
    }

    return tokens.slice(0, maxTokens);
  }

  function collapseRepeatedTokenSequences(tokens) {
    var output = Array.isArray(tokens) ? tokens.slice() : [];
    if (!output.length) {
      return output;
    }

    // First collapse immediate repeated words (for example: "tee tee").
    output = output.filter(function (token, index) {
      return index === 0 || token !== output[index - 1];
    });

    // Then collapse adjacent repeated phrases (for example: "drain gang drain gang").
    var changed = true;
    while (changed) {
      changed = false;
      for (var size = Math.min(4, Math.floor(output.length / 2)); size >= 1; size -= 1) {
        for (var start = 0; start + size * 2 <= output.length; start += 1) {
          var isRepeat = true;
          for (var i = 0; i < size; i += 1) {
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

  function normalizeQueryPhrase(value) {
    var normalized = normalizeToken(value);
    if (!normalized) {
      return "";
    }

    var tokens = normalized.split(" ").filter(Boolean);
    return collapseRepeatedTokenSequences(tokens).join(" ");
  }

  function uniqueStrings(values) {
    var seen = Object.create(null);
    var output = [];
    values.forEach(function (value) {
      var normalized = normalizeQueryPhrase(value);
      if (!normalized || seen[normalized]) {
        return;
      }
      seen[normalized] = true;
      output.push(normalized);
    });
    return output;
  }

  function toSignalFragment(value) {
    if (typeof value === "string") {
      return normalizeString(value);
    }

    if (Array.isArray(value)) {
      return value
        .map(toSignalFragment)
        .filter(Boolean)
        .join(" ");
    }

    if (value && typeof value === "object") {
      var label = normalizeString(value.name || value.label || value.slug || value.title || "");
      if (label) {
        return label;
      }
    }

    return "";
  }

  function getFirstNonEmpty(values) {
    var i;
    var value;
    for (i = 0; i < values.length; i += 1) {
      value = toSignalFragment(values[i]);
      if (value) {
        return value;
      }
    }
    return "";
  }

  function collectCategorySignals(listing) {
    var raw = listing && listing.rawListing && typeof listing.rawListing === "object"
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

  function containsKeyword(signal, keyword) {
    var normalizedSignal = normalizeToken(signal);
    var normalizedKeyword = normalizeToken(keyword);
    if (!normalizedSignal || !normalizedKeyword) {
      return false;
    }

    var signalTokens = normalizedSignal.split(" ").filter(Boolean);
    var keywordTokens = normalizedKeyword.split(" ").filter(Boolean);
    if (!signalTokens.length || !keywordTokens.length) {
      return false;
    }

    if (keywordTokens.length === 1) {
      return signalTokens.indexOf(keywordTokens[0]) !== -1;
    }

    return normalizedSignal.indexOf(normalizedKeyword) !== -1;
  }

  function inferCategorySignal(listing) {
    return normalizeToken(collectCategorySignals(listing));
  }

  function isAllowedCategory(listing, allowedKeywords) {
    var signal = inferCategorySignal(listing);
    if (!signal) {
      return false;
    }

    var list = Array.isArray(allowedKeywords) && allowedKeywords.length
      ? allowedKeywords
      : DEFAULT_CATEGORY_KEYWORDS;

    return list.some(function (keyword) {
      return containsKeyword(signal, keyword);
    });
  }

  function buildQueries(listing, options) {
    var settings = options && typeof options === "object" ? options : {};
    var maxQueries = Number.isFinite(Number(settings.maxQueries)) ? Number(settings.maxQueries) : 4;
    var maxTokens = Number.isFinite(Number(settings.maxTokens)) ? Number(settings.maxTokens) : 6;

    var allowCategoryFallback = settings.allowCategoryFallback !== false;
    var categoryAllowed = isAllowedCategory(listing, settings.allowedCategoryKeywords);
    if (!categoryAllowed && !allowCategoryFallback) {
      return {
        ok: false,
        errorCode: "MISSING_LISTING_DATA",
        reason: "unsupported_category",
        queries: []
      };
    }

    var raw = listing && listing.rawListing && typeof listing.rawListing === "object"
      ? listing.rawListing
      : null;

    var brand = normalizeString(listing && listing.brand) ||
      normalizeString(listing && listing.rawListing && listing.rawListing.designers && listing.rawListing.designers[0] && listing.rawListing.designers[0].name);
    var size = normalizeString(listing && listing.size) ||
      normalizeString(listing && listing.rawListing && listing.rawListing.size);
    var category = getFirstNonEmpty([
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
    var title = normalizeString(listing && listing.title);

    var titleTokens = tokenize(title, maxTokens);
    var descriptor = titleTokens.slice(0, 3).join(" ");
    var coreTitle = titleTokens.slice(0, Math.min(titleTokens.length, 5)).join(" ");

    var candidates = [
      [brand, descriptor].filter(Boolean).join(" "),
      [brand, coreTitle].filter(Boolean).join(" "),
      [coreTitle, size].filter(Boolean).join(" "),
      [brand, size, category].filter(Boolean).join(" ")
    ];

    if (!categoryAllowed) {
      // Safe fallback: keep searching without category constraints when mapping is incomplete.
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

    var queries = uniqueStrings(candidates).slice(0, Math.max(1, maxQueries));

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
      queries: queries,
      reason: categoryAllowed ? "ok" : "category_fallback"
    };
  }

  return {
    DEFAULT_CATEGORY_KEYWORDS: DEFAULT_CATEGORY_KEYWORDS,
    tokenize: tokenize,
    isAllowedCategory: isAllowedCategory,
    buildQueries: buildQueries
  };
});
