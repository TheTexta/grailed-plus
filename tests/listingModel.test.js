"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  fromNextData,
  mapRawListingToModel,
  createDefaultListing
} = require("../.tmp/ts-build/src/data/listingModel");

test("createDefaultListing returns stable default model", () => {
  const listing = createDefaultListing();

  assert.equal(listing.id, null);
  assert.equal(listing.title, "");
  assert.deepEqual(listing.pricing.history, []);
  assert.equal(listing.seller.createdAt, null);
  assert.equal(listing.sourceStatus, "missing_listing");
});

test("fromNextData tolerates unknown shape with defaults", () => {
  const listing = fromNextData({
    some: {
      unrelated: {
        payload: true
      }
    }
  });

  assert.equal(listing.id, null);
  assert.equal(listing.sourceStatus, "missing_listing");
});

test("mapRawListingToModel tolerates malformed field types", () => {
  const listing = mapRawListingToModel({
    id: "not-a-number",
    title: 123,
    priceDrops: ["x", 10, { amount: 5 }, -1, null],
    createdAt: "invalid",
    priceUpdatedAt: "2026-03-01T00:00:00.000Z",
    seller: {
      createdAt: "invalid"
    },
    sold: "yes"
  });

  assert.equal(listing.id, null);
  assert.equal(listing.title, "123");
  assert.deepEqual(listing.pricing.history, [10, 5]);
  assert.equal(listing.createdAt, null);
  assert.equal(listing.pricing.updatedAt, "2026-03-01T00:00:00.000Z");
  assert.equal(listing.seller.createdAt, null);
  assert.equal(listing.sold, true);
  assert.equal(listing.sourceStatus, "missing_listing_id");
});
