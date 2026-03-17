"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createImageSimilarityService,
  computeDifferenceHash,
  compareHashes
} = require("../.tmp/ts-build/src/domain/imageSimilarity");

function ascendingGrid() {
  const values = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      values.push(x);
    }
  }
  return values;
}

function descendingGrid() {
  const values = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 8; x >= 0; x -= 1) {
      values.push(x);
    }
  }
  return values;
}

test("computeDifferenceHash returns a stable 64-bit hash", () => {
  const hash = computeDifferenceHash(ascendingGrid(), 9, 8);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[01]{64}$/);
});

test("compareHashes returns 100 for identical hashes and 0 for inverse hashes", () => {
  const leftHash = computeDifferenceHash(ascendingGrid(), 9, 8);
  const rightHash = computeDifferenceHash(ascendingGrid(), 9, 8);
  const inverseHash = computeDifferenceHash(descendingGrid(), 9, 8);

  assert.equal(compareHashes(leftHash, rightHash), 100);
  assert.equal(compareHashes(leftHash, inverseHash), 0);
});

test("image similarity service caches loaded grids by url", async () => {
  let loadCalls = 0;
  const gridsByUrl = {
    "image://left": ascendingGrid(),
    "image://right": ascendingGrid(),
    "image://different": descendingGrid()
  };
  const service = createImageSimilarityService({
    loadGrayscaleGrid: async function (url) {
      loadCalls += 1;
      return gridsByUrl[url] || null;
    },
    cacheMaxEntries: 4
  });

  const first = await service.compareImageUrls("image://left", "image://right");
  const second = await service.compareImageUrls("image://left", "image://different");
  const third = await service.compareImageUrls("image://left", "image://right");

  assert.equal(first.usedImage, true);
  assert.equal(first.score, 100);
  assert.equal(second.usedImage, true);
  assert.equal(second.score, 0);
  assert.equal(third.score, 100);
  assert.equal(loadCalls, 3);
});
