interface PIListingPricing {
  history?: unknown;
  updatedAt?: unknown;
}

interface PIListing {
  pricing?: PIListingPricing;
  createdAt?: unknown;
}

interface PIExpectedDrop {
  expectedNextDropDays: number | null;
  expectedDropState: "insufficient_data" | "inactive" | "scheduled";
}

interface PIPricingInsights {
  averageDropAmountUsd: number | null;
  averageDropPercent: number | null;
  expectedNextDropDays: number | null;
  expectedDropState: "insufficient_data" | "inactive" | "scheduled";
  totalDrops: number;
}

interface PIPricingInsightsModule {
  computeAverageDropAmount: (priceDrops: unknown) => number | null;
  computeAverageDropPercent: (priceDrops: unknown) => number | null;
  computeExpectedDrop: (listing: PIListing | null | undefined, nowMs: number) => PIExpectedDrop;
  computePricingInsights: (listing: PIListing | null | undefined, nowMs?: number) => PIPricingInsights;
}

interface PIGlobalRoot {
  GrailedPlusPricingInsights?: PIPricingInsightsModule;
}

(function (root: PIGlobalRoot, factory: () => PIPricingInsightsModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusPricingInsights = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as PIGlobalRoot) : {},
  function () {
    "use strict";

    const DAY_MS = 24 * 60 * 60 * 1000;

    function toHistory(value: unknown): number[] {
      if (!Array.isArray(value)) {
        return [];
      }
      return value.map(function (entry) {
        return Number(entry);
      });
    }

    function computeAverageDropAmount(priceDrops: unknown): number | null {
      const history = toHistory(priceDrops);
      if (history.length < 2) {
        return null;
      }

      const deltas: number[] = [];
      let sum = 0;

      for (let i = 0; i < history.length - 1; i += 1) {
        deltas.push(Number(history[i]) - Number(history[i + 1]));
      }

      for (let i = 0; i < deltas.length; i += 1) {
        if (!Number.isFinite(deltas[i])) {
          return null;
        }
        sum += deltas[i];
      }

      return sum / deltas.length;
    }

    function computeAverageDropPercent(priceDrops: unknown): number | null {
      const history = toHistory(priceDrops);
      if (history.length < 2) {
        return null;
      }

      const percents: number[] = [];
      let sum = 0;

      for (let i = 0; i < history.length - 1; i += 1) {
        const current = Number(history[i]);
        const next = Number(history[i + 1]);
        if (!Number.isFinite(current) || !Number.isFinite(next) || current <= 0) {
          return null;
        }
        percents.push(100 - (next / current) * 100);
      }

      for (let i = 0; i < percents.length; i += 1) {
        sum += percents[i];
      }

      return Math.floor(sum / percents.length);
    }

    function parseDate(value: unknown): Date | null {
      if (!value) {
        return null;
      }
      const date = new Date(value as string | number | Date);
      if (Number.isNaN(date.getTime())) {
        return null;
      }
      return date;
    }

    function computeExpectedDrop(listing: PIListing | null | undefined, nowMs: number): PIExpectedDrop {
      const history =
        listing && listing.pricing && Array.isArray(listing.pricing.history)
          ? toHistory(listing.pricing.history)
          : [];

      if (history.length < 1) {
        return {
          expectedNextDropDays: null,
          expectedDropState: "insufficient_data"
        };
      }

      const createdAt = parseDate(listing && listing.createdAt);
      const updatedAt = parseDate(listing && listing.pricing ? listing.pricing.updatedAt : null);
      if (!createdAt || !updatedAt) {
        return {
          expectedNextDropDays: null,
          expectedDropState: "insufficient_data"
        };
      }

      const dropIntervalMs = (updatedAt.getTime() - createdAt.getTime()) / history.length;
      if (!Number.isFinite(dropIntervalMs) || dropIntervalMs <= 0) {
        return {
          expectedNextDropDays: null,
          expectedDropState: "insufficient_data"
        };
      }

      const msUntilNextDrop = dropIntervalMs - (nowMs - updatedAt.getTime());
      const expectedNextDropDays = Math.round(msUntilNextDrop / DAY_MS);

      if (expectedNextDropDays < -30) {
        return {
          expectedNextDropDays,
          expectedDropState: "inactive"
        };
      }

      return {
        expectedNextDropDays,
        expectedDropState: "scheduled"
      };
    }

    function computePricingInsights(listing: PIListing | null | undefined, nowMs?: number): PIPricingInsights {
      const now = Number.isFinite(nowMs) ? (nowMs as number) : Date.now();
      const expected = computeExpectedDrop(listing, now);
      const history =
        listing && listing.pricing && Array.isArray(listing.pricing.history)
          ? toHistory(listing.pricing.history)
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
      computeAverageDropAmount,
      computeAverageDropPercent,
      computeExpectedDrop,
      computePricingInsights
    };
  }
);
