"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getNestedValue,
  normalizeDate,
  normalizeString,
  normalizeListingId,
  normalizePriceDrops
} = require("../.tmp/ts-build/src/domain/normalize");

test("getNestedValue returns first non-null matching path", () => {
  const input = {
    a: {
      b: null
    },
    x: {
      y: 42
    }
  };

  const value = getNestedValue(
    input,
    [
      ["a", "b"],
      ["x", "y"]
    ],
    "fallback"
  );

  assert.equal(value, 42);
});

test("getNestedValue returns fallback when no path resolves", () => {
  const value = getNestedValue(
    {
      a: {}
    },
    [["a", "b"], ["c"]],
    "fallback"
  );

  assert.equal(value, "fallback");
});

test("normalizeDate returns ISO string for valid dates and null otherwise", () => {
  assert.equal(normalizeDate("2026-03-01T00:00:00.000Z"), "2026-03-01T00:00:00.000Z");
  assert.equal(normalizeDate("invalid"), null);
  assert.equal(normalizeDate(null), null);
});

test("normalizeString preserves strings and coerces other values", () => {
  assert.equal(normalizeString("hello", "fallback"), "hello");
  assert.equal(normalizeString(123, "fallback"), "123");
  assert.equal(normalizeString(null, "fallback"), "fallback");
});

test("normalizeListingId accepts positive integers and numeric strings", () => {
  assert.equal(normalizeListingId(123), 123);
  assert.equal(normalizeListingId(" 123 "), 123);
  assert.equal(normalizeListingId("abc"), null);
  assert.equal(normalizeListingId(0), null);
});

test("normalizePriceDrops keeps only finite positive amounts", () => {
  const normalized = normalizePriceDrops(["x", 10, { amount: 5 }, -1, null, { price: 12 }]);
  assert.deepEqual(normalized, [10, 5, 12]);

  assert.deepEqual(normalizePriceDrops(null), []);
});
