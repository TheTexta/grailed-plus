(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusPricingInsights = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DAY_MS = 24 * 60 * 60 * 1000;

  function computeAverageDropAmount(priceDrops) {
    if (!Array.isArray(priceDrops) || priceDrops.length < 2) {
      return null;
    }

    var deltas = [];
    var i;
    var sum = 0;

    for (i = 0; i < priceDrops.length - 1; i += 1) {
      deltas.push(Number(priceDrops[i]) - Number(priceDrops[i + 1]));
    }

    for (i = 0; i < deltas.length; i += 1) {
      if (!Number.isFinite(deltas[i])) {
        return null;
      }
      sum += deltas[i];
    }

    return sum / deltas.length;
  }

  function computeAverageDropPercent(priceDrops) {
    if (!Array.isArray(priceDrops) || priceDrops.length < 2) {
      return null;
    }

    var percents = [];
    var i;
    var current;
    var next;
    var sum = 0;

    for (i = 0; i < priceDrops.length - 1; i += 1) {
      current = Number(priceDrops[i]);
      next = Number(priceDrops[i + 1]);
      if (!Number.isFinite(current) || !Number.isFinite(next) || current <= 0) {
        return null;
      }
      percents.push(100 - (next / current) * 100);
    }

    for (i = 0; i < percents.length; i += 1) {
      sum += percents[i];
    }

    return Math.floor(sum / percents.length);
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  function computeExpectedDrop(listing, nowMs) {
    var history =
      listing && listing.pricing && Array.isArray(listing.pricing.history)
        ? listing.pricing.history
        : [];
    if (history.length < 1) {
      return {
        expectedNextDropDays: null,
        expectedDropState: "insufficient_data"
      };
    }

    var createdAt = parseDate(listing.createdAt);
    var updatedAt = parseDate(listing && listing.pricing ? listing.pricing.updatedAt : null);
    if (!createdAt || !updatedAt) {
      return {
        expectedNextDropDays: null,
        expectedDropState: "insufficient_data"
      };
    }

    var dropIntervalMs = (updatedAt.getTime() - createdAt.getTime()) / history.length;
    if (!Number.isFinite(dropIntervalMs) || dropIntervalMs <= 0) {
      return {
        expectedNextDropDays: null,
        expectedDropState: "insufficient_data"
      };
    }

    var msUntilNextDrop = dropIntervalMs - (nowMs - updatedAt.getTime());
    var expectedNextDropDays = Math.round(msUntilNextDrop / DAY_MS);

    if (expectedNextDropDays < -30) {
      return {
        expectedNextDropDays: expectedNextDropDays,
        expectedDropState: "inactive"
      };
    }

    return {
      expectedNextDropDays: expectedNextDropDays,
      expectedDropState: "scheduled"
    };
  }

  function computePricingInsights(listing, nowMs) {
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    var expected = computeExpectedDrop(listing, now);
    var history =
      listing && listing.pricing && Array.isArray(listing.pricing.history)
        ? listing.pricing.history
        : [];

    return {
      averageDropAmountUsd: computeAverageDropAmount(history),
      averageDropPercent: computeAverageDropPercent(history),
      expectedNextDropDays: expected.expectedNextDropDays,
      expectedDropState: expected.expectedDropState,
      totalDrops: history.length
    };
  }

  return {
    computeAverageDropAmount: computeAverageDropAmount,
    computeAverageDropPercent: computeAverageDropPercent,
    computeExpectedDrop: computeExpectedDrop,
    computePricingInsights: computePricingInsights
  };
});
