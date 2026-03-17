"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeAverageDropAmount,
  computeAverageDropPercent,
  computeExpectedDrop,
  computePricingInsights
} = require("../.tmp/ts-build/src/domain/pricingInsights");

test("computeAverageDropAmount returns average delta", () => {
  assert.equal(computeAverageDropAmount([1000, 900, 700]), 150);
});

test("computeAverageDropPercent returns floor average percent", () => {
  assert.equal(computeAverageDropPercent([1000, 900, 810]), 10);
});

test("computeExpectedDrop returns insufficient_data when drops are missing", () => {
  const result = computeExpectedDrop(
    {
      pricing: {
        history: [],
        updatedAt: "2026-01-02T00:00:00.000Z"
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    Date.parse("2026-01-03T00:00:00.000Z")
  );

  assert.equal(result.expectedDropState, "insufficient_data");
  assert.equal(result.expectedNextDropDays, null);
});

test("computeExpectedDrop returns inactive when prediction is stale", () => {
  const result = computeExpectedDrop(
    {
      pricing: {
        history: [1000, 900],
        updatedAt: "2026-01-05T00:00:00.000Z"
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    Date.parse("2026-03-20T00:00:00.000Z")
  );

  assert.equal(result.expectedDropState, "inactive");
  assert.ok(result.expectedNextDropDays < -30);
});

test("computePricingInsights aggregates expected and average metrics", () => {
  const result = computePricingInsights(
    {
      pricing: {
        history: [1000, 900, 810],
        updatedAt: "2026-01-11T00:00:00.000Z"
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    Date.parse("2026-01-12T00:00:00.000Z")
  );

  assert.equal(result.averageDropAmountUsd, 95);
  assert.equal(result.averageDropPercent, 10);
  assert.equal(result.expectedDropState, "scheduled");
  assert.equal(result.totalDrops, 3);
});
