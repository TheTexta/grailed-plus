"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { extractListing } = require("../.tmp/ts-build/src/data/listingExtractor");

function loadFixture(name) {
  const fixturePath = path.join(__dirname, "fixtures", name);
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

test("extractListing normalizes valid listing payload", () => {
  const nextData = loadFixture("next-data-active.json");
  const listing = extractListing(nextData);

  assert.equal(listing.id, 123456);
  assert.equal(listing.title, "Sample Listing");
  assert.deepEqual(listing.pricing.history, [1000, 900, 810]);
  assert.equal(listing.sourceStatus, "ok");
  assert.equal(typeof listing.createdAt, "string");
  assert.equal(typeof listing.pricing.updatedAt, "string");
  assert.equal(typeof listing.seller.createdAt, "string");
});

test("extractListing supports snake_case keys and missing seller fields", () => {
  const nextData = loadFixture("next-data-missing-seller.json");
  const listing = extractListing(nextData);

  assert.equal(listing.id, 333);
  assert.deepEqual(listing.pricing.history, [500, 450]);
  assert.equal(listing.seller.createdAt, null);
  assert.equal(listing.prettyPath, "/listings/333-missing-seller");
});

test("extractListing supports sold listings", () => {
  const nextData = loadFixture("next-data-sold.json");
  const listing = extractListing(nextData);

  assert.equal(listing.id, 444);
  assert.equal(listing.sold, true);
  assert.equal(listing.title, "Sold Listing");
  assert.deepEqual(listing.pricing.history, [350, 300, 275]);
  assert.equal(listing.sourceStatus, "ok");
});

test("extractListing handles missing listing payload", () => {
  const listing = extractListing({ props: { pageProps: {} } });

  assert.equal(listing.id, null);
  assert.deepEqual(listing.pricing.history, []);
  assert.equal(listing.sourceStatus, "missing_listing");
});
