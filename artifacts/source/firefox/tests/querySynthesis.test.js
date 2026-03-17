"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildQueries, isAllowedCategory } = require("../.tmp/ts-build/src/domain/querySynthesis");

test("isAllowedCategory supports category-keyword subset gating", () => {
  assert.equal(isAllowedCategory({ title: "Vintage bomber jacket" }, ["jacket"]), true);
  assert.equal(isAllowedCategory({ title: "Leather boots" }, ["jacket"]), false);
});

test("isAllowedCategory accepts category signals from raw listing metadata", () => {
  const listing = {
    title: "Archive piece",
    rawListing: {
      department: "Menswear",
      categoryPath: ["Clothing", "Outerwear", "Jackets"]
    }
  };

  assert.equal(isAllowedCategory(listing), true);
});

test("buildQueries returns deterministic query list for supported listing", () => {
  const listing = {
    title: "Stone Island bomber jacket black",
    brand: "Stone Island",
    size: "L",
    category: "Outerwear"
  };

  const result = buildQueries(listing, {
    allowedCategoryKeywords: ["jacket", "outerwear"],
    maxQueries: 4,
    maxTokens: 6
  });

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.queries));
  assert.ok(result.queries.length > 0);
  assert.equal(result.queries[0], "stone island bomber");
});

test("buildQueries collapses repeated adjacent phrases in generated queries", () => {
  const listing = {
    title: "drain gang drain gang chaos tee",
    brand: "Drain Gang"
  };

  const result = buildQueries(listing, {
    maxQueries: 4,
    maxTokens: 6
  });

  assert.equal(result.ok, true);
  assert.ok(result.queries.length > 0);
  assert.equal(result.queries[0], "drain gang chaos");
});

test("buildQueries falls back to unconstrained search when category is unsupported", () => {
  const listing = {
    title: "Nike running shoes",
    brand: "Nike"
  };

  const result = buildQueries(listing, {
    allowedCategoryKeywords: ["jacket"]
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "category_fallback");
  assert.ok(Array.isArray(result.queries));
  assert.ok(result.queries.length > 0);
});

test("buildQueries can still enforce strict category-only mode", () => {
  const listing = {
    title: "Nike running shoes",
    brand: "Nike"
  };

  const result = buildQueries(listing, {
    allowedCategoryKeywords: ["jacket"],
    allowCategoryFallback: false
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "MISSING_LISTING_DATA");
});

test("buildQueries accepts listings using productType or category path fields", () => {
  const listing = {
    title: "Margiela archive black",
    brand: "Maison Margiela",
    size: "M",
    rawListing: {
      productType: "Outerwear",
      category_path: ["mens", "clothing", "jackets"]
    }
  };

  const result = buildQueries(listing, {
    maxQueries: 4,
    maxTokens: 6
  });

  assert.equal(result.ok, true);
  assert.ok(result.queries.length > 0);
});
