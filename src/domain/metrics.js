(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusMetrics = factory();
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
    var priceDrops = Array.isArray(listing && listing.priceDrops) ? listing.priceDrops : [];
    if (priceDrops.length < 1) {
      return {
        expectedDropDays: null,
        expectedDropState: "insufficient_data"
      };
    }

    var createdAt = parseDate(listing.createdAt);
    var updatedAt = parseDate(listing.priceUpdatedAt);
    if (!createdAt || !updatedAt) {
      return {
        expectedDropDays: null,
        expectedDropState: "insufficient_data"
      };
    }

    var dropIntervalMs = (updatedAt.getTime() - createdAt.getTime()) / priceDrops.length;
    if (!Number.isFinite(dropIntervalMs) || dropIntervalMs <= 0) {
      return {
        expectedDropDays: null,
        expectedDropState: "insufficient_data"
      };
    }

    var msUntilNextDrop = dropIntervalMs - (nowMs - updatedAt.getTime());
    var expectedDropDays = Math.round(msUntilNextDrop / DAY_MS);

    if (expectedDropDays < -30) {
      return {
        expectedDropDays: expectedDropDays,
        expectedDropState: "inactive"
      };
    }

    return {
      expectedDropDays: expectedDropDays,
      expectedDropState: "scheduled"
    };
  }

  function computeMetrics(listing, nowMs) {
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    var expected = computeExpectedDrop(listing, now);
    var priceDrops = Array.isArray(listing && listing.priceDrops) ? listing.priceDrops : [];

    return {
      avgDropAmount: computeAverageDropAmount(priceDrops),
      avgDropPercent: computeAverageDropPercent(priceDrops),
      expectedDropDays: expected.expectedDropDays,
      expectedDropState: expected.expectedDropState,
      totalDrops: priceDrops.length
    };
  }

  return {
    computeAverageDropAmount: computeAverageDropAmount,
    computeAverageDropPercent: computeAverageDropPercent,
    computeExpectedDrop: computeExpectedDrop,
    computeMetrics: computeMetrics
  };
});
