(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusMatchScoring = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalizeString(value, fallback) {
    if (typeof value === "string") {
      var trimmed = value.trim();
      return trimmed || fallback;
    }
    return fallback;
  }

  function normalizeNumber(value) {
    if (value == null) {
      return null;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== "string") {
      return null;
    }
    if (value.trim() === "") {
      return null;
    }
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeCurrencyCode(value, fallback) {
    if (typeof value !== "string") {
      return fallback;
    }

    var upper = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(upper)) {
      return fallback;
    }
    return upper;
  }

  function tokenize(value) {
    var normalized = normalizeString(value, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) {
      return [];
    }

    return normalized.split(" ").filter(Boolean);
  }

  function overlapScore(leftValue, rightValue) {
    var leftTokens = tokenize(leftValue);
    var rightTokens = tokenize(rightValue);
    if (!leftTokens.length || !rightTokens.length) {
      return 0;
    }

    var rightSet = Object.create(null);
    rightTokens.forEach(function (token) {
      rightSet[token] = true;
    });

    var overlap = 0;
    leftTokens.forEach(function (token) {
      if (rightSet[token]) {
        overlap += 1;
      }
    });

    var denom = Math.max(leftTokens.length, rightTokens.length);
    if (!denom) {
      return 0;
    }

    return (overlap / denom) * 100;
  }

  function getUrlTitleHint(url) {
    var raw = normalizeString(url, "");
    if (!raw) {
      return "";
    }

    var withoutHash = raw.split("#")[0] || "";
    var withoutQuery = withoutHash.split("?")[0] || "";
    var segments = withoutQuery.split("/").filter(Boolean);
    if (!segments.length) {
      return "";
    }

    var last = segments[segments.length - 1] || "";
    var prev = segments.length > 1 ? segments[segments.length - 2] : "";
    var slug = last.toLowerCase() === "products" ? "" : last;

    if (!slug && prev.toLowerCase() !== "products") {
      slug = prev;
    }

    return String(slug)
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function imageHeuristicScore(listingImageUrl, candidateImageUrl) {
    var left = normalizeString(listingImageUrl, "");
    var right = normalizeString(candidateImageUrl, "");

    if (!left || !right) {
      return {
        score: null,
        usedImage: false,
        reason: "missing_url"
      };
    }

    var score = overlapScore(left, right);
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      usedImage: true,
      reason: "ok"
    };
  }

  function scoreBrand(listing, candidate) {
    var left = normalizeString(listing && (listing.brand || (listing.rawListing && listing.rawListing.brand)), "").toLowerCase();
    var right = normalizeString(candidate && candidate.brand, "").toLowerCase();

    if (!left || !right) {
      return 0;
    }

    return left === right ? 100 : 0;
  }

  function scoreSize(listing, candidate) {
    var left = normalizeString(listing && (listing.size || (listing.rawListing && listing.rawListing.size)), "").toLowerCase();
    var right = normalizeString(candidate && candidate.size, "").toLowerCase();

    if (!left || !right) {
      return 0;
    }

    return left === right ? 100 : 0;
  }

  function scoreCondition(listing, candidate) {
    var left = normalizeString(
      listing && listing.rawListing && listing.rawListing.condition,
      ""
    ).toLowerCase();
    var right = normalizeString(candidate && candidate.condition, "").toLowerCase();

    if (!left || !right) {
      return 0;
    }

    return left === right ? 100 : overlapScore(left, right);
  }

  function getRateForCurrency(currencyCode, ratesByUsd) {
    if (!ratesByUsd || typeof ratesByUsd !== "object") {
      return null;
    }

    if (currencyCode === "USD") {
      return 1;
    }

    var value = normalizeNumber(ratesByUsd[currencyCode]);
    return value != null && value > 0 ? value : null;
  }

  function convertBetweenCurrencies(amount, fromCurrency, toCurrency, ratesByUsd) {
    var amountValue = normalizeNumber(amount);
    if (amountValue == null) {
      return null;
    }

    var from = normalizeCurrencyCode(fromCurrency, "USD");
    var to = normalizeCurrencyCode(toCurrency, "USD");

    if (from === to) {
      return amountValue;
    }

    var fromRate = getRateForCurrency(from, ratesByUsd);
    var toRate = getRateForCurrency(to, ratesByUsd);
    if (fromRate == null || toRate == null || fromRate <= 0 || toRate <= 0) {
      return null;
    }

    var amountUsd = from === "USD" ? amountValue : amountValue / fromRate;
    if (!Number.isFinite(amountUsd)) {
      return null;
    }

    return to === "USD" ? amountUsd : amountUsd * toRate;
  }

  function convertUsdPrice(amountUsd, selectedCurrency, rate) {
    var amount = normalizeNumber(amountUsd);
    if (amount == null) {
      return null;
    }

    var currency = normalizeCurrencyCode(selectedCurrency, "USD");
    if (currency === "USD") {
      return amount;
    }

    var normalizedRate = normalizeNumber(rate);
    if (normalizedRate == null || normalizedRate <= 0) {
      return amount;
    }

    return amount * normalizedRate;
  }

  function scoreCandidate(listing, candidate, options) {
    var config = options && typeof options === "object" ? options : {};
    var listingTitle = normalizeString(listing && listing.title, "");
    var candidateTitle = normalizeString(candidate && candidate.title, "");
    var candidateTitleHint = getUrlTitleHint(candidate && candidate.url);
    var candidateTitleForScore = [candidateTitle, candidateTitleHint]
      .filter(Boolean)
      .join(" ");
    var listingImageUrl =
      normalizeString(listing && listing.imageUrl, "") ||
      normalizeString(
        listing && listing.rawListing && listing.rawListing.coverPhoto && listing.rawListing.coverPhoto.url,
        ""
      ) ||
      normalizeString(
        listing && listing.rawListing && listing.rawListing.photo && listing.rawListing.photo.url,
        ""
      );

    var imageResult = imageHeuristicScore(listingImageUrl, candidate && candidate.imageUrl);
    var imageScore = imageResult.score;
    var titleScore = Math.max(
      overlapScore(listingTitle, candidateTitle),
      overlapScore(listingTitle, candidateTitleForScore)
    );
    var brandScore = scoreBrand(listing, candidate);
    var sizeScore = scoreSize(listing, candidate);
    var conditionScore = scoreCondition(listing, candidate);

    var weightedScore;
    if (imageScore == null) {
      weightedScore = titleScore * 0.45 + brandScore * 0.28 + sizeScore * 0.18 + conditionScore * 0.09;
      weightedScore = weightedScore * 0.95;
    } else {
      weightedScore =
        imageScore * 0.45 +
        titleScore * 0.25 +
        brandScore * 0.15 +
        sizeScore * 0.1 +
        conditionScore * 0.05;
    }

    var finalScore = Math.max(0, Math.min(100, Math.round(weightedScore)));

    var listingPriceUsd = normalizeNumber(config.listingPriceUsd);
    var candidateAmount = normalizeNumber(candidate && candidate.price);
    var candidateCurrency = normalizeCurrencyCode(candidate && candidate.currency, "USD");
    var selectedCurrency = normalizeCurrencyCode(config.selectedCurrency, "USD");
    var rate = normalizeNumber(config.rate);
    var ratesByUsd = config && config.ratesByUsd && typeof config.ratesByUsd === "object"
      ? config.ratesByUsd
      : null;

    var listingComparable = convertUsdPrice(listingPriceUsd, selectedCurrency, rate);
    var candidateComparable = convertBetweenCurrencies(
      candidateAmount,
      candidateCurrency,
      selectedCurrency,
      ratesByUsd
    );

    if (candidateComparable == null) {
      candidateComparable = convertUsdPrice(candidateAmount, selectedCurrency, rate);
    }

    var deltaAbsolute = null;
    var deltaPercent = null;
    if (listingComparable != null && candidateComparable != null && listingComparable !== 0) {
      deltaAbsolute = candidateComparable - listingComparable;
      deltaPercent = (deltaAbsolute / listingComparable) * 100;
    }

    return {
      id: candidate.id,
      title: candidate.title,
      url: candidate.url,
      imageUrl: candidate.imageUrl || "",
      market: candidate.market || "depop",
      currency: selectedCurrency,
      price: candidateComparable != null ? candidateComparable : candidateAmount,
      originalCurrency: candidateCurrency,
      originalPrice: candidateAmount,
      score: finalScore,
      usedImage: imageResult.usedImage,
      imageUnavailableReason: imageResult.usedImage ? "" : imageResult.reason,
      components: {
        imageScore: imageScore,
        titleScore: Math.round(titleScore),
        brandScore: Math.round(brandScore),
        sizeScore: Math.round(sizeScore),
        conditionScore: Math.round(conditionScore)
      },
      deltaAbsolute: deltaAbsolute,
      deltaPercent: deltaPercent,
      raw: candidate.raw || null
    };
  }

  function rankCandidates(listing, candidates, options) {
    var list = Array.isArray(candidates) ? candidates : [];
    var config = options && typeof options === "object" ? options : {};
    var minScore = Number.isFinite(Number(config.minScore)) ? Number(config.minScore) : 40;

    var scored = list
      .map(function (candidate) {
        return scoreCandidate(listing, candidate, config);
      })
      .filter(function (entry) {
        return Number.isFinite(entry.score) && entry.score >= minScore;
      })
      .sort(function (a, b) {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        if (Number.isFinite(a.price) && Number.isFinite(b.price) && a.price !== b.price) {
          return a.price - b.price;
        }

        return String(a.id).localeCompare(String(b.id));
      });

    return scored;
  }

  return {
    rankCandidates: rankCandidates,
    scoreCandidate: scoreCandidate,
    overlapScore: overlapScore,
    convertBetweenCurrencies: convertBetweenCurrencies
  };
});
