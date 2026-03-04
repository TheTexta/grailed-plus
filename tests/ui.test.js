"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { renderPanel } = require("../src/ui/renderPanel.js");
const { MockDocument, flattenText } = require("./helpers/mockDocument.js");

function createHarness() {
  const doc = new MockDocument();
  const main = doc.createElement("main");
  const anchor = doc.createElement("div");
  anchor.textContent = "Listing Price";

  doc.body.appendChild(main);
  main.appendChild(anchor);

  return { doc, main, anchor };
}

function sampleListing() {
  return {
    id: 123,
    title: "Sample",
    priceDrops: [1000, 900, 810],
    createdAt: "2026-01-01T00:00:00.000Z",
    priceUpdatedAt: "2026-01-11T00:00:00.000Z",
    seller: {
      createdAt: "2020-01-01T00:00:00.000Z"
    },
    rawListing: {
      id: 123
    }
  };
}

test("renderPanel inserts panel after mount node", () => {
  const { doc, main, anchor } = createHarness();

  const panel = renderPanel({
    listing: sampleListing(),
    metrics: {
      avgDropAmount: 95,
      avgDropPercent: 10,
      expectedDropDays: 2,
      expectedDropState: "scheduled"
    },
    mountNode: anchor,
    rawListing: { id: 123 }
  });

  assert.ok(panel);
  assert.equal(main.children[1], panel);
  assert.equal(panel.getAttribute("data-grailed-plus-panel"), "1");
  assert.match(flattenText(panel), /Grailed Plus/);
  assert.match(flattenText(panel), /Listing Metadata/);
});

test("renderPanel re-renders without duplicates", () => {
  const { doc, anchor } = createHarness();

  renderPanel({
    listing: sampleListing(),
    metrics: {
      avgDropAmount: 95,
      avgDropPercent: 10,
      expectedDropDays: 2,
      expectedDropState: "scheduled"
    },
    mountNode: anchor,
    rawListing: { id: 123 }
  });

  renderPanel({
    listing: sampleListing(),
    metrics: {
      avgDropAmount: 120,
      avgDropPercent: 12,
      expectedDropDays: 5,
      expectedDropState: "scheduled"
    },
    mountNode: anchor,
    rawListing: { id: 123 }
  });

  assert.equal(doc.querySelectorAll('[data-grailed-plus-panel="1"]').length, 1);
});
