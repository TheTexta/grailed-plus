"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createRegistry } = require("../.tmp/ts-build/src/domain/marketProviders");
const { createController } = require("../.tmp/ts-build/src/domain/marketCompareController");

function sampleListing() {
  return {
    id: 555,
    title: "Vintage Jacket",
    pricing: {
      history: [180, 160, 140]
    }
  };
}

test("market compare controller starts in idle state", () => {
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock"
      };
    }
  });

  const controller = createController({ providerRegistry: registry });
  const state = controller.getState();

  assert.equal(state.status, "idle");
  assert.equal(state.provider, "Depop");
  assert.deepEqual(state.results, []);
});

test("market compare controller forwards result limit to provider search", async () => {
  const observedPayloads = [];
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function (payload) {
      observedPayloads.push(payload);
      return {
        ok: true,
        candidates: [
          {
            id: "c-limit-1",
            market: "depop",
            title: "Vintage Jacket Similar",
            url: "https://depop.test/item/limit-1",
            price: 120,
            currency: "USD",
            score: 72,
            deltaPercent: -14.3
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock"
      };
    }
  });

  const controller = createController({ providerRegistry: registry });
  await controller.compare({
    listing: sampleListing(),
    currency: "USD",
    minScore: 0,
    limit: 10
  });

  assert.equal(observedPayloads.length, 1);
  assert.equal(observedPayloads[0].limit, 10);
});

test("market compare controller forwards strict mode to provider search", async () => {
  const observedPayloads = [];
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function (payload) {
      observedPayloads.push(payload);
      return {
        ok: true,
        candidates: [],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock"
      };
    }
  });

  const controller = createController({ providerRegistry: registry });
  await controller.compare({
    listing: sampleListing(),
    currency: "USD",
    minScore: 0,
    allowCategoryFallback: false
  });

  assert.equal(observedPayloads.length, 1);
  assert.equal(observedPayloads[0].strictMode, true);
});

test("market compare controller sends the most specific query first even outside strict mode", async () => {
  const observedPayloads = [];
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function (payload) {
      observedPayloads.push(payload);
      return {
        ok: true,
        candidates: [],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock"
      };
    }
  });

  const controller = createController({ providerRegistry: registry });
  await controller.compare({
    listing: {
      id: 87051333,
      title: "Drain Gang Bladee Razorwire tee white L",
      brand: "Drain Gang",
      size: "L",
      category: "T-Shirts",
      pricing: {
        history: [70]
      }
    },
    currency: "CAD",
    minScore: 0
  });

  assert.equal(observedPayloads.length, 1);
  assert.deepEqual(observedPayloads[0].queries, [
    "drain gang bladee razorwire tee",
    "drain gang bladee razorwire tee l",
    "drain gang bladee",
    "drain gang l t-shirts"
  ]);
});

test("market compare controller transitions loading -> results", async () => {
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "c1",
            market: "depop",
            title: "Vintage Jacket Similar",
            url: "https://depop.test/item/1",
            price: 120,
            currency: "USD",
            score: 72,
            deltaPercent: -14.3
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock"
      };
    }
  });

  const controller = createController({ providerRegistry: registry });
  const updates = [];
  const unsubscribe = controller.subscribe((state) => {
    updates.push(state.status);
  });

  const finalState = await controller.compare({
    listing: sampleListing(),
    currency: "USD",
    minScore: 0
  });

  unsubscribe();

  assert.ok(updates.includes("loading"));
  assert.equal(finalState.status, "results");
  assert.equal(finalState.results.length, 1);
  assert.match(finalState.results[0].deltaLabel, /cheaper/);
});

test("market compare controller emits debug lifecycle logs when debug logger is enabled", async () => {
  const registry = createRegistry({ cacheTtlMs: 0 });
  const logs = [];
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "debug-1",
            market: "depop",
            title: "Vintage Jacket Similar",
            url: "https://depop.test/item/debug-1",
            price: 120,
            currency: "USD",
            score: 72,
            usedImage: true,
            imageSignalType: "ml_embedding",
            deltaPercent: -14.3
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock",
        requestCount: 1
      };
    }
  });

  const controller = createController({
    providerRegistry: registry,
    debugLogger: function (stage, payload) {
      logs.push([stage, payload]);
    }
  });

  await controller.compare({
    listing: sampleListing(),
    currency: "USD",
    minScore: 0
  });

  assert.ok(
    logs.some(function (entry) {
      return entry[0] === "compare.start";
    })
  );
  assert.ok(
    logs.some(function (entry) {
      return entry[0] === "compare.queries_built";
    })
  );
  assert.ok(
    logs.some(function (entry) {
      return entry[0] === "compare.search_dispatch";
    })
  );
  assert.ok(
    logs.some(function (entry) {
      return entry[0] === "compare.provider_success";
    })
  );
  assert.ok(
    logs.some(function (entry) {
      return entry[0] === "compare.finish_success";
    })
  );
});

test("market compare controller does not emit console logs without a debug logger", async () => {
  const registry = createRegistry({ cacheTtlMs: 0 });
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "quiet-1",
            market: "depop",
            title: "Vintage Jacket Similar",
            url: "https://depop.test/item/quiet-1",
            price: 120,
            currency: "USD",
            score: 72,
            deltaPercent: -14.3
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock"
      };
    }
  });

  const previousConsoleDebug = console.debug;
  let consoleCalls = 0;
  console.debug = function () {
    consoleCalls += 1;
  };

  try {
    const controller = createController({ providerRegistry: registry });
    await controller.compare({
      listing: sampleListing(),
      currency: "USD",
      minScore: 0
    });
  } finally {
    console.debug = previousConsoleDebug;
  }

  assert.equal(consoleCalls, 0);
});

test("market compare controller waits for async rankCandidatesAsync results", async () => {
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "async-rank-1",
            market: "depop",
            title: "Vintage Jacket Similar",
            url: "https://depop.test/item/async-rank-1",
            price: 120,
            currency: "USD"
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock"
      };
    }
  });

  let rankCalled = false;
  const controller = createController({
    providerRegistry: registry,
    rankCandidatesAsync: async function (_listing, candidates) {
      rankCalled = true;
      await Promise.resolve();

      return candidates.map(function (candidate) {
        return {
          id: candidate.id,
          title: candidate.title,
          url: candidate.url,
          imageUrl: candidate.imageUrl || "",
          market: candidate.market || "depop",
          currency: candidate.currency || "USD",
          originalCurrency: candidate.currency || "USD",
          originalPrice: candidate.price,
          price: candidate.price,
          score: 44,
          usedImage: false,
          imageUnavailableReason: "",
          deltaPercent: -10
        };
      });
    }
  });

  const finalState = await controller.compare({
    listing: sampleListing(),
    currency: "USD",
    minScore: 0
  });

  assert.equal(rankCalled, true);
  assert.equal(finalState.status, "results");
  assert.equal(finalState.results[0].id, "async-rank-1");
});

test("market compare controller recomputes delta label when ranked candidate is incorrectly marked same price", async () => {
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "c-same-price-bug",
            market: "depop",
            title: "PXE tee",
            url: "https://depop.test/item/pxe",
            price: 68.52,
            currency: "CAD",
            score: 24,
            deltaPercent: 0,
            deltaLabel: "same price"
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock"
      };
    }
  });

  const controller = createController({
    providerRegistry: registry,
    rankCandidates: function (_listing, candidates) {
      return candidates.map(function (candidate) {
        return {
          id: candidate.id,
          title: candidate.title,
          url: candidate.url,
          imageUrl: candidate.imageUrl || "",
          market: candidate.market || "depop",
          currency: candidate.currency || "CAD",
          originalCurrency: candidate.currency || "CAD",
          originalPrice: candidate.price,
          price: candidate.price,
          score: 24,
          usedImage: false,
          imageUnavailableReason: "",
          deltaPercent: 0,
          deltaLabel: "same price"
        };
      });
    }
  });

  const finalState = await controller.compare({
    listing: sampleListing(),
    currency: "CAD",
    currencyRate: 1.25,
    minScore: 0
  });

  assert.equal(finalState.status, "results");
  assert.equal(finalState.results.length, 1);
  assert.notEqual(finalState.results[0].deltaLabel, "same price");
  assert.match(finalState.results[0].deltaLabel, /cheaper/);
});

test("market compare controller falls back to raw listing price when price history is empty", async () => {
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "c-raw-price",
            market: "depop",
            title: "PXE tee",
            url: "https://depop.test/item/raw-price",
            price: 80,
            currency: "USD",
            score: 24,
            deltaPercent: 0,
            deltaLabel: "same price"
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock"
      };
    }
  });

  const controller = createController({
    providerRegistry: registry,
    rankCandidates: function (_listing, candidates) {
      return candidates.map(function (candidate) {
        return {
          id: candidate.id,
          title: candidate.title,
          url: candidate.url,
          imageUrl: candidate.imageUrl || "",
          market: candidate.market || "depop",
          currency: candidate.currency || "USD",
          originalCurrency: candidate.currency || "USD",
          originalPrice: candidate.price,
          price: candidate.price,
          score: 24,
          usedImage: false,
          imageUnavailableReason: "",
          deltaPercent: 0,
          deltaLabel: "same price"
        };
      });
    }
  });

  const finalState = await controller.compare({
    listing: {
      id: 556,
      title: "No drop history",
      pricing: {
        history: []
      },
      rawListing: {
        price: 100
      }
    },
    currency: "USD",
    minScore: 0
  });

  assert.equal(finalState.status, "results");
  assert.equal(finalState.results.length, 1);
  assert.match(finalState.results[0].deltaLabel, /cheaper/);
});

test("market compare controller enforces single in-flight request per listing", async () => {
  let callCount = 0;
  let resolveSearch;
  const pendingSearch = new Promise((resolve) => {
    resolveSearch = resolve;
  });

  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: function () {
      callCount += 1;
      return pendingSearch;
    }
  });

  const controller = createController({ providerRegistry: registry });
  const listing = sampleListing();

  const p1 = controller.compare({ listing, currency: "USD" });
  const p2 = controller.compare({ listing, currency: "USD" });

  assert.equal(callCount, 1);
  assert.equal(p1, p2);

  resolveSearch({
    ok: true,
    candidates: [],
    fetchedAt: Date.now(),
    partial: false,
    sourceType: "mock"
  });

  const done = await p1;
  assert.equal(done.status, "no-results");
});

test("market compare controller surfaces broad-search hint on category fallback", async () => {
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "fallback-1",
            market: "depop",
            title: "Generic match",
            url: "https://depop.test/item/fallback-1",
            price: 100,
            currency: "USD"
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock"
      };
    }
  });

  const controller = createController({
    providerRegistry: registry,
    synthesizeQueries: function () {
      return {
        ok: true,
        queries: ["generic search"],
        reason: "category_fallback"
      };
    },
    rankCandidates: function (_listing, candidates) {
      return candidates.map(function (candidate) {
        return {
          id: candidate.id,
          title: candidate.title,
          url: candidate.url,
          imageUrl: candidate.imageUrl || "",
          market: candidate.market || "depop",
          currency: candidate.currency || "USD",
          originalCurrency: candidate.currency || "USD",
          originalPrice: candidate.price,
          price: candidate.price,
          score: 10,
          usedImage: false,
          imageUnavailableReason: "",
          deltaPercent: 0
        };
      });
    }
  });

  const finalState = await controller.compare({
    listing: {
      id: 999,
      title: "Unknown category object",
      pricing: {
        history: [120]
      }
    },
    currency: "USD",
    minScore: 0
  });

  assert.equal(finalState.status, "results");
  assert.match(finalState.message, /broad search/i);
});

test("market compare controller keeps depop fallback results when strict score threshold removes all", async () => {
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "intl-1",
            market: "depop",
            title: "drain gang world tour",
            url: "https://depop.test/item/intl-1",
            price: 100,
            currency: "USD"
          }
        ],
        fetchedAt: Date.now(),
        partial: true,
        sourceType: "html"
      };
    }
  });

  const controller = createController({
    providerRegistry: registry,
    rankCandidates: function (_listing, candidates, options) {
      if (options.minScore > 0) {
        return [];
      }

      return candidates.map(function (candidate) {
        return {
          id: candidate.id,
          title: candidate.title,
          url: candidate.url,
          imageUrl: candidate.imageUrl || "",
          market: candidate.market || "depop",
          currency: candidate.currency || "USD",
          originalCurrency: candidate.currency || "USD",
          originalPrice: candidate.price,
          price: candidate.price,
          score: 5,
          usedImage: false,
          imageUnavailableReason: "",
          deltaPercent: 0
        };
      });
    }
  });
  const finalState = await controller.compare({
    listing: sampleListing(),
    currency: "USD",
    minScore: 40
  });

  assert.equal(finalState.status, "results");
  assert.equal(finalState.results.length, 1);
  assert.equal(finalState.results[0].id, "intl-1");
});

test("market compare controller forwards strict mode to query synthesis without changing fallback rerank behavior", async () => {
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "strict-query-1",
            market: "depop",
            title: "drain gang world tour",
            url: "https://depop.test/item/strict-query-1",
            price: 100,
            currency: "USD"
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "html"
      };
    }
  });

  const observedBuildOptions = [];
  const observedMinScores = [];
  const observedRankingFormulas = [];
  const controller = createController({
    providerRegistry: registry,
    synthesizeQueries: function (_listing, options) {
      observedBuildOptions.push(options);
      return {
        ok: true,
        queries: ["drain gang world tour"],
        reason: "ok"
      };
    },
    rankCandidates: function (_listing, candidates, options) {
      observedMinScores.push(options.minScore);
      observedRankingFormulas.push(options.rankingFormula);

      if (options.minScore > 0) {
        return [];
      }

      return candidates.map(function (candidate) {
        return {
          id: candidate.id,
          title: candidate.title,
          url: candidate.url,
          imageUrl: candidate.imageUrl || "",
          market: candidate.market || "depop",
          currency: candidate.currency || "USD",
          originalCurrency: candidate.currency || "USD",
          originalPrice: candidate.price,
          price: candidate.price,
          score: 12,
          usedImage: false,
          imageUnavailableReason: "",
          deltaPercent: 0
        };
      });
    }
  });

  const finalState = await controller.compare({
    listing: sampleListing(),
    currency: "USD",
    minScore: 50,
    rankingFormula: "visual",
    allowCategoryFallback: false
  });

  assert.equal(observedBuildOptions.length, 1);
  assert.equal(observedBuildOptions[0].allowCategoryFallback, false);
  assert.deepEqual(observedMinScores, [50, 0]);
  assert.deepEqual(observedRankingFormulas, ["visual", "visual"]);
  assert.equal(finalState.status, "results");
  assert.equal(finalState.results[0].id, "strict-query-1");
});

test("market compare controller keeps hybrid source and reranks depop fallback", async () => {
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "hybrid-1",
            market: "depop",
            title: "drain gang world tour",
            url: "https://depop.test/item/hybrid-1",
            price: 90,
            currency: "USD"
          }
        ],
        fetchedAt: Date.now(),
        partial: true,
        sourceType: "hybrid"
      };
    }
  });

  const observedMinScores = [];
  const controller = createController({
    providerRegistry: registry,
    rankCandidates: function (_listing, candidates, options) {
      observedMinScores.push(options.minScore);

      if (options.minScore > 0) {
        return [];
      }

      return candidates.map(function (candidate) {
        return {
          id: candidate.id,
          title: candidate.title,
          url: candidate.url,
          imageUrl: candidate.imageUrl || "",
          market: candidate.market || "depop",
          currency: candidate.currency || "USD",
          originalCurrency: candidate.currency || "USD",
          originalPrice: candidate.price,
          price: candidate.price,
          score: 1,
          usedImage: false,
          imageUnavailableReason: "",
          deltaPercent: 0
        };
      });
    }
  });

  const finalState = await controller.compare({
    listing: sampleListing(),
    currency: "USD",
    minScore: 40
  });

  assert.deepEqual(observedMinScores, [40, 0]);
  assert.equal(finalState.status, "results");
  assert.equal(finalState.sourceType, "hybrid");
  assert.equal(finalState.results.length, 1);
  assert.equal(finalState.results[0].id, "hybrid-1");
});

test("market compare controller prefers positive-price candidates over zero-price entries", async () => {
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "zero-1",
            market: "depop",
            title: "fallback",
            url: "https://depop.test/item/zero-1",
            price: 0,
            currency: "USD"
          },
          {
            id: "priced-1",
            market: "depop",
            title: "drain gang chaos",
            url: "https://depop.test/item/priced-1",
            price: 88,
            currency: "USD"
          }
        ],
        fetchedAt: Date.now(),
        partial: true,
        sourceType: "hybrid"
      };
    }
  });

  const controller = createController({
    providerRegistry: registry,
    rankCandidates: function (_listing, candidates) {
      return candidates.map(function (candidate) {
        return {
          id: candidate.id,
          title: candidate.title,
          url: candidate.url,
          imageUrl: candidate.imageUrl || "",
          market: candidate.market || "depop",
          currency: candidate.currency || "USD",
          originalCurrency: candidate.currency || "USD",
          originalPrice: candidate.price,
          price: candidate.price,
          score: 8,
          usedImage: false,
          imageUnavailableReason: "",
          deltaPercent: 0
        };
      });
    }
  });
  const finalState = await controller.compare({
    listing: sampleListing(),
    currency: "USD",
    minScore: 0
  });

  assert.equal(finalState.status, "results");
  assert.ok(finalState.results.length >= 1);
  assert.ok(finalState.results.every((entry) => Number(entry.price) > 0));
});

test("market compare controller keeps zero-score entries in display results", async () => {
  const registry = createRegistry();
  registry.register({
    market: "depop",
    search: async function () {
      return {
        ok: true,
        candidates: [
          {
            id: "candidate-1",
            market: "depop",
            title: "drain gang chaos",
            url: "https://depop.test/item/candidate-1",
            price: 88,
            currency: "USD"
          },
          {
            id: "candidate-2",
            market: "depop",
            title: "random",
            url: "https://depop.test/item/candidate-2",
            price: 70,
            currency: "USD"
          }
        ],
        fetchedAt: Date.now(),
        partial: true,
        sourceType: "hybrid"
      };
    }
  });

  const controller = createController({
    providerRegistry: registry,
    rankCandidates: function (_listing, candidates) {
      return [
        {
          id: candidates[0].id,
          title: candidates[0].title,
          url: candidates[0].url,
          imageUrl: "",
          market: "depop",
          currency: "USD",
          originalCurrency: "USD",
          originalPrice: 88,
          price: 88,
          score: 9,
          usedImage: false,
          imageUnavailableReason: "",
          deltaPercent: 0
        },
        {
          id: candidates[1].id,
          title: candidates[1].title,
          url: candidates[1].url,
          imageUrl: "",
          market: "depop",
          currency: "USD",
          originalCurrency: "USD",
          originalPrice: 70,
          price: 70,
          score: 0,
          usedImage: false,
          imageUnavailableReason: "",
          deltaPercent: 0
        }
      ];
    }
  });

  const finalState = await controller.compare({
    listing: sampleListing(),
    currency: "USD",
    minScore: 0
  });

  assert.equal(finalState.status, "results");
  assert.equal(finalState.results.length, 2);
  assert.equal(finalState.results[0].id, "candidate-1");
  assert.equal(finalState.results[1].id, "candidate-2");
});
