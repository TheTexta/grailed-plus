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

function projectSnapshotModel(listing) {
  return {
    id: listing.id,
    title: listing.title,
    pricing: {
      history: listing && listing.pricing ? listing.pricing.history : [],
      updatedAt: listing && listing.pricing ? listing.pricing.updatedAt : null
    },
    createdAt: listing.createdAt,
    sellerCreatedAt: listing.seller && listing.seller.createdAt,
    prettyPath: listing.prettyPath,
    sold: listing.sold,
    sourceStatus: listing.sourceStatus
  };
}

test("extractListing matches expected normalized snapshots for all fixtures", () => {
  const expectedPath = path.join(__dirname, "fixtures", "expected-normalized.json");
  const expectedMap = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
  const fixtureNames = Object.keys(expectedMap);

  fixtureNames.forEach((fixtureName) => {
    const listing = extractListing(loadFixture(fixtureName));
    const projected = projectSnapshotModel(listing);
    assert.deepEqual(projected, expectedMap[fixtureName], fixtureName + " snapshot mismatch");
  });
});
