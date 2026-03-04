"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeAverageDropAmount,
  computeAverageDropPercent,
  computeExpectedDrop,
  computeMetrics
} = require("../src/domain/metrics.js");

test("computeAverageDropAmount returns average delta", () => {
  assert.equal(computeAverageDropAmount([1000, 900, 700]), 150);
});

test("computeAverageDropPercent returns floor average percent", () => {
  assert.equal(computeAverageDropPercent([1000, 900, 810]), 10);
});

test("computeExpectedDrop returns insufficient_data when drops are missing", () => {
  const result = computeExpectedDrop(
    {
      priceDrops: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      priceUpdatedAt: "2026-01-02T00:00:00.000Z"
    },
    Date.parse("2026-01-03T00:00:00.000Z")
  );

  assert.equal(result.expectedDropState, "insufficient_data");
  assert.equal(result.expectedDropDays, null);
});

test("computeExpectedDrop returns inactive when prediction is stale", () => {
  const result = computeExpectedDrop(
    {
      priceDrops: [1000, 900],
      createdAt: "2026-01-01T00:00:00.000Z",
      priceUpdatedAt: "2026-01-05T00:00:00.000Z"
    },
    Date.parse("2026-03-20T00:00:00.000Z")
  );

  assert.equal(result.expectedDropState, "inactive");
  assert.ok(result.expectedDropDays < -30);
});

test("computeMetrics aggregates expected and average metrics", () => {
  const result = computeMetrics(
    {
      priceDrops: [1000, 900, 810],
      createdAt: "2026-01-01T00:00:00.000Z",
      priceUpdatedAt: "2026-01-11T00:00:00.000Z"
    },
    Date.parse("2026-01-12T00:00:00.000Z")
  );

  assert.equal(result.avgDropAmount, 95);
  assert.equal(result.avgDropPercent, 10);
  assert.equal(result.expectedDropState, "scheduled");
  assert.equal(result.totalDrops, 3);
});
