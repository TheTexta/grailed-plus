"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { convertBetweenCurrencies, scoreCandidate, rankCandidates } = require("../src/domain/matchScoring.js");

test("convertBetweenCurrencies converts via USD base rates", () => {
  const ratesByUsd = {
    EUR: 0.9,
    GBP: 0.78,
    CAD: 1.35
  };

  const eurToGbp = convertBetweenCurrencies(90, "EUR", "GBP", ratesByUsd);
  assert.equal(Number(eurToGbp.toFixed(2)), 78);

  const gbpToUsd = convertBetweenCurrencies(78, "GBP", "USD", ratesByUsd);
  assert.equal(Number(gbpToUsd.toFixed(2)), 100);
});

test("scoreCandidate computes delta using candidate currency when non-USD", () => {
  const listing = {
    title: "Stone Island Jacket",
    pricing: {
      history: [140]
    },
    rawListing: {
      condition: "Good"
    }
  };

  const candidate = {
    id: "c1",
    title: "Stone Island Jacket Similar",
    url: "https://depop.test/item/1",
    imageUrl: "https://images.test/jacket.jpg",
    price: 120,
    currency: "EUR",
    condition: "Good"
  };

  const scored = scoreCandidate(listing, candidate, {
    listingPriceUsd: 140,
    selectedCurrency: "USD",
    ratesByUsd: {
      EUR: 0.8
    }
  });

  assert.equal(scored.originalCurrency, "EUR");
  assert.equal(scored.originalPrice, 120);
  assert.equal(Number(scored.price.toFixed(2)), 150);
  assert.equal(Number(scored.deltaAbsolute.toFixed(2)), 10);
});

test("rankCandidates applies min score threshold and sort order", () => {
  const listing = {
    title: "Vintage Bomber Jacket",
    pricing: {
      history: [120]
    },
    rawListing: {}
  };

  const candidates = [
    {
      id: "a",
      title: "Vintage Bomber Jacket",
      url: "https://depop.test/item/a",
      imageUrl: "https://img/a.jpg",
      price: 110,
      currency: "USD"
    },
    {
      id: "b",
      title: "Different Product",
      url: "https://depop.test/item/b",
      imageUrl: "",
      price: 80,
      currency: "USD"
    }
  ];

  const ranked = rankCandidates(listing, candidates, {
    listingPriceUsd: 120,
    selectedCurrency: "USD",
    minScore: 40
  });

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, "a");
});

test("scoreCandidate uses metadata fallback when images are missing", () => {
  const listing = {
    title: "Stone Island Wool Overshirt",
    brand: "Stone Island",
    size: "M",
    pricing: {
      history: [250]
    },
    rawListing: {
      condition: "Good"
    }
  };

  const candidate = {
    id: "meta-1",
    title: "Stone Island Wool Overshirt M",
    url: "https://depop.test/item/meta-1",
    price: 200,
    currency: "USD",
    brand: "Stone Island",
    size: "M",
    condition: "Good",
    imageUrl: ""
  };

  const scored = scoreCandidate(listing, candidate, {
    listingPriceUsd: 250,
    selectedCurrency: "USD"
  });

  assert.equal(scored.usedImage, false);
  assert.equal(scored.imageUnavailableReason, "missing_url");
  assert.ok(Number.isFinite(scored.score));
  assert.match(String(scored.id), /meta-1/);
});

test("scoreCandidate uses URL slug tokens to avoid zero-only title scores", () => {
  const listing = {
    title: "Drain Gang Chaos T Shirt White",
    pricing: {
      history: [84]
    },
    rawListing: {}
  };

  const candidate = {
    id: "slug-score-1",
    title: "Listing",
    url: "https://www.depop.com/products/drain-gang-chaos-t-shirt-white/",
    imageUrl: "",
    price: 90,
    currency: "USD"
  };

  const scored = scoreCandidate(listing, candidate, {
    listingPriceUsd: 84,
    selectedCurrency: "USD"
  });

  assert.ok(Number.isFinite(scored.score));
  assert.ok(scored.score > 0);
});
