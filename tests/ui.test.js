"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findMountTarget,
  renderPanel,
  applySidebarCurrency,
  applyCardCurrency
} = require("../src/ui/renderPanel.js");
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
      ctaBeforePrice: false,
      nestedPriceValue: false,
      withStrikePrice: false,
      withPercentOff: false,
      reversePriceOrder: false,
      dropPriceClasses: false
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
  const hasNestedPriceNodes = settings.nestedPriceValue || settings.withStrikePrice;
  const priceValue = settings.includePrice && hasNestedPriceNodes ? doc.createElement("span") : null;
  const pricePrevious = settings.includePrice && settings.withStrikePrice ? doc.createElement("span") : null;
  const pricePercent = settings.includePrice && settings.withPercentOff ? doc.createElement("span") : null;
  if (price) {
    price.setAttribute("class", "Sidebar_price__456");
    if (priceValue) {
      if (!settings.dropPriceClasses) {
        priceValue.setAttribute("class", "Sidebar_priceValue__999");
      }
      priceValue.textContent = "$500";
    }

    if (pricePrevious) {
      if (!settings.dropPriceClasses) {
        pricePrevious.setAttribute("class", "Sidebar_pricePrevious__888");
      }
      pricePrevious.textContent = "$650";
    }

    if (priceValue && pricePrevious) {
      if (settings.reversePriceOrder) {
        price.appendChild(priceValue);
        price.appendChild(pricePrevious);
      } else {
        price.appendChild(pricePrevious);
        price.appendChild(priceValue);
      }
    } else if (priceValue) {
      price.appendChild(priceValue);
    } else {
      price.textContent = "$500";
    }

    if (pricePercent) {
      pricePercent.setAttribute("class", "Sidebar_pricePercent__777");
      pricePercent.textContent = "23% off";
      price.appendChild(pricePercent);
    }
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
    pricePrevious,
    priceValue,
    pricePercent,
    ctaWrap,
    ctaButton
  };
}

function createCardPriceFeed(options) {
  const settings = Object.assign(
    {
      priceClass: "Price_root__5H7zK Price_small__0o0TB",
      currentClass: "Money_root__uOwWV Price_onSale__XeWB0",
      originalClass: "Money_root__uOwWV Price_original__g6NSp",
      percentClass: "Price_percentOff__DxYgt",
      items: [
        {
          current: "$80",
          original: "$130",
          percent: "38% off"
        }
      ]
    },
    options || {}
  );

  const doc = new MockDocument();
  const main = doc.createElement("main");
  const feed = doc.createElement("section");
  feed.setAttribute("class", "Homepage_feed__123");

  doc.body.appendChild(main);
  main.appendChild(feed);

  const cards = [];
  const currentPrices = [];
  const originalPrices = [];
  const percentNodes = [];

  settings.items.forEach((item) => {
    const price = doc.createElement("div");
    price.setAttribute("class", settings.priceClass);

    const current = doc.createElement("span");
    current.setAttribute("class", settings.currentClass);
    current.setAttribute("data-testid", "Current");
    current.textContent = item.current;
    let original = null;
    let percent = null;

    if (typeof item.original === "string") {
      original = doc.createElement("span");
      original.setAttribute("class", settings.originalClass);
      original.setAttribute("data-testid", "Original");
      original.textContent = item.original;
    }

    if (typeof item.percent === "string") {
      percent = doc.createElement("span");
      percent.setAttribute("class", settings.percentClass);
      percent.setAttribute("data-testid", "PercentOff");
      percent.textContent = item.percent;
    }

    price.appendChild(current);
    if (original) {
      price.appendChild(original);
    }
    if (percent) {
      price.appendChild(percent);
    }
    feed.appendChild(price);

    cards.push(price);
    currentPrices.push(current);
    if (original) {
      originalPrices.push(original);
    }
    if (percent) {
      percentNodes.push(percent);
    }
  });

  return {
    doc,
    main,
    feed,
    cards,
    currentPrices,
    originalPrices,
    percentNodes
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

function findValueNodeByLabel(panel, label) {
  const rows = panel.querySelectorAll(".grailed-plus__row");
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || !row.children || row.children.length < 2) {
      continue;
    }

    if (row.children[0].textContent === label) {
      return row.children[1];
    }
  }

  return null;
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
  assert.match(flattenText(panel), /Price History/);
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

test("renderPanel shows converted + USD values when currency context has a rate", () => {
  const { anchor } = createPanelHarness();

  const panel = renderPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    currencyContext: {
      selectedCurrency: "EUR",
      rate: 0.9,
      mode: "dual"
    }
  });

  const text = flattenText(panel);
  assert.match(text, /Price History/);
  assert.match(text, /€/);
  assert.doesNotMatch(text, /\(\$1,000\)/);
  assert.match(text, /Avg\. Price Drop/);
  assert.doesNotMatch(text, /\(\$95\)/);

  const historyValueNode = findValueNodeByLabel(panel, "Price History");
  const avgValueNode = findValueNodeByLabel(panel, "Avg. Price Drop");
  assert.ok(historyValueNode);
  assert.ok(avgValueNode);
  assert.match(historyValueNode.getAttribute("title"), /USD:/);
  assert.match(historyValueNode.getAttribute("title"), /\$1,000/);
  assert.equal(avgValueNode.getAttribute("title"), "USD: $95");
});

test("renderPanel falls back to USD-only values when no conversion rate is available", () => {
  const { anchor } = createPanelHarness();

  const panel = renderPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    currencyContext: {
      selectedCurrency: "EUR",
      rate: null,
      mode: "dual"
    }
  });

  const text = flattenText(panel);
  assert.match(text, /\$1,000/);
  assert.doesNotMatch(text, /€/);

  const historyValueNode = findValueNodeByLabel(panel, "Price History");
  const avgValueNode = findValueNodeByLabel(panel, "Avg. Price Drop");
  assert.ok(historyValueNode);
  assert.ok(avgValueNode);
  assert.ok(!historyValueNode.getAttribute("title"));
  assert.ok(!avgValueNode.getAttribute("title"));
});

test("applySidebarCurrency converts and restores the sidebar price", () => {
  const { doc, price } = createListingSidebar();
  assert.equal(price.textContent, "$500");

  const converted = applySidebarCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.match(price.textContent, /€450/);
  assert.match(price.textContent, /€/);
  assert.doesNotMatch(price.textContent, /\(\$500\)/);
  assert.equal(price.getAttribute("title"), "USD: $500");

  const restored = applySidebarCurrency(doc, {
    selectedCurrency: "USD",
    rate: null,
    mode: "dual"
  });
  assert.equal(restored, true);
  assert.equal(price.textContent, "$500");
  assert.ok(!price.getAttribute("title"));
});

test("applySidebarCurrency preserves nested price markup and classes", () => {
  const { doc, price, priceValue } = createListingSidebar({ nestedPriceValue: true });

  assert.ok(priceValue);
  assert.equal(price.children.length, 1);
  assert.equal(price.children[0], priceValue);
  assert.equal(priceValue.getAttribute("class"), "Sidebar_priceValue__999");
  assert.equal(priceValue.textContent, "$500");

  const converted = applySidebarCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.equal(price.children.length, 1);
  assert.equal(price.children[0], priceValue);
  assert.equal(priceValue.getAttribute("class"), "Sidebar_priceValue__999");
  assert.match(priceValue.textContent, /€450/);
  assert.match(priceValue.textContent, /€/);
  assert.doesNotMatch(priceValue.textContent, /\(\$500\)/);
  assert.equal(priceValue.getAttribute("title"), "USD: $500");

  const restored = applySidebarCurrency(doc, {
    selectedCurrency: "USD",
    rate: null,
    mode: "dual"
  });
  assert.equal(restored, true);
  assert.equal(price.children.length, 1);
  assert.equal(price.children[0], priceValue);
  assert.equal(priceValue.getAttribute("class"), "Sidebar_priceValue__999");
  assert.equal(priceValue.textContent, "$500");
  assert.ok(!priceValue.getAttribute("title"));
});

test("applySidebarCurrency converts strike and current listing prices without USD brackets", () => {
  const { doc, price, pricePrevious, priceValue } = createListingSidebar({ withStrikePrice: true });

  assert.ok(pricePrevious);
  assert.ok(priceValue);
  assert.equal(pricePrevious.textContent, "$650");
  assert.equal(priceValue.textContent, "$500");

  const converted = applySidebarCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.equal(price.children[0], pricePrevious);
  assert.equal(price.children[1], priceValue);
  assert.match(pricePrevious.textContent, /585/);
  assert.doesNotMatch(pricePrevious.textContent, /€/);
  assert.match(priceValue.textContent, /€450/);
  assert.equal(pricePrevious.getAttribute("title"), "USD: $650");
  assert.equal(priceValue.getAttribute("title"), "USD: $500");
  assert.doesNotMatch(pricePrevious.textContent, /\(\$/);
  assert.doesNotMatch(priceValue.textContent, /\(\$/);

  const restored = applySidebarCurrency(doc, {
    selectedCurrency: "USD",
    rate: null,
    mode: "dual"
  });
  assert.equal(restored, true);
  assert.equal(pricePrevious.textContent, "$650");
  assert.equal(priceValue.textContent, "$500");
  assert.ok(!pricePrevious.getAttribute("title"));
  assert.ok(!priceValue.getAttribute("title"));
});

test("applySidebarCurrency keeps symbol on current price even when DOM order is reversed", () => {
  const { doc, pricePrevious, priceValue } = createListingSidebar({
    withStrikePrice: true,
    reversePriceOrder: true
  });

  const converted = applySidebarCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.match(pricePrevious.textContent, /585/);
  assert.doesNotMatch(pricePrevious.textContent, /€/);
  assert.match(priceValue.textContent, /€450/);
});

test("applySidebarCurrency keeps symbol on lower current price even without class hints", () => {
  const { doc, pricePrevious, priceValue } = createListingSidebar({
    withStrikePrice: true,
    reversePriceOrder: true,
    dropPriceClasses: true
  });

  const converted = applySidebarCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.match(pricePrevious.textContent, /585/);
  assert.doesNotMatch(pricePrevious.textContent, /€/);
  assert.match(priceValue.textContent, /€450/);
});

test("applySidebarCurrency leaves percent-off text unchanged", () => {
  const { doc, pricePercent } = createListingSidebar({ withStrikePrice: true, withPercentOff: true });
  assert.ok(pricePercent);
  assert.equal(pricePercent.textContent, "23% off");

  const converted = applySidebarCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.equal(pricePercent.textContent, "23% off");

  const restored = applySidebarCurrency(doc, {
    selectedCurrency: "USD",
    rate: null,
    mode: "dual"
  });
  assert.equal(restored, true);
  assert.equal(pricePercent.textContent, "23% off");
});

test("applyCardCurrency converts and restores card prices while preserving percent text", () => {
  const { doc, currentPrices, originalPrices, percentNodes } = createCardPriceFeed();

  const converted = applyCardCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.match(currentPrices[0].textContent, /€72/);
  assert.match(currentPrices[0].textContent, /€/);
  assert.match(originalPrices[0].textContent, /117/);
  assert.doesNotMatch(originalPrices[0].textContent, /€/);
  assert.equal(percentNodes[0].textContent, "38% off");
  assert.equal(currentPrices[0].getAttribute("title"), "USD: $80");
  assert.equal(originalPrices[0].getAttribute("title"), "USD: $130");

  const restored = applyCardCurrency(doc, {
    selectedCurrency: "USD",
    rate: null,
    mode: "dual"
  });
  assert.equal(restored, true);
  assert.equal(currentPrices[0].textContent, "$80");
  assert.equal(originalPrices[0].textContent, "$130");
  assert.equal(percentNodes[0].textContent, "38% off");
  assert.ok(!currentPrices[0].getAttribute("title"));
  assert.ok(!originalPrices[0].getAttribute("title"));
});

test("applyCardCurrency converts multiple card price containers", () => {
  const { doc, currentPrices, originalPrices, percentNodes } = createCardPriceFeed({
    items: [
      { current: "$80", original: "$130", percent: "38% off" },
      { current: "$200", original: "$260", percent: "23% off" }
    ]
  });

  const converted = applyCardCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.match(currentPrices[0].textContent, /€72/);
  assert.match(currentPrices[1].textContent, /€180/);
  assert.match(originalPrices[0].textContent, /117/);
  assert.match(originalPrices[1].textContent, /234/);
  assert.doesNotMatch(originalPrices[0].textContent, /€/);
  assert.doesNotMatch(originalPrices[1].textContent, /€/);
  assert.equal(percentNodes[0].textContent, "38% off");
  assert.equal(percentNodes[1].textContent, "23% off");
});

test("applyCardCurrency converts and restores favorites page price-module markup", () => {
  const { doc, currentPrices } = createCardPriceFeed({
    priceClass:
      "Price-module__root___rNqmD ListingPriceAndHeart-module__listingPrice___qBKiE Price-module__small___iHoYR",
    currentClass: "Money-module__root___MTGNi",
    items: [{ current: "$200" }]
  });

  const converted = applyCardCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.match(currentPrices[0].textContent, /€180/);
  assert.equal(currentPrices[0].getAttribute("title"), "USD: $200");

  const restored = applyCardCurrency(doc, {
    selectedCurrency: "USD",
    rate: null,
    mode: "dual"
  });
  assert.equal(restored, true);
  assert.equal(currentPrices[0].textContent, "$200");
  assert.ok(!currentPrices[0].getAttribute("title"));
});

test("applyCardCurrency returns false when no card price containers are present", () => {
  const { doc } = createPanelHarness();
  assert.equal(
    applyCardCurrency(doc, {
      selectedCurrency: "EUR",
      rate: 0.9,
      mode: "dual"
    }),
    false
  );
});
