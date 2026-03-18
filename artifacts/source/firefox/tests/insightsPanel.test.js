"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findMountTarget,
  renderInsightsPanel,
  applySidebarCurrency,
  applyCardCurrency
} = require("../.tmp/ts-build/src/ui/renderInsightsPanel");
const { MockDocument, flattenText } = require("./helpers/mockDocument");

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
      withOfferLabel: false,
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
  const priceOfferLabel =
    settings.includePrice && settings.withOfferLabel && priceValue ? doc.createElement("span") : null;
  if (price) {
    price.setAttribute("class", "Sidebar_price__456");
    if (priceValue) {
      if (!settings.dropPriceClasses) {
        priceValue.setAttribute("class", "Sidebar_priceValue__999");
      }
      priceValue.textContent = settings.withOfferLabel ? "$500 (Offer Price)" : "$500";
    }

    if (priceOfferLabel) {
      priceOfferLabel.setAttribute("class", "Money_label__KEvAE");
      priceOfferLabel.textContent = " (Offer Price)";
      priceValue.appendChild(priceOfferLabel);
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
    priceOfferLabel,
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

function createMoneyRootOnlyFeed(options) {
  const settings = Object.assign(
    {
      classes: ["Money_root__abc123", "Money_root__xyz999"],
      values: ["$120", "$35"]
    },
    options || {}
  );

  const doc = new MockDocument();
  const main = doc.createElement("main");
  const feed = doc.createElement("section");
  feed.setAttribute("class", "Random_surface__123");
  doc.body.appendChild(main);
  main.appendChild(feed);

  const prices = [];
  settings.values.forEach((value, index) => {
    const node = doc.createElement("span");
    node.setAttribute("class", settings.classes[index] || "Money_root__fallback");
    node.textContent = value;
    feed.appendChild(node);
    prices.push(node);
  });

  const nonPrice = doc.createElement("span");
  nonPrice.setAttribute("class", "Money_root__abc123");
  nonPrice.textContent = "Offer accepted";
  feed.appendChild(nonPrice);

  return {
    doc,
    prices,
    nonPrice
  };
}

function sampleListing() {
  return {
    id: 123,
    title: "Sample",
    pricing: {
      history: [1000, 900, 810],
      updatedAt: "2026-01-11T00:00:00.000Z"
    },
    createdAt: "2026-01-01T00:00:00.000Z",
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
      averageDropAmountUsd: 95,
      averageDropPercent: 10,
      expectedNextDropDays: 2,
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

test("renderInsightsPanel inserts panel after mount node by default", () => {
  const { main, anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 }
  });

  assert.ok(panel);
  assert.equal(main.children[1], panel);
  assert.equal(panel.getAttribute("data-grailed-plus-panel"), "1");
  assert.ok(panel.querySelector(".grailed-plus__trend-chart"));
  assert.match(flattenText(panel), /Metadata/);
  assert.match(flattenText(panel), /Compare on Depop/);
  const metadataButton = panel.querySelector(".grailed-plus__panel-button--tertiary");
  assert.ok(metadataButton);
  assert.equal(metadataButton.textContent, "Metadata");
});

test("renderInsightsPanel omits metadata button when disabled", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    showMetadataButton: false
  });

  assert.ok(panel);
  assert.equal(panel.querySelector(".grailed-plus__panel-button--tertiary"), null);
  assert.doesNotMatch(flattenText(panel), /\bMetadata\b/);
});

test("renderInsightsPanel exposes a semantic title linked from the section landmark", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 }
  });

  const title = panel.querySelector(".grailed-plus-panel__title");
  assert.ok(title);
  assert.equal(title.tagName, "H2");
  assert.equal(title.textContent, "Pricing Insights");
  assert.ok(panel.getAttribute("aria-labelledby"));
  assert.equal(panel.getAttribute("aria-labelledby"), title.id);
});

test("renderInsightsPanel renders market compare result rows", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "results",
      provider: "Depop",
      message: "",
      lastCheckedAt: Date.now(),
      results: [
        {
          id: "r1",
          title: "Sample listing alt",
          url: "https://depop.test/item/1",
          price: 88,
          currency: "USD",
          score: 71,
          deltaLabel: "-12.0% cheaper"
        }
      ]
    }
  });

  assert.ok(panel.querySelector(".grailed-plus__market"));
  assert.match(flattenText(panel), /Other Markets/);
  assert.match(flattenText(panel), /Sample listing alt/);
  assert.match(flattenText(panel), /score 71/);
});

test("renderInsightsPanel omits the market compare section when market compare is disabled", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompareEnabled: false,
    marketCompare: {
      status: "results",
      provider: "Depop",
      results: [
        {
          id: "r-hidden",
          title: "Hidden listing",
          url: "https://depop.test/item/hidden",
          price: 88,
          currency: "USD",
          score: 71,
          deltaLabel: "-12.0% cheaper"
        }
      ]
    }
  });

  assert.equal(panel.querySelector(".grailed-plus__market"), null);
  assert.doesNotMatch(flattenText(panel), /Other Markets/);
  assert.doesNotMatch(flattenText(panel), /Hidden listing/);
});

test("renderInsightsPanel caps market compare rows to five by default", () => {
  const { anchor } = createPanelHarness();

  const results = Array.from({ length: 12 }, function (_value, index) {
    const id = String(index + 1);
    return {
      id: "r" + id,
      title: "Sample listing alt " + id,
      url: "https://depop.test/item/" + id,
      price: 80 + index,
      currency: "USD",
      score: 60 + index,
      deltaLabel: "-10.0% cheaper"
    };
  });

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "results",
      provider: "Depop",
      results: results
    }
  });

  const rows = panel.querySelectorAll(".grailed-plus__market-row");
  assert.equal(rows.length, 5);
  assert.match(flattenText(panel), /Sample listing alt 5/);
  assert.doesNotMatch(flattenText(panel), /Sample listing alt 6/);
});

test("renderInsightsPanel shows ten market compare rows when expanded amount is enabled", () => {
  const { anchor } = createPanelHarness();

  const results = Array.from({ length: 12 }, function (_value, index) {
    const id = String(index + 1);
    return {
      id: "r" + id,
      title: "Expanded listing alt " + id,
      url: "https://depop.test/item/expanded-" + id,
      price: 90 + index,
      currency: "USD",
      score: 70 + index,
      deltaLabel: "-11.0% cheaper"
    };
  });

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompareResultsLimit: 10,
    marketCompare: {
      status: "results",
      provider: "Depop",
      results: results
    }
  });

  const rows = panel.querySelectorAll(".grailed-plus__market-row");
  assert.equal(rows.length, 10);
  assert.match(flattenText(panel), /Expanded listing alt 10/);
  assert.doesNotMatch(flattenText(panel), /Expanded listing alt 11/);
});

test("renderInsightsPanel degrades invalid market result URLs into non-interactive text", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "results",
      provider: "Depop",
      results: [
        {
          id: "r2",
          title: "Listing without safe URL",
          url: "javascript:alert(1)",
          price: 72,
          currency: "USD"
        }
      ]
    }
  });

  const link = panel.querySelector(".grailed-plus__market-link");
  assert.ok(link);
  assert.equal(link.tagName, "SPAN");
  assert.equal(link.getAttribute("aria-disabled"), "true");
  assert.equal(link.textContent, "Listing without safe URL");
});

test("renderInsightsPanel shows a left-side thumbnail preview for Depop results", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "results",
      provider: "Depop",
      results: [
        {
          id: "r3",
          title: "Preview listing",
          url: "https://depop.test/item/3",
          imageUrl: "https://images.depop.test/preview-3.jpg",
          price: 90,
          currency: "USD"
        }
      ]
    }
  });

  const preview = panel.querySelector(".grailed-plus__market-preview");
  const previewImage = panel.querySelector(".grailed-plus__market-preview-image");
  assert.ok(preview);
  assert.ok(previewImage);
  assert.equal(previewImage.tagName, "IMG");
  assert.equal(previewImage.src, "https://images.depop.test/preview-3.jpg");
  assert.equal(previewImage.alt, "Preview listing");
});

test("renderInsightsPanel omits thumbnail preview for non-Depop providers", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "results",
      provider: "Etsy",
      results: [
        {
          id: "r4",
          title: "Other market listing",
          url: "https://etsy.test/item/4",
          imageUrl: "https://images.etsy.test/preview-4.jpg",
          price: 120,
          currency: "USD"
        }
      ]
    }
  });

  assert.equal(panel.querySelector(".grailed-plus__market-preview"), null);
  assert.equal(panel.querySelector(".grailed-plus__market-preview-image"), null);
});

test("renderInsightsPanel shows original Depop currency note when market price is converted", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "results",
      provider: "Depop",
      results: [
        {
          id: "r-converted",
          title: "Converted listing",
          url: "https://depop.test/item/converted",
          price: 108,
          currency: "CAD",
          originalPrice: 80,
          originalCurrency: "EUR",
          score: 64,
          deltaLabel: "-14.0% cheaper"
        }
      ]
    }
  });

  const metaNode = panel.querySelector(".grailed-plus__market-meta");
  const noteNode = panel.querySelector(".grailed-plus__market-meta-note");
  assert.ok(metaNode);
  assert.ok(noteNode);
  assert.match(flattenText(metaNode), /CA\$108/);
  assert.match(flattenText(metaNode), /Depop/);
  assert.match(flattenText(metaNode), /€80/);
});

test("renderInsightsPanel shows loading market compare state with disabled action", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "loading",
      provider: "Depop",
      message: "Fetching similar listings...",
      results: []
    }
  });

  const chip = panel.querySelector(".grailed-plus__market-chip");
  const button = panel.querySelector(".grailed-plus__market-actions .grailed-plus__panel-button");
  assert.ok(chip);
  assert.ok(button);
  assert.equal(chip.textContent, "Searching");
  assert.equal(button.textContent, "Searching...");
  assert.equal(button.disabled, true);
  assert.match(flattenText(panel), /Fetching similar listings/);
});

test("renderInsightsPanel shows no-results market state and keeps action enabled", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "no-results",
      provider: "Depop",
      message: "No matching listings found.",
      results: []
    }
  });

  const chip = panel.querySelector(".grailed-plus__market-chip");
  const button = panel.querySelector(".grailed-plus__market-actions .grailed-plus__panel-button");
  assert.ok(chip);
  assert.ok(button);
  assert.equal(chip.textContent, "No Results");
  assert.equal(button.textContent, "Compare on Depop");
  assert.equal(button.disabled, false);
  assert.match(flattenText(panel), /No matching listings found/);
});

test("renderInsightsPanel shows ML sorting status when displayed results all use embedding ranking", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "results",
      provider: "Depop",
      results: [
        {
          id: "r-ml-1",
          title: "ML ranked listing 1",
          url: "https://depop.test/item/ml-1",
          price: 88,
          currency: "USD",
          imageSignalType: "ml_embedding"
        },
        {
          id: "r-ml-2",
          title: "ML ranked listing 2",
          url: "https://depop.test/item/ml-2",
          price: 92,
          currency: "USD",
          imageSignalType: "ml_embedding"
        }
      ]
    }
  });

  const chips = panel.querySelectorAll(".grailed-plus__market-chip");
  assert.equal(chips.length, 2);
  assert.equal(chips[0].textContent, "Results");
  assert.equal(chips[1].textContent, "ML Sorted");
});

test("renderInsightsPanel omits ML sorting status when displayed results include fallback image signals", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "results",
      provider: "Depop",
      results: [
        {
          id: "r-mixed-1",
          title: "ML ranked listing",
          url: "https://depop.test/item/mixed-1",
          price: 88,
          currency: "USD",
          imageSignalType: "ml_embedding"
        },
        {
          id: "r-mixed-2",
          title: "Fallback ranked listing",
          url: "https://depop.test/item/mixed-2",
          price: 92,
          currency: "USD",
          imageSignalType: "thumbnail_fingerprint"
        }
      ]
    }
  });

  const chips = panel.querySelectorAll(".grailed-plus__market-chip");
  assert.equal(chips.length, 1);
  assert.equal(chips[0].textContent, "Results");
  assert.doesNotMatch(flattenText(panel), /ML Sorted/);
});

test("renderInsightsPanel omits score fragment when score is not finite", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "results",
      provider: "Depop",
      results: [
        {
          id: "r1",
          title: "Sample listing alt",
          url: "https://depop.test/item/1",
          price: 88,
          currency: "USD",
          score: Number.NaN,
          deltaLabel: "-12.0% cheaper"
        }
      ]
    }
  });

  const metaNode = panel.querySelector(".grailed-plus__market-meta");
  assert.ok(metaNode);
  const metaText = flattenText(metaNode);
  assert.doesNotMatch(metaText, /score\s+/i);
  assert.match(metaText, /\$88/);
});

test("renderInsightsPanel styles Depop delta percentages by direction and magnitude", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 },
    marketCompare: {
      status: "results",
      provider: "Depop",
      results: [
        {
          id: "r1",
          title: "Cheaper sample",
          url: "https://depop.test/item/1",
          price: 88,
          currency: "USD",
          score: 79,
          deltaLabel: "-12.0% cheaper"
        },
        {
          id: "r2",
          title: "Higher sample",
          url: "https://depop.test/item/2",
          price: 120,
          currency: "USD",
          score: 71,
          deltaLabel: "+17.0% higher"
        }
      ]
    }
  });

  const cheaperNode = panel.querySelector(
    ".grailed-plus__market-meta-segment.grailed-plus__percent--down-mid"
  );
  const higherNode = panel.querySelector(
    ".grailed-plus__market-meta-segment.grailed-plus__percent--up-strong"
  );

  assert.ok(cheaperNode);
  assert.ok(higherNode);
  assert.match(cheaperNode.textContent, /-12\.0% cheaper/);
  assert.match(higherNode.textContent, /\+17\.0% higher/);
});

test("renderInsightsPanel styles Avg. Price Drop with stronger green at larger percentages", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics({ averageDropPercent: 16, averageDropAmountUsd: 120 }),
    mountNode: anchor,
    rawListing: { id: 123 }
  });

  const avgValueNode = findValueNodeByLabel(panel, "Avg. Price Drop");
  assert.ok(avgValueNode);
  assert.match(avgValueNode.className, /grailed-plus__percent--down-strong/);
});

test("renderInsightsPanel inserts panel before mount node when mountPosition is beforebegin", () => {
  const { main, anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
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

test("renderInsightsPanel re-renders without duplicates", () => {
  const { doc, anchor } = createPanelHarness();

  renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 }
  });

  renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics({
      averageDropAmountUsd: 120,
      averageDropPercent: 12,
      expectedNextDropDays: 5
    }),
    mountNode: anchor,
    mountPosition: "beforebegin",
    rawListing: { id: 123 }
  });

  assert.equal(doc.querySelectorAll('[data-grailed-plus-panel="1"]').length, 1);
});

test("renderInsightsPanel shows converted + USD values when currency context has a rate", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
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
  assert.ok(panel.querySelector(".grailed-plus__trend-chart"));
  assert.match(text, /Avg\. Price Drop/);

  const avgValueNode = findValueNodeByLabel(panel, "Avg. Price Drop");
  assert.ok(avgValueNode);
  assert.equal(avgValueNode.getAttribute("title"), "USD: $95");
});

test("renderInsightsPanel falls back to USD-only values when no conversion rate is available", () => {
  const { anchor } = createPanelHarness();

  const panel = renderInsightsPanel({
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
  assert.ok(panel.querySelector(".grailed-plus__trend-chart"));

  const avgValueNode = findValueNodeByLabel(panel, "Avg. Price Drop");
  assert.ok(avgValueNode);
  assert.ok(!avgValueNode.getAttribute("title"));
});

test("renderInsightsPanel shows centered empty-state trend text when only one price point exists", () => {
  const { anchor } = createPanelHarness();
  const listing = sampleListing();
  listing.pricing.history = [1000];

  const panel = renderInsightsPanel({
    listing,
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 }
  });

  const emptyNode = panel.querySelector(".grailed-plus__trend-empty");
  assert.ok(emptyNode);
  assert.equal(emptyNode.textContent, "no price history data");
  const chartNode = panel.querySelector(".grailed-plus__trend-chart");
  assert.ok(chartNode);
  assert.match(chartNode.getAttribute("aria-label"), /Price trend unavailable/i);
});

test("renderInsightsPanel hover targets nearest trend point on scaled charts", () => {
  const { anchor } = createPanelHarness();
  const panel = renderInsightsPanel({
    listing: sampleListing(),
    metrics: sampleMetrics(),
    mountNode: anchor,
    rawListing: { id: 123 }
  });

  const chartNode = panel.querySelector(".grailed-plus__trend-chart");
  const svgNode = panel.querySelector(".grailed-plus__trend-svg");
  const hitAreaNode = panel.querySelector(".grailed-plus__trend-hit-area");
  const points = panel.querySelectorAll(".grailed-plus__trend-point");
  const tooltipNode = panel.querySelector(".grailed-plus__trend-tooltip");

  assert.ok(chartNode);
  assert.ok(svgNode);
  assert.ok(hitAreaNode);
  assert.ok(tooltipNode);
  assert.equal(points.length, 3);
  assert.equal(typeof hitAreaNode._listeners.mousemove, "function");

  chartNode.clientWidth = 592;
  chartNode.clientHeight = 216;
  chartNode.getBoundingClientRect = () => ({
    left: 10,
    top: 20,
    width: 592,
    height: 216
  });

  svgNode.getBoundingClientRect = () => ({
    left: 10,
    top: 20,
    width: 592,
    height: 216
  });

  tooltipNode.getBoundingClientRect = () => ({
    width: 80,
    height: 24
  });

  hitAreaNode._listeners.mousemove({
    clientX: 314,
    clientY: 84
  });

  assert.match(points[1].getAttribute("class"), /is-active/);
  assert.doesNotMatch(points[2].getAttribute("class"), /is-active/);
  assert.equal(tooltipNode.getAttribute("aria-hidden"), "false");
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

test("applySidebarCurrency converts offer-mode current price text", () => {
  const { doc, priceValue, priceOfferLabel } = createListingSidebar({
    nestedPriceValue: true,
    withOfferLabel: true
  });

  assert.ok(priceValue);
  assert.ok(priceOfferLabel);
  assert.equal(priceValue.textContent, "$500 (Offer Price)");

  const converted = applySidebarCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.match(priceValue.textContent, /€450/);
  assert.equal(priceValue.getAttribute("title"), "USD: $500 (Offer Price)");

  const restored = applySidebarCurrency(doc, {
    selectedCurrency: "USD",
    rate: null,
    mode: "dual"
  });
  assert.equal(restored, true);
  assert.equal(priceValue.textContent, "$500 (Offer Price)");
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

test("applySidebarCurrency keeps fractional strike-through values on listing pages", () => {
  const { doc, pricePrevious } = createListingSidebar({ withStrikePrice: true });

  const converted = applySidebarCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.845,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.equal(pricePrevious.textContent, "549.25");
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

test("applyCardCurrency rounds strike-through converted values to whole numbers", () => {
  const { doc, originalPrices } = createCardPriceFeed({
    items: [{ current: "$80", original: "$130" }]
  });

  const converted = applyCardCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.845,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.equal(originalPrices[0].textContent, "110");
  assert.doesNotMatch(originalPrices[0].textContent, /\./);
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

test("applyCardCurrency converts site-wide Money_root spans outside card containers", () => {
  const { doc, prices, nonPrice } = createMoneyRootOnlyFeed();

  const converted = applyCardCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });
  assert.equal(converted, true);
  assert.match(prices[0].textContent, /€108/);
  assert.match(prices[1].textContent, /€31\.5/);
  assert.equal(prices[0].getAttribute("title"), "USD: $120");
  assert.equal(prices[1].getAttribute("title"), "USD: $35");
  assert.equal(nonPrice.textContent, "Offer accepted");
  assert.ok(!nonPrice.getAttribute("title"));
});

test("applyCardCurrency restores site-wide Money_root spans when switching back to USD", () => {
  const { doc, prices } = createMoneyRootOnlyFeed({
    values: ["$42", "$10"]
  });

  applyCardCurrency(doc, {
    selectedCurrency: "EUR",
    rate: 0.9,
    mode: "dual"
  });

  const restored = applyCardCurrency(doc, {
    selectedCurrency: "USD",
    rate: null,
    mode: "dual"
  });
  assert.equal(restored, true);
  assert.equal(prices[0].textContent, "$42");
  assert.equal(prices[1].textContent, "$10");
  assert.ok(!prices[0].getAttribute("title"));
  assert.ok(!prices[1].getAttribute("title"));
});
