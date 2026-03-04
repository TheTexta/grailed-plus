"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { findMountTarget, renderPanel } = require("../src/ui/renderPanel.js");
const { MockDocument, flattenText } = require("./helpers/mockDocument.js");

function createPanelHarness() {
  const doc = new MockDocument();
  const main = doc.createElement("main");
  const anchor = doc.createElement("div");
  anchor.textContent = "Listing Price";

  doc.body.appendChild(main);
  main.appendChild(anchor);

  return { doc, main, anchor };
}

function createListingSidebar(options) {
  const settings = Object.assign(
    {
      includePrice: true,
      includeCta: true,
      ctaBeforePrice: false
    },
    options || {}
  );

  const doc = new MockDocument();
  const main = doc.createElement("main");
  const sidebar = doc.createElement("aside");
  sidebar.setAttribute("class", "sidebar__content_123");

  doc.body.appendChild(main);
  main.appendChild(sidebar);

  const price = settings.includePrice ? doc.createElement("div") : null;
  if (price) {
    price.setAttribute("class", "Sidebar_price__456");
    price.textContent = "$500";
  }

  const ctaWrap = settings.includeCta ? doc.createElement("div") : null;
  const ctaButton = settings.includeCta ? doc.createElement("button") : null;
  if (ctaWrap && ctaButton) {
    ctaWrap.setAttribute("class", "sidebar__cta_789");
    ctaButton.textContent = "Buy Now";
    ctaWrap.appendChild(ctaButton);
  }

  if (settings.ctaBeforePrice) {
    if (ctaWrap) {
      sidebar.appendChild(ctaWrap);
    }
    if (price) {
      sidebar.appendChild(price);
    }
  } else {
    if (price) {
      sidebar.appendChild(price);
    }
    if (ctaWrap) {
      sidebar.appendChild(ctaWrap);
    }
  }

  return {
    doc,
    main,
    sidebar,
    price,
    ctaWrap,
    ctaButton
  };
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

function sampleMetrics(overrides) {
  return Object.assign(
    {
      avgDropAmount: 95,
      avgDropPercent: 10,
      expectedDropDays: 2,
      expectedDropState: "scheduled"
    },
    overrides || {}
  );
}

test("findMountTarget chooses afterend of Sidebar price when CTA follows price", () => {
  const { doc, price } = createListingSidebar();

  const target = findMountTarget(doc);

  assert.ok(target);
  assert.equal(target.mountNode, price);
  assert.equal(target.mountPosition, "afterend");
  assert.equal(target.strategy, "sidebar_price");
});

test("findMountTarget ignores CTA ordering and still chooses Sidebar price", () => {
  const { doc, price } = createListingSidebar({ ctaBeforePrice: true });

  const target = findMountTarget(doc);

  assert.ok(target);
  assert.equal(target.mountNode, price);
  assert.equal(target.mountPosition, "afterend");
  assert.equal(target.strategy, "sidebar_price");
});

test("findMountTarget chooses Sidebar price when only price anchor exists", () => {
  const { doc, price } = createListingSidebar({ includeCta: false });

  const target = findMountTarget(doc);

  assert.ok(target);
  assert.equal(target.mountNode, price);
  assert.equal(target.mountPosition, "afterend");
  assert.equal(target.strategy, "sidebar_price");
});

test("findMountTarget falls back to main when only CTA exists", () => {
  const { doc, main } = createListingSidebar({ includePrice: false });

  const target = findMountTarget(doc);

  assert.ok(target);
  assert.equal(target.mountNode, main);
  assert.equal(target.mountPosition, "afterend");
  assert.equal(target.strategy, "fallback_main");
});

test("findMountTarget falls back to main when no price or CTA anchors exist", () => {
  const { doc, main } = createPanelHarness();

  const target = findMountTarget(doc);

  assert.ok(target);
  assert.equal(target.mountNode, main);
  assert.equal(target.mountPosition, "afterend");
  assert.equal(target.strategy, "fallback_main");
});

test("findMountTarget falls back to body when main is absent", () => {
  const doc = new MockDocument();

  const target = findMountTarget(doc);

  assert.ok(target);
  assert.equal(target.mountNode, doc.body);
  assert.equal(target.mountPosition, "afterend");
  assert.equal(target.strategy, "fallback_body");
});

test("renderPanel inserts panel after mount node by default", () => {
  const { main, anchor } = createPanelHarness();

  const panel = renderPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 }
  });

  assert.ok(panel);
  assert.equal(main.children[1], panel);
  assert.equal(panel.getAttribute("data-grailed-plus-panel"), "1");
  assert.match(flattenText(panel), /Grailed Plus/);
  assert.match(flattenText(panel), /Listing Metadata/);
});

test("renderPanel inserts panel before mount node when mountPosition is beforebegin", () => {
  const { main, anchor } = createPanelHarness();

  const panel = renderPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    mountPosition: "beforebegin",
    rawListing: { id: 123 }
  });

  assert.ok(panel);
  assert.equal(main.children[0], panel);
  assert.equal(main.children[1], anchor);
});

test("renderPanel re-renders without duplicates", () => {
  const { doc, anchor } = createPanelHarness();

  renderPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 }
  });

  renderPanel({
    listing: sampleListing(),
    metrics: sampleMetrics({
      avgDropAmount: 120,
      avgDropPercent: 12,
      expectedDropDays: 5
    }),
    mountNode: anchor,
    mountPosition: "beforebegin",
    rawListing: { id: 123 }
  });

  assert.equal(doc.querySelectorAll('[data-grailed-plus-panel="1"]').length, 1);
});
