"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { convertBetweenCurrencies, scoreCandidate, rankCandidates } = require("../.tmp/ts-build/src/domain/matchScoring");

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

test("scoreCandidate converts listing price with ratesByUsd when selected currency is non-USD", () => {
  const listing = {
    title: "Stone Island Jacket",
    pricing: {
      history: [100]
    },
    rawListing: {
      condition: "Good"
    }
  };

  const candidate = {
    id: "c-rates",
    title: "Stone Island Jacket Similar",
    url: "https://depop.test/item/rates",
    imageUrl: "https://images.test/jacket-cad.jpg",
    price: 80,
    currency: "EUR",
    condition: "Good"
  };

  const scored = scoreCandidate(listing, candidate, {
    listingPriceUsd: 100,
    selectedCurrency: "CAD",
    ratesByUsd: {
      EUR: 0.8,
      CAD: 1.25
    }
  });

  assert.equal(Number(scored.price.toFixed(2)), 125);
  assert.equal(Number(scored.deltaAbsolute.toFixed(2)), 0);
  assert.equal(Number(scored.deltaPercent.toFixed(2)), 0);
});

test("scoreCandidate preserves original candidate currency when conversion is unavailable", () => {
  const listing = {
    title: "Stone Island Jacket",
    pricing: {
      history: [100]
    },
    rawListing: {
      condition: "Good"
    }
  };

  const candidate = {
    id: "c-missing-rate",
    title: "Stone Island Jacket Similar",
    url: "https://depop.test/item/missing-rate",
    imageUrl: "https://images.test/jacket-eur.jpg",
    price: 80,
    currency: "EUR",
    condition: "Good"
  };

  const scored = scoreCandidate(listing, candidate, {
    listingPriceUsd: 100,
    selectedCurrency: "CAD",
    rate: 1.35,
    ratesByUsd: {
      CAD: 1.35
    }
  });

  assert.equal(scored.currency, "EUR");
  assert.equal(scored.price, 80);
  assert.equal(scored.deltaAbsolute, null);
  assert.equal(scored.deltaPercent, null);
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

test("rankCandidates changes ordering when ranking formula switches between visual and metadata", () => {
  const listing = {
    title: "Stone Island Jacket Blue",
    brand: "Stone Island",
    size: "M",
    imageUrl: "https://cdn.example.com/stone-island-jacket-blue-front.jpg",
    pricing: {
      history: [220]
    },
    rawListing: {
      condition: "Good"
    }
  };

  const candidates = [
    {
      id: "visual-first",
      title: "Outerwear piece",
      url: "https://depop.test/item/visual-first",
      imageUrl: "https://cdn.example.com/stone-island-jacket-blue-front.jpg",
      price: 210,
      currency: "USD"
    },
    {
      id: "metadata-first",
      title: "Stone Island Jacket Blue",
      url: "https://depop.test/item/metadata-first",
      imageUrl: "https://images.depop.test/plain-red-shirt.jpg",
      price: 215,
      currency: "USD",
      brand: "Stone Island",
      size: "M",
      condition: "Good"
    }
  ];

  const visualRanked = rankCandidates(listing, candidates, {
    listingPriceUsd: 220,
    selectedCurrency: "USD",
    minScore: 0,
    rankingFormula: "visual"
  });
  const metadataRanked = rankCandidates(listing, candidates, {
    listingPriceUsd: 220,
    selectedCurrency: "USD",
    minScore: 0,
    rankingFormula: "metadata"
  });

  assert.equal(visualRanked[0].id, "visual-first");
  assert.equal(metadataRanked[0].id, "metadata-first");
});

test("rankCandidates lets variant formula prefer matching size and condition", () => {
  const listing = {
    title: "Kapital fleece zip jacket",
    brand: "Kapital",
    size: "L",
    imageUrl: "https://images.example.com/kapital-fleece-front.jpg",
    pricing: {
      history: [310]
    },
    rawListing: {
      condition: "Excellent"
    }
  };

  const candidates = [
    {
      id: "title-heavy",
      title: "Kapital fleece zip jacket L",
      url: "https://depop.test/item/title-heavy",
      imageUrl: "https://images.example.com/kapital-fleece-front.jpg",
      price: 305,
      currency: "USD",
      brand: "Kapital",
      size: "M",
      condition: "Good"
    },
    {
      id: "variant-heavy",
      title: "Kapital jacket",
      url: "https://depop.test/item/variant-heavy",
      imageUrl: "https://cdn.other.net/p/42.jpg",
      price: 300,
      currency: "USD",
      brand: "Kapital",
      size: "L",
      condition: "Excellent"
    }
  ];

  const metadataRanked = rankCandidates(listing, candidates, {
    listingPriceUsd: 310,
    selectedCurrency: "USD",
    minScore: 0,
    rankingFormula: "metadata"
  });
  const variantRanked = rankCandidates(listing, candidates, {
    listingPriceUsd: 310,
    selectedCurrency: "USD",
    minScore: 0,
    rankingFormula: "variant"
  });

  assert.equal(metadataRanked[0].id, "title-heavy");
  assert.equal(variantRanked[0].id, "variant-heavy");
});
