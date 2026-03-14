"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createRegistry } = require("../.tmp/ts-build/src/domain/marketProviders");

test("market providers registry dedupes in-flight requests for identical inputs", async () => {
  let callCount = 0;
  let resolveSearch;
  const pending = new Promise((resolve) => {
    resolveSearch = resolve;
  });

  const registry = createRegistry({ cacheTtlMs: 0 });
  registry.register({
    market: "depop",
    search: function () {
      callCount += 1;
      return pending;
    }
  });

  const input = {
    queries: ["vintage jacket"],
    currency: "USD"
  };

  const p1 = registry.search("depop", input);
  const p2 = registry.search("depop", {
    currency: "USD",
    queries: ["vintage jacket"]
  });

  assert.equal(callCount, 1);
  assert.equal(p1, p2);

  resolveSearch({
    ok: true,
    candidates: [],
    fetchedAt: Date.now(),
    partial: false,
    sourceType: "mock",
    parserVersion: "",
    parserMismatchLikely: false,
    requestCount: 1,
    errorCode: "",
    retryAfterMs: null
  });

  const finalResult = await p1;
  assert.equal(finalResult.ok, true);
});

test("market providers registry uses TTL cache for successful identical searches", async () => {
  let callCount = 0;
  const registry = createRegistry({ cacheTtlMs: 80 });

  registry.register({
    market: "depop",
    search: async function () {
      callCount += 1;
      return {
        ok: true,
        candidates: [
          {
            market: "depop",
            id: "cached-1",
            title: "Cached Jacket",
            url: "https://depop.test/item/cached-1",
            imageUrl: "",
            price: 99,
            currency: "USD",
            score: 50,
            deltaAbsolute: -1,
            deltaPercent: -1,
            raw: null
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock",
        parserVersion: "",
        parserMismatchLikely: false,
        requestCount: 1,
        errorCode: "",
        retryAfterMs: null
      };
    }
  });

  const input = {
    queries: ["cached jacket"],
    currency: "USD"
  };

  const first = await registry.search("depop", input);
  const second = await registry.search("depop", {
    currency: "USD",
    queries: ["cached jacket"]
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(callCount, 1);

  await new Promise((resolve) => setTimeout(resolve, 110));
  await registry.search("depop", input);
  assert.equal(callCount, 2);
});

test("market providers registry does not cache failed responses", async () => {
  let callCount = 0;
  const registry = createRegistry({ cacheTtlMs: 1000 });

  registry.register({
    market: "depop",
    search: async function () {
      callCount += 1;
      return {
        ok: false,
        candidates: [],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock",
        parserVersion: "",
        parserMismatchLikely: false,
        requestCount: 1,
        errorCode: "NETWORK_ERROR",
        retryAfterMs: 100
      };
    }
  });

  const input = {
    queries: ["failed jacket"],
    currency: "USD"
  };

  const first = await registry.search("depop", input);
  const second = await registry.search("depop", input);

  assert.equal(first.ok, false);
  assert.equal(second.ok, false);
  assert.equal(callCount, 2);
});

test("market providers registry evicts oldest cached key when max entries exceeded", async () => {
  let callCount = 0;
  const registry = createRegistry({ cacheTtlMs: 5000, cacheMaxEntries: 2 });

  registry.register({
    market: "depop",
    search: async function (input) {
      callCount += 1;
      const firstQuery = Array.isArray(input && input.queries) ? String(input.queries[0] || "") : "";
      return {
        ok: true,
        candidates: [
          {
            market: "depop",
            id: "evict-" + firstQuery,
            title: "Evict " + firstQuery,
            url: "https://depop.test/item/" + firstQuery,
            imageUrl: "",
            price: 50,
            currency: "USD",
            score: 30,
            deltaAbsolute: 0,
            deltaPercent: 0,
            raw: null
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock",
        parserVersion: "",
        parserMismatchLikely: false,
        requestCount: 1,
        errorCode: "",
        retryAfterMs: null
      };
    }
  });

  const inputA = { queries: ["a"], currency: "USD" };
  const inputB = { queries: ["b"], currency: "USD" };
  const inputC = { queries: ["c"], currency: "USD" };

  await registry.search("depop", inputA);
  await registry.search("depop", inputB);
  await registry.search("depop", inputC);
  assert.equal(callCount, 3);

  await registry.search("depop", inputB);
  await registry.search("depop", inputC);
  assert.equal(callCount, 3);

  await registry.search("depop", inputA);
  assert.equal(callCount, 4);
});

test("market providers registry exposes debug diagnostics counters when enabled", async () => {
  let callCount = 0;
  const registry = createRegistry({
    cacheTtlMs: 5000,
    cacheMaxEntries: 2,
    enableDiagnostics: true
  });

  registry.register({
    market: "depop",
    search: async function (input) {
      callCount += 1;
      const firstQuery = Array.isArray(input && input.queries) ? String(input.queries[0] || "") : "";
      return {
        ok: true,
        candidates: [
          {
            market: "depop",
            id: "diag-" + firstQuery,
            title: "Diag " + firstQuery,
            url: "https://depop.test/item/diag-" + firstQuery,
            imageUrl: "",
            price: 60,
            currency: "USD",
            score: 20,
            deltaAbsolute: 0,
            deltaPercent: 0,
            raw: null
          }
        ],
        fetchedAt: Date.now(),
        partial: false,
        sourceType: "mock",
        parserVersion: "",
        parserMismatchLikely: false,
        requestCount: 1,
        errorCode: "",
        retryAfterMs: null
      };
    }
  });

  await registry.search("depop", { queries: ["a"], currency: "USD" });
  await registry.search("depop", { queries: ["a"], currency: "USD" });
  await registry.search("depop", { queries: ["b"], currency: "USD" });
  await registry.search("depop", { queries: ["c"], currency: "USD" });

  assert.equal(callCount, 3);

  const diagnostics = registry.getDiagnostics();
  assert.ok(diagnostics);
  assert.equal(diagnostics.searchCalls, 4);
  assert.equal(diagnostics.cacheHits, 1);
  assert.equal(diagnostics.cacheMisses, 3);
  assert.equal(diagnostics.cacheStores, 3);
  assert.equal(diagnostics.evictions, 1);
  assert.equal(diagnostics.inFlightHits, 0);

  assert.equal(registry.resetDiagnostics(), true);
  const resetDiagnostics = registry.getDiagnostics();
  assert.ok(resetDiagnostics);
  assert.equal(resetDiagnostics.searchCalls, 0);
  assert.equal(resetDiagnostics.cacheHits, 0);
  assert.equal(resetDiagnostics.cacheMisses, 0);
  assert.equal(resetDiagnostics.cacheStores, 0);
  assert.equal(resetDiagnostics.evictions, 0);
  assert.equal(resetDiagnostics.inFlightHits, 0);
});

test("market providers registry tracks in-flight dedupe hits in diagnostics", async () => {
  let resolveSearch;
  const pending = new Promise((resolve) => {
    resolveSearch = resolve;
  });

  const registry = createRegistry({
    cacheTtlMs: 0,
    enableDiagnostics: true
  });

  registry.register({
    market: "depop",
    search: function () {
      return pending;
    }
  });

  const p1 = registry.search("depop", { queries: ["pending"], currency: "USD" });
  const p2 = registry.search("depop", { queries: ["pending"], currency: "USD" });

  assert.equal(p1, p2);

  resolveSearch({
    ok: true,
    candidates: [],
    fetchedAt: Date.now(),
    partial: false,
    sourceType: "mock",
    parserVersion: "",
    parserMismatchLikely: false,
    requestCount: 1,
    errorCode: "",
    retryAfterMs: null
  });

  await p1;

  const diagnostics = registry.getDiagnostics();
  assert.ok(diagnostics);
  assert.equal(diagnostics.searchCalls, 2);
  assert.equal(diagnostics.inFlightHits, 1);
});