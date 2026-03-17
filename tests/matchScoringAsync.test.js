"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

function loadMatchScoringWithVisualMock(compareImageUrls) {
  const previous = global.GrailedPlusImageSimilarity;
  const modulePath = require.resolve("../.tmp/ts-build/src/domain/matchScoring");

  delete require.cache[modulePath];
  global.GrailedPlusImageSimilarity = {
    compareImageUrls
  };

  const mod = require(modulePath);

  return {
    mod,
    cleanup() {
      delete require.cache[modulePath];
      if (previous === undefined) {
        delete global.GrailedPlusImageSimilarity;
      } else {
        global.GrailedPlusImageSimilarity = previous;
      }
    }
  };
}

test("rankCandidatesAsync uses visual similarity scores when the image service is available", async () => {
  const { mod, cleanup } = loadMatchScoringWithVisualMock(async function (_leftUrl, rightUrl) {
    if (String(rightUrl).indexOf("high-visual") !== -1) {
      return {
        score: 96,
        usedImage: true,
        reason: "ok"
      };
    }

    return {
      score: 4,
      usedImage: true,
      reason: "ok"
    };
  });

  try {
    const listing = {
      title: "Archive Jacket",
      imageUrl: "https://images.grailed.test/archive-jacket.jpg",
      rawListing: {}
    };
    const candidates = [
      {
        id: "high-visual",
        title: "Listing",
        url: "https://depop.test/item/high-visual",
        imageUrl: "https://images.depop.test/high-visual.jpg",
        price: 200,
        currency: "USD"
      },
      {
        id: "high-metadata",
        title: "Archive Jacket",
        url: "https://depop.test/item/high-metadata",
        imageUrl: "https://images.depop.test/low-visual.jpg",
        price: 200,
        currency: "USD"
      }
    ];

    const ranked = await mod.rankCandidatesAsync(listing, candidates, {
      listingPriceUsd: 200,
      selectedCurrency: "USD",
      minScore: 0,
      rankingFormula: "visual"
    });

    assert.equal(ranked[0].id, "high-visual");
    assert.equal(ranked[0].usedImage, true);
  } finally {
    cleanup();
  }
});
