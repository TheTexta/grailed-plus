(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusInsightsPanel = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PANEL_ATTR = "data-grailed-plus-panel";
  var PANEL_ATTR_VALUE = "1";
  var PRICE_SELECTORS = ['div[class*="Sidebar_price"]', 'div[class*="sidebar__price_"]'];
  var CARD_PRICE_CONTAINER_SELECTOR =
    'div[class*="Price_root"], div[class*="Price-module__root"]';
  var CARD_PRICE_CURRENT_SELECTOR =
    'div[class*="Price_root"] [data-testid="Current"], ' +
    'div[class*="Price-module__root"] [data-testid="Current"]';
  var MONEY_ROOT_PRICE_SELECTOR =
    'span[class*="Money_root_"], span[class*="Money-module__root"]';
  var CARD_PRICE_TARGET_SELECTOR =
    CARD_PRICE_CONTAINER_SELECTOR + ", " + CARD_PRICE_CURRENT_SELECTOR + ", " + MONEY_ROOT_PRICE_SELECTOR;
  var SIDEBAR_USD_TEXT_ATTR = "data-grailed-plus-original-price-text";
  var SIDEBAR_USD_VALUE_ATTR = "data-grailed-plus-original-price-value";
  var TREND_EMPTY_TEXT = "no price history data";
  var TREND_CHART_WIDTH = 296;
  var TREND_CHART_HEIGHT = 108;
  var TREND_MARGIN = {
    top: 8,
    right: 8,
    bottom: 14,
    left: 8
  };
  var TREND_CLIP_ID_PREFIX = "grailed-plus__trend-clip-";
  var trendClipIdCounter = 0;

  function normalizeCurrencyCode(input) {
    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  function formatCurrencyByCode(value, currencyCode) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }

    var normalizedCode = normalizeCurrencyCode(currencyCode) || "USD";

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: normalizedCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(value);
    } catch (_) {
      return normalizedCode + " " + Number(value).toFixed(2);
    }
  }

  function normalizeCurrencyContext(currencyContext) {
    var selectedCurrency = normalizeCurrencyCode(
      currencyContext && currencyContext.selectedCurrency
    );
    var rate = Number(currencyContext && currencyContext.rate);

    return {
      selectedCurrency: selectedCurrency || "USD",
      rate: Number.isFinite(rate) ? rate : null,
      mode: "dual"
    };
  }

  function formatCurrency(value) {
    return formatCurrencyByCode(value, "USD");
  }

  function formatMoney(valueUsd, currencyContext) {
    if (!Number.isFinite(valueUsd)) {
      return "N/A";
    }

    var usdText = formatCurrency(valueUsd);
    var normalizedContext = normalizeCurrencyContext(currencyContext);
    if (
      normalizedContext.selectedCurrency === "USD" ||
      !Number.isFinite(normalizedContext.rate) ||
      normalizedContext.rate <= 0
    ) {
      return usdText;
    }

    var converted = valueUsd * normalizedContext.rate;
    var convertedText = formatCurrencyByCode(converted, normalizedContext.selectedCurrency);
    if (convertedText === "N/A") {
      return usdText;
    }

    return convertedText;
  }

  function buildMoneyDisplay(valueUsd, currencyContext) {
    if (!Number.isFinite(valueUsd)) {
      return {
        text: "N/A",
        isConverted: false,
        originalUsdText: ""
      };
    }

    var usdText = formatCurrency(valueUsd);
    var normalizedContext = normalizeCurrencyContext(currencyContext);
    if (
      normalizedContext.selectedCurrency === "USD" ||
      !Number.isFinite(normalizedContext.rate) ||
      normalizedContext.rate <= 0
    ) {
      return {
        text: usdText,
        isConverted: false,
        originalUsdText: usdText
      };
    }

    var converted = valueUsd * normalizedContext.rate;
    var convertedText = formatCurrencyByCode(converted, normalizedContext.selectedCurrency);
    if (convertedText === "N/A") {
      return {
        text: usdText,
        isConverted: false,
        originalUsdText: usdText
      };
    }

    return {
      text: convertedText,
      isConverted: true,
      originalUsdText: usdText
    };
  }

  function normalizeMaxFractionDigits(value, fallback) {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    var rounded = Math.floor(value);
    if (rounded < 0) {
      return fallback;
    }

    return rounded;
  }

  function formatAmountWithoutCurrency(value, maxFractionDigits) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }

    var digits = normalizeMaxFractionDigits(maxFractionDigits, 2);

    try {
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits
      }).format(value);
    } catch (_) {
      return Number(value).toFixed(digits);
    }
  }

  function formatDate(isoValue) {
    if (!isoValue) {
      return "Unknown";
    }
    var date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) {
      return "Unknown";
    }
    return date.toDateString();
  }

  function getD3() {
    if (typeof globalThis !== "undefined" && globalThis && globalThis.d3) {
      return globalThis.d3;
    }

    return null;
  }

  function parseDateMs(value) {
    if (!value) {
      return null;
    }

    var date = new Date(value);
    var ms = date.getTime();
    if (!Number.isFinite(ms)) {
      return null;
    }

    return ms;
  }

  function normalizeTrendPoints(listing) {
    var history =
      listing && listing.pricing && Array.isArray(listing.pricing.history)
        ? listing.pricing.history
        : [];

    if (!Array.isArray(history) || history.length <= 1) {
      return [];
    }

    var createdAtMs = parseDateMs(listing ? listing.createdAt : null);
    var updatedAtMs = parseDateMs(listing && listing.pricing ? listing.pricing.updatedAt : null);
    if (!Number.isFinite(createdAtMs) || !Number.isFinite(updatedAtMs) || updatedAtMs <= createdAtMs) {
      return [];
    }

    var intervalMs = (updatedAtMs - createdAtMs) / (history.length - 1);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      return [];
    }

    var points = [];
    var i;
    var price;
    var ts;
    for (i = 0; i < history.length; i += 1) {
      price = Number(history[i]);
      if (!Number.isFinite(price) || price <= 0) {
        continue;
      }

      ts = createdAtMs + intervalMs * i;
      points.push({
        key: String(Math.round(ts)) + ":" + String(price) + ":" + String(i),
        index: i,
        timestampMs: Math.round(ts),
        date: new Date(ts),
        priceUsd: price
      });
    }

    points.sort(function (a, b) {
      return a.timestampMs - b.timestampMs;
    });

    return points;
  }

  function createTrendChartRow(doc, listing, currencyContext) {
    var row = doc.createElement("div");
    row.className = "grailed-plus__trend-row";

    var chart = doc.createElement("div");
    chart.className = "grailed-plus__trend-chart";
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "Price trend");
    row.appendChild(chart);

    var points = normalizeTrendPoints(listing);
    var d3 = getD3();
    if (!d3 || points.length <= 1) {
      var emptyNode = doc.createElement("div");
      emptyNode.className = "grailed-plus__trend-empty";
      emptyNode.textContent = TREND_EMPTY_TEXT;
      chart.appendChild(emptyNode);
      return row;
    }

    var width = TREND_CHART_WIDTH;
    var height = TREND_CHART_HEIGHT;
    var innerWidth = Math.max(1, width - TREND_MARGIN.left - TREND_MARGIN.right);
    var innerHeight = Math.max(1, height - TREND_MARGIN.top - TREND_MARGIN.bottom);

    var svg = d3
      .select(chart)
      .append("svg")
      .attr("class", "grailed-plus__trend-svg")
      .attr("viewBox", "0 0 " + String(width) + " " + String(height))
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("aria-hidden", "true");

    var root = svg
      .append("g")
      .attr("class", "grailed-plus__trend-root")
      .attr("transform", "translate(" + String(TREND_MARGIN.left) + "," + String(TREND_MARGIN.top) + ")");

    var clipPathId = TREND_CLIP_ID_PREFIX + String(trendClipIdCounter);
    trendClipIdCounter += 1;

    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipPathId)
      .attr("clipPathUnits", "userSpaceOnUse")
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerWidth)
      .attr("height", innerHeight);

    var trendLineLayer = root
      .append("g")
      .attr("class", "grailed-plus__trend-line-layer")
      .attr("clip-path", "url(#" + clipPathId + ")");

    var trendPointLayer = root
      .append("g")
      .attr("class", "grailed-plus__trend-point-layer")
      .attr("clip-path", "url(#" + clipPathId + ")");

    var x = d3
      .scaleTime()
      .domain(d3.extent(points, function (d) {
        return d.date;
      }))
      .range([0, innerWidth]);

    var yExtent = d3.extent(points, function (d) {
      return d.priceUsd;
    });
    var yMin = yExtent[0];
    var yMax = yExtent[1];
    if (yMin === yMax) {
      yMin = yMin - 1;
      yMax = yMax + 1;
    }

    var y = d3.scaleLinear().domain([yMin, yMax]).nice(3).range([innerHeight, 0]);

    var line = d3
      .line()
      .defined(function (d) {
        return Number.isFinite(d.priceUsd) && d.date instanceof Date;
      })
      .curve(d3.curveMonotoneX)
      .x(function (d) {
        return x(d.date);
      })
      .y(function (d) {
        return y(d.priceUsd);
      });

    trendLineLayer
      .selectAll("path.grailed-plus__trend-line")
      .data([points])
      .join("path")
      .attr("class", "grailed-plus__trend-line")
      .attr("d", line);

    var tooltip = d3
      .select(chart)
      .append("div")
      .attr("class", "grailed-plus__trend-tooltip")
      .attr("aria-hidden", "true");

    function showTooltip(event, point) {
      var display = buildMoneyDisplay(point.priceUsd, currencyContext);
      var tooltipText = display.text + " - " + formatDate(point.date.toISOString());

      tooltip.text(tooltipText);
      if (display.isConverted) {
        tooltip.attr("title", "USD: " + display.originalUsdText);
      } else {
        tooltip.attr("title", "");
      }

      var xPos = Number(event && event.offsetX);
      var yPos = Number(event && event.offsetY);
      if (!Number.isFinite(xPos) || !Number.isFinite(yPos)) {
        xPos = x(point.date) + TREND_MARGIN.left;
        yPos = y(point.priceUsd) + TREND_MARGIN.top;
      }

      tooltip
        .style("opacity", "1")
        .style("left", String(xPos + 10) + "px")
        .style("top", String(yPos - 12) + "px")
        .attr("aria-hidden", "false");
    }

    function hideTooltip() {
      tooltip.style("opacity", "0").attr("aria-hidden", "true");
    }

    var pointNodes = trendPointLayer
      .selectAll("circle.grailed-plus__trend-point")
      .data(points, function (d) {
        return d.key;
      })
      .join("circle")
      .attr("class", "grailed-plus__trend-point")
      .attr("cx", function (d) {
        return x(d.date);
      })
      .attr("cy", function (d) {
        return y(d.priceUsd);
      })
      .attr("r", 3)
      .attr("tabindex", 0)
      .on("focus", function (event, point) {
        pointNodes.classed("is-active", false);
        d3.select(this).classed("is-active", true);
        showTooltip(event, point);
      })
      .on("blur", function () {
        pointNodes.classed("is-active", false);
        hideTooltip();
      });

    var bisectByDate = d3.bisector(function (d) {
      return d.date;
    }).center;

    function findNearestPoint(event) {
      var pointer = d3.pointer(event, root.node());
      var px = Number(pointer && pointer[0]);
      if (!Number.isFinite(px)) {
        return points[points.length - 1];
      }

      var clampedPx = Math.max(0, Math.min(innerWidth, px));
      var hoverDate = x.invert(clampedPx);
      var index = bisectByDate(points, hoverDate);
      if (!Number.isFinite(index)) {
        return points[points.length - 1];
      }

      index = Math.max(0, Math.min(points.length - 1, index));
      return points[index];
    }

    function syncHoverState(event) {
      var nearest = findNearestPoint(event);
      pointNodes.classed("is-active", function (d) {
        return d.key === nearest.key;
      });
      showTooltip(event, nearest);
    }

    root
      .selectAll("rect.grailed-plus__trend-hit-area")
      .data([null])
      .join("rect")
      .attr("class", "grailed-plus__trend-hit-area")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .on("mouseenter", syncHoverState)
      .on("mousemove", syncHoverState)
      .on("mouseleave", function () {
        pointNodes.classed("is-active", false);
        hideTooltip();
      });

    return row;
  }

  function createRow(doc, label, value, extraClass, valueTitle) {
    var row = doc.createElement("div");
    row.className = "grailed-plus__row" + (extraClass ? " " + extraClass : "");

    var labelNode = doc.createElement("span");
    labelNode.className = "grailed-plus__label";
    labelNode.textContent = label;

    var valueNode = doc.createElement("span");
    valueNode.className = "grailed-plus__value";
    valueNode.textContent = value;
    if (valueTitle && typeof valueNode.setAttribute === "function") {
      valueNode.setAttribute("title", valueTitle);
    }

    row.appendChild(labelNode);
    row.appendChild(valueNode);
    return row;
  }

  function setNodeTitle(node, title) {
    if (!node) {
      return;
    }

    if (title && typeof node.setAttribute === "function") {
      node.setAttribute("title", title);
      return;
    }

    if (typeof node.removeAttribute === "function") {
      node.removeAttribute("title");
      return;
    }

    if (typeof node.setAttribute === "function") {
      node.setAttribute("title", "");
    }
  }

  function removeExistingPanels(doc) {
    if (!doc || typeof doc.querySelectorAll !== "function") {
      return;
    }

    var existingPanels = doc.querySelectorAll("[" + PANEL_ATTR + '="' + PANEL_ATTR_VALUE + '"]');
    Array.prototype.forEach.call(existingPanels, function (panel) {
      if (panel && typeof panel.remove === "function") {
        panel.remove();
      } else if (panel && panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    });
  }

  function getClassName(node) {
    if (!node) {
      return "";
    }
    if (typeof node.className === "string") {
      return node.className;
    }
    if (typeof node.getAttribute === "function") {
      return node.getAttribute("class") || "";
    }
    return "";
  }

  function findFirstBySelectors(root, selectors) {
    if (!root || typeof root.querySelector !== "function" || !Array.isArray(selectors)) {
      return null;
    }

    var i;
    var node;
    for (i = 0; i < selectors.length; i += 1) {
      node = root.querySelector(selectors[i]);
      if (node) {
        return node;
      }
    }

    return null;
  }

  function collectCtaCandidates(root) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return [];
    }

    var allCandidates = root.querySelectorAll("button, a");
    var matches = [];
    var i;
    var candidate;
    var text;
    for (i = 0; i < allCandidates.length; i += 1) {
      candidate = allCandidates[i];
      if (!candidate || typeof candidate.textContent !== "string") {
        continue;
      }

      text = candidate.textContent.replace(/\s+/g, " ").trim();
      if (/Purchase|Offer/i.test(text)) {
        matches.push(candidate);
      }
    }

    return matches;
  }

  function appendUniqueNodes(target, source) {
    if (!Array.isArray(target) || !Array.isArray(source)) {
      return;
    }

    var i;
    var j;
    var candidate;
    var exists;
    for (i = 0; i < source.length; i += 1) {
      candidate = source[i];
      exists = false;

      for (j = 0; j < target.length; j += 1) {
        if (target[j] === candidate) {
          exists = true;
          break;
        }
      }

      if (!exists) {
        target.push(candidate);
      }
    }
  }

  function isCardPriceContainer(node) {
    if (!node) {
      return false;
    }

    var className = getClassName(node);
    if (
      typeof className !== "string" ||
      (className.indexOf("Price_root") === -1 && className.indexOf("Price-module__root") === -1)
    ) {
      return false;
    }

    var tagName = typeof node.tagName === "string" ? node.tagName.toUpperCase() : "";
    return tagName === "DIV";
  }

  function findClosestCardPriceContainer(node) {
    if (!node) {
      return null;
    }

    if (typeof node.closest === "function") {
      var scoped = node.closest(CARD_PRICE_CONTAINER_SELECTOR);
      if (scoped) {
        return scoped;
      }
    }

    var current = node;
    while (current) {
      if (isCardPriceContainer(current)) {
        return current;
      }
      current = current.parentNode;
    }

    return null;
  }

  function collectCardPriceContainers(doc) {
    if (!doc || typeof doc.querySelectorAll !== "function") {
      return [];
    }

    var currentNodes = doc.querySelectorAll(CARD_PRICE_CURRENT_SELECTOR);
    var containers = [];
    var i;
    var container;

    for (i = 0; i < currentNodes.length; i += 1) {
      container = findClosestCardPriceContainer(currentNodes[i]);
      if (container) {
        appendUniqueNodes(containers, [container]);
      }
    }

    return containers;
  }

  function collectMoneyRootPriceNodes(doc) {
    if (!doc || typeof doc.querySelectorAll !== "function") {
      return [];
    }

    var nodes = doc.querySelectorAll(MONEY_ROOT_PRICE_SELECTOR);
    var matches = [];
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      appendUniqueNodes(matches, [nodes[i]]);
    }

    return matches;
  }

  function isNodeWithinAnyTarget(node, targets) {
    if (!node || !Array.isArray(targets) || targets.length === 0) {
      return false;
    }

    var current = node;
    var i;
    while (current) {
      for (i = 0; i < targets.length; i += 1) {
        if (targets[i] === current) {
          return true;
        }
      }
      current = current.parentNode;
    }

    return false;
  }

  function collectCardPriceTargets(doc) {
    var targets = collectCardPriceContainers(doc);
    var moneyNodes = collectMoneyRootPriceNodes(doc);
    var i;

    for (i = 0; i < moneyNodes.length; i += 1) {
      if (!isNodeWithinAnyTarget(moneyNodes[i], targets)) {
        appendUniqueNodes(targets, [moneyNodes[i]]);
      }
    }

    return targets;
  }

  function nodeContainsCardPriceTarget(node) {
    if (!node) {
      return false;
    }

    if (typeof node.matches === "function" && node.matches(CARD_PRICE_TARGET_SELECTOR)) {
      return true;
    }

    if (typeof node.querySelector === "function") {
      return Boolean(node.querySelector(CARD_PRICE_TARGET_SELECTOR));
    }

    return false;
  }

  function findSidebarScope(priceNode) {
    if (!priceNode) {
      return null;
    }

    if (typeof priceNode.closest === "function") {
      var scoped = priceNode.closest('[class*="sidebar"], aside');
      if (scoped) {
        return scoped;
      }
    }

    var current = priceNode;
    var className;
    while (current) {
      className = getClassName(current);
      if (typeof className === "string" && /sidebar/i.test(className)) {
        return current;
      }
      current = current.parentNode;
    }

    return priceNode.parentNode || null;
  }

  function getRootNode(node) {
    var current = node;
    while (current && current.parentNode) {
      current = current.parentNode;
    }
    return current;
  }

  function getChildIndex(node) {
    if (!node || !node.parentNode || !node.parentNode.children) {
      return -1;
    }

    var siblings = node.parentNode.children;
    var i;
    for (i = 0; i < siblings.length; i += 1) {
      if (siblings[i] === node) {
        return i;
      }
    }

    return -1;
  }

  function buildNodePath(node) {
    if (!node) {
      return null;
    }

    var path = [];
    var current = node;
    var index;
    while (current && current.parentNode) {
      index = getChildIndex(current);
      if (index < 0) {
        return null;
      }
      path.unshift(index);
      current = current.parentNode;
    }

    return path;
  }

  function compareNodeOrder(left, right) {
    if (!left || !right || left === right) {
      return 0;
    }

    if (typeof left.compareDocumentPosition === "function") {
      var relation = left.compareDocumentPosition(right);
      if (relation & 4) {
        return -1;
      }
      if (relation & 2) {
        return 1;
      }
    }

    if (getRootNode(left) !== getRootNode(right)) {
      return 0;
    }

    var leftPath = buildNodePath(left);
    var rightPath = buildNodePath(right);
    if (!leftPath || !rightPath) {
      return 0;
    }

    var minLength = Math.min(leftPath.length, rightPath.length);
    var i;
    for (i = 0; i < minLength; i += 1) {
      if (leftPath[i] < rightPath[i]) {
        return -1;
      }
      if (leftPath[i] > rightPath[i]) {
        return 1;
      }
    }

    if (leftPath.length < rightPath.length) {
      return -1;
    }
    if (leftPath.length > rightPath.length) {
      return 1;
    }

    return 0;
  }

  function findCtaNode(doc, priceNode) {
    var candidates = [];

    if (priceNode) {
      appendUniqueNodes(candidates, collectCtaCandidates(findSidebarScope(priceNode)));
      appendUniqueNodes(candidates, collectCtaCandidates(priceNode.parentNode));
    }
    appendUniqueNodes(candidates, collectCtaCandidates(doc));

    if (candidates.length === 0) {
      return null;
    }

    if (!priceNode) {
      return candidates[0];
    }

    var i;
    var candidate;
    for (i = 0; i < candidates.length; i += 1) {
      candidate = candidates[i];
      if (compareNodeOrder(priceNode, candidate) === -1) {
        return candidate;
      }
    }

    return candidates[0];
  }

  function findMountTarget(doc) {
    if (!doc || typeof doc.querySelector !== "function") {
      return null;
    }

    var priceNode = findFirstBySelectors(doc, PRICE_SELECTORS);
    var fallbackNode;

    if (priceNode) {
      return {
        mountNode: priceNode,
        mountPosition: "afterend",
        strategy: "sidebar_price"
      };
    }

    fallbackNode = doc.querySelector("main") || doc.body || null;
    if (!fallbackNode) {
      return null;
    }

    return {
      mountNode: fallbackNode,
      mountPosition: "afterend",
      strategy: fallbackNode === doc.body ? "fallback_body" : "fallback_main"
    };
  }

  function findMountNode(doc) {
    var mountTarget = findMountTarget(doc);
    return mountTarget && mountTarget.mountNode ? mountTarget.mountNode : null;
  }

  function parseUsdAmount(text) {
    if (typeof text !== "string") {
      return null;
    }

    var normalized = text.replace(/,/g, "");
    var match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }

    var amount = Number(match[0]);
    return Number.isFinite(amount) ? amount : null;
  }

  function parseStoredAmount(value) {
    if (value == null) {
      return null;
    }

    if (typeof value === "string" && value.trim() === "") {
      return null;
    }

    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getNodeText(node) {
    if (!node || typeof node.textContent !== "string") {
      return "";
    }
    return node.textContent.trim();
  }

  function getNodePrimaryText(node) {
    var fallback = getNodeText(node);
    if (!node || !node.childNodes || node.childNodes.length === 0) {
      return fallback;
    }

    var i;
    var child;
    var text;
    for (i = 0; i < node.childNodes.length; i += 1) {
      child = node.childNodes[i];
      if (!child || child.nodeType !== 3) {
        continue;
      }

      text = String(child.textContent || "").trim();
      if (text) {
        return text;
      }
    }

    return fallback;
  }

  function setNodePrimaryText(node, text) {
    if (!node || typeof text !== "string") {
      return;
    }

    if (node.childNodes && node.childNodes.length > 0) {
      var i;
      var child;
      for (i = 0; i < node.childNodes.length; i += 1) {
        child = node.childNodes[i];
        if (!child || child.nodeType !== 3) {
          continue;
        }

        child.textContent = text;
        return;
      }
    }

    node.textContent = text;
  }

  function isDescendantOf(node, potentialAncestor) {
    var current = node && node.parentNode;
    while (current) {
      if (current === potentialAncestor) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  }

  function hasConvertibleDescendant(node, candidates) {
    if (!node || !Array.isArray(candidates) || candidates.length === 0) {
      return false;
    }

    var i;
    for (i = 0; i < candidates.length; i += 1) {
      if (candidates[i] === node) {
        continue;
      }

      if (isDescendantOf(candidates[i], node)) {
        return true;
      }
    }

    return false;
  }

  function isUsdPriceText(text) {
    if (typeof text !== "string") {
      return false;
    }

    // Convert USD-like price text (e.g. "$500", "US $500", "$500 (Offer Price)").
    // This intentionally excludes percentage/label strings like "23% off".
    return /^\s*(?:[A-Z]{0,3}\s*)?\$\s*-?\d[\d,]*(?:\.\d+)?\s*(?:\([^)]*\))?\s*$/i.test(text);
  }

  function hasStoredOriginalPrice(node) {
    if (!node || typeof node.getAttribute !== "function") {
      return false;
    }

    return Boolean(node.getAttribute(SIDEBAR_USD_TEXT_ATTR));
  }

  function isStrikethroughNode(node) {
    if (!node) {
      return false;
    }

    var tagName = typeof node.tagName === "string" ? node.tagName.toUpperCase() : "";
    if (tagName === "DEL" || tagName === "S") {
      return true;
    }

    var className = getClassName(node).toLowerCase();
    if (/(line[-_ ]?through|strik|cross|previous|old|original|was|before|compare)/i.test(className)) {
      return true;
    }

    var styleText = "";
    if (typeof node.getAttribute === "function") {
      styleText = String(node.getAttribute("style") || "").toLowerCase();
    }

    if (!styleText && node.style) {
      styleText = String(
        node.style.textDecorationLine || node.style.textDecoration || ""
      ).toLowerCase();
    }

    return styleText.indexOf("line-through") !== -1;
  }

  function collectPriceTextCandidates(priceNode) {
    if (!priceNode) {
      return [];
    }

    var candidates = [priceNode];
    if (typeof priceNode.querySelectorAll === "function") {
      var descendants = priceNode.querySelectorAll("*");
      Array.prototype.forEach.call(descendants, function (node) {
        candidates.push(node);
      });
    }

    return candidates.filter(function (node) {
      var text = getNodePrimaryText(node);
      if (!text && !hasStoredOriginalPrice(node)) {
        return false;
      }

      if (hasStoredOriginalPrice(node)) {
        return true;
      }

      if (!isUsdPriceText(text)) {
        return false;
      }
      return Number.isFinite(parseUsdAmount(text));
    });
  }

  function getPriceTextTargets(priceNode) {
    var candidates = collectPriceTextCandidates(priceNode);
    if (candidates.length === 0) {
      return priceNode ? [priceNode] : [];
    }

    var terminalCandidates = candidates.filter(function (node) {
      return !hasConvertibleDescendant(node, candidates);
    });

    if (terminalCandidates.length > 0) {
      return terminalCandidates;
    }

    return [candidates[0]];
  }

  function choosePrimaryPriceIndex(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return -1;
    }

    var nonStrikeIndices = [];
    var allConvertibleIndices = [];
    var i;
    for (i = 0; i < entries.length; i += 1) {
      if (!entries[i] || !Number.isFinite(entries[i].usdValue)) {
        continue;
      }

      allConvertibleIndices.push(i);
      if (!entries[i].isStrikethrough) {
        nonStrikeIndices.push(i);
      }
    }

    var candidateIndices = nonStrikeIndices.length > 0 ? nonStrikeIndices : allConvertibleIndices;
    if (candidateIndices.length === 0) {
      return -1;
    }

    // In the common old-vs-current pair, the current price is usually the lower value.
    if (candidateIndices.length === 2) {
      var left = entries[candidateIndices[0]];
      var right = entries[candidateIndices[1]];
      if (Number.isFinite(left.usdValue) && Number.isFinite(right.usdValue)) {
        return left.usdValue <= right.usdValue ? candidateIndices[0] : candidateIndices[1];
      }
    }

    var bestIndex = -1;
    var bestScore = Infinity;
    var entry;
    var className;
    var score;

    for (i = 0; i < candidateIndices.length; i += 1) {
      entry = entries[candidateIndices[i]];

      className = getClassName(entry.node).toLowerCase();
      score = 0;

      // Prefer nodes that usually represent current/live values.
      if (/(value|current|now|final|amount|active)/i.test(className)) {
        score -= 50;
      }

      // De-prioritize non-primary monetary labels (e.g. financing/monthly breakdowns).
      if (/(month|monthly|installment|payment|finance|per)/i.test(className)) {
        score += 20;
      }

      // Current price is usually the lower one.
      score += entry.usdValue * 0.0001;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = candidateIndices[i];
      }
    }

    return bestIndex;
  }

  function applyCurrencyToPriceContainer(priceNode, currencyContext, options) {
    if (!priceNode) {
      return {
        handled: false,
        convertedAny: false,
        result: false
      };
    }

    var priceTextTargets = getPriceTextTargets(priceNode);
    if (!Array.isArray(priceTextTargets) || priceTextTargets.length === 0) {
      return {
        handled: false,
        convertedAny: false,
        result: false
      };
    }

    var normalizedContext = normalizeCurrencyContext(currencyContext);
    var handled = false;
    var convertedAny = false;
    var conversionEnabled =
      normalizedContext.selectedCurrency !== "USD" &&
      Number.isFinite(normalizedContext.rate) &&
      normalizedContext.rate > 0;
    var normalizedOptions = options || {};
    var strikeMaxFractionDigits = normalizeMaxFractionDigits(
      normalizedOptions.strikeMaxFractionDigits,
      null
    );
    var targetEntries = [];
    var i;
    var priceTextTarget;
    var existingText;
    var storedUsdText;
    var storedUsdValueRaw;
    var usdValue;
    var primaryIndex = -1;
    var convertedText;

    for (i = 0; i < priceTextTargets.length; i += 1) {
      priceTextTarget = priceTextTargets[i];
      if (!priceTextTarget || typeof priceTextTarget.textContent !== "string") {
        continue;
      }

      existingText = getNodePrimaryText(priceTextTarget);
      storedUsdText =
        typeof priceTextTarget.getAttribute === "function"
          ? priceTextTarget.getAttribute(SIDEBAR_USD_TEXT_ATTR) || ""
          : "";

      if (!storedUsdText && existingText && typeof priceTextTarget.setAttribute === "function") {
        storedUsdText = existingText;
        priceTextTarget.setAttribute(SIDEBAR_USD_TEXT_ATTR, existingText);
      }

      storedUsdValueRaw =
        typeof priceTextTarget.getAttribute === "function"
          ? priceTextTarget.getAttribute(SIDEBAR_USD_VALUE_ATTR)
          : null;
      usdValue = parseStoredAmount(storedUsdValueRaw);

      if (usdValue == null) {
        usdValue = parseUsdAmount(storedUsdText || existingText);
        if (Number.isFinite(usdValue) && typeof priceTextTarget.setAttribute === "function") {
          priceTextTarget.setAttribute(SIDEBAR_USD_VALUE_ATTR, String(usdValue));
        }
      }

      handled = true;

      targetEntries.push({
        node: priceTextTarget,
        storedUsdText: storedUsdText,
        usdValue: usdValue,
        isStrikethrough: isStrikethroughNode(priceTextTarget)
      });
    }

    if (!conversionEnabled) {
      for (i = 0; i < targetEntries.length; i += 1) {
        if (targetEntries[i].storedUsdText) {
          setNodePrimaryText(targetEntries[i].node, targetEntries[i].storedUsdText);
        }
        setNodeTitle(targetEntries[i].node, "");
      }
      return {
        handled: handled,
        convertedAny: false,
        result: handled
      };
    }

    primaryIndex = choosePrimaryPriceIndex(targetEntries);

    for (i = 0; i < targetEntries.length; i += 1) {
      if (!Number.isFinite(targetEntries[i].usdValue)) {
        continue;
      }

      if (i === primaryIndex) {
        convertedText = formatCurrencyByCode(
          targetEntries[i].usdValue * normalizedContext.rate,
          normalizedContext.selectedCurrency
        );
      } else {
        convertedText = formatAmountWithoutCurrency(
          targetEntries[i].usdValue * normalizedContext.rate,
          targetEntries[i].isStrikethrough && strikeMaxFractionDigits != null
            ? strikeMaxFractionDigits
            : 2
        );
      }

      if (convertedText === "N/A") {
        setNodeTitle(targetEntries[i].node, "");
        continue;
      }

      setNodePrimaryText(targetEntries[i].node, convertedText);
      setNodeTitle(
        targetEntries[i].node,
        "USD: " + (targetEntries[i].storedUsdText || formatCurrency(targetEntries[i].usdValue))
      );
      convertedAny = true;
    }

    return {
      handled: handled,
      convertedAny: convertedAny,
      result: convertedAny
    };
  }

  function applySidebarCurrency(doc, currencyContext) {
    if (!doc || typeof doc.querySelector !== "function") {
      return false;
    }

    var priceNode = findFirstBySelectors(doc, PRICE_SELECTORS);
    if (!priceNode) {
      return false;
    }

    return applyCurrencyToPriceContainer(priceNode, currencyContext).result;
  }

  function applyCardCurrency(doc, currencyContext) {
    if (!doc || typeof doc.querySelectorAll !== "function") {
      return false;
    }

    var targets = collectCardPriceTargets(doc);
    if (!Array.isArray(targets) || targets.length === 0) {
      return false;
    }

    var handledAny = false;
    var i;
    var outcome;
    for (i = 0; i < targets.length; i += 1) {
      outcome = applyCurrencyToPriceContainer(targets[i], currencyContext, {
        strikeMaxFractionDigits: 0
      });
      if (outcome && outcome.handled) {
        handledAny = true;
      }
    }

    return handledAny;
  }

  function openMetadataInNewTab(rawListing, listing) {
    var payload = rawListing || (listing && listing.rawListing) || listing || {};
    var blob;
    var objectUrl;
    var newWindow;

    try {
      blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json"
      });
      objectUrl = URL.createObjectURL(blob);
      newWindow = window.open(objectUrl, "_blank", "noopener,noreferrer");

      if (!newWindow) {
        var link = document.createElement("a");
        link.href = objectUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      }

      setTimeout(function () {
        URL.revokeObjectURL(objectUrl);
      }, 60000);
    } catch (_) {
      // Intentionally silent. The metadata feature is non-blocking.
    }
  }

  function buildExpectedDropText(listing, metrics) {
    if (metrics.expectedDropState === "inactive") {
      return (
        "Listing appears inactive. Last update was " +
        formatDate(listing && listing.pricing ? listing.pricing.updatedAt : null)
      );
    }

    if (
      metrics.expectedDropState === "scheduled" &&
      Number.isFinite(metrics.expectedNextDropDays)
    ) {
      return String(metrics.expectedNextDropDays) + " days";
    }

    return "Not enough data to estimate";
  }

  function formatRelativeTimestamp(timestampMs) {
    if (!Number.isFinite(Number(timestampMs))) {
      return "";
    }

    var deltaMs = Date.now() - Number(timestampMs);
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      return "";
    }

    var seconds = Math.floor(deltaMs / 1000);
    if (seconds < 60) {
      return "just now";
    }

    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return String(minutes) + "m ago";
    }

    var hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return String(hours) + "h ago";
    }

    var days = Math.floor(hours / 24);
    return String(days) + "d ago";
  }

  function createMarketCompareSection(doc, marketCompare, onCompareClick) {
    var state = marketCompare && typeof marketCompare === "object" ? marketCompare : {};
    var status = typeof state.status === "string" ? state.status : "idle";
    var provider = typeof state.provider === "string" ? state.provider : "Depop";
    var message = typeof state.message === "string" ? state.message : "";
    var results = Array.isArray(state.results) ? state.results : [];

    var section = doc.createElement("div");
    section.className = "grailed-plus__market";

    var header = doc.createElement("div");
    header.className = "grailed-plus__market-header";

    var title = doc.createElement("span");
    title.className = "grailed-plus__market-title";
    title.textContent = "Other Markets";

    var chip = doc.createElement("span");
    chip.className = "grailed-plus__market-chip";

    if (status === "loading") {
      chip.textContent = "Searching";
    } else if (status === "results") {
      chip.textContent = "Results";
    } else if (status === "no-results") {
      chip.textContent = "No Results";
    } else if (status === "error") {
      chip.textContent = "Error";
    } else {
      chip.textContent = "Ready";
    }

    header.appendChild(title);
    header.appendChild(chip);
    section.appendChild(header);

    var providerLabel = doc.createElement("div");
    providerLabel.className = "grailed-plus__market-provider";
    providerLabel.textContent = provider;
    section.appendChild(providerLabel);

    if (message) {
      var messageNode = doc.createElement("div");
      messageNode.className = "grailed-plus__market-message";
      messageNode.textContent = message;
      section.appendChild(messageNode);
    }

    if (status === "results" && results.length > 0) {
      var list = doc.createElement("div");
      list.className = "grailed-plus__market-list";

      results.forEach(function (entry) {
        var row = doc.createElement("div");
        row.className = "grailed-plus__market-row";

        var link = doc.createElement("a");
        link.className = "grailed-plus__market-link";
        link.href = entry.url || "#";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = entry.title || "Listing";

        var meta = doc.createElement("span");
        meta.className = "grailed-plus__market-meta";
        var parts = [];

        if (Number.isFinite(entry.price)) {
          parts.push(formatCurrencyByCode(entry.price, entry.currency || "USD"));
        }
        if (Number.isFinite(entry.score)) {
          parts.push("score " + String(Math.round(entry.score)));
        }
        if (entry.deltaLabel) {
          parts.push(entry.deltaLabel);
        }

        meta.textContent = parts.join(" | ");

        row.appendChild(link);
        row.appendChild(meta);
        list.appendChild(row);
      });

      section.appendChild(list);
    }

    if (Number.isFinite(state.lastCheckedAt)) {
      var stamp = doc.createElement("div");
      stamp.className = "grailed-plus__market-stamp";
      stamp.textContent = "Last checked " + formatRelativeTimestamp(state.lastCheckedAt);
      section.appendChild(stamp);
    }

    var actions = doc.createElement("div");
    actions.className = "grailed-plus__market-actions";

    var compareButton = doc.createElement("button");
    compareButton.type = "button";
    compareButton.className = "grailed-plus__button gp-button grailed-plus__button--market-compare";
    compareButton.textContent = status === "loading" ? "Searching..." : "Compare on Depop";
    compareButton.disabled = status === "loading";
    if (typeof compareButton.addEventListener === "function") {
      compareButton.addEventListener("click", function () {
        if (typeof onCompareClick === "function") {
          onCompareClick();
        }
      });
    }

    actions.appendChild(compareButton);
    section.appendChild(actions);

    return section;
  }

  function renderInsightsPanel(options) {
    var listing = options && options.listing ? options.listing : {};
    var metrics = options && options.metrics ? options.metrics : {};
    var mountNode = options && options.mountNode ? options.mountNode : null;
    var mountPosition =
      options && options.mountPosition === "beforebegin" ? "beforebegin" : "afterend";
    var rawListing = options && options.rawListing ? options.rawListing : null;
    var statusMessage = options && options.statusMessage ? String(options.statusMessage) : "";
    var currencyContext = options && options.currencyContext ? options.currencyContext : null;
    var marketCompare = options && options.marketCompare ? options.marketCompare : null;
    var onMarketCompareClick =
      options && typeof options.onMarketCompareClick === "function"
        ? options.onMarketCompareClick
        : null;
    var doc = (mountNode && mountNode.ownerDocument) || document;

    if (!mountNode || !doc || typeof doc.createElement !== "function") {
      return null;
    }

    removeExistingPanels(doc);

    var panel = doc.createElement("section");
    panel.className = "grailed-plus-panel";
    panel.setAttribute(PANEL_ATTR, PANEL_ATTR_VALUE);

    if (statusMessage) {
      panel.appendChild(createRow(doc, "Status", statusMessage, "grailed-plus__row--status"));
    }

    var pricingHistory =
      listing && listing.pricing && Array.isArray(listing.pricing.history)
        ? listing.pricing.history
        : [];
    panel.appendChild(createTrendChartRow(doc, listing, currencyContext));

    var avgText = "N/A";
    var avgTitle = "";
    if (
      Number.isFinite(metrics.averageDropPercent) &&
      Number.isFinite(metrics.averageDropAmountUsd)
    ) {
      var avgDisplay = buildMoneyDisplay(metrics.averageDropAmountUsd, currencyContext);
      avgText = String(metrics.averageDropPercent) + "% (" + avgDisplay.text + ")";
      if (avgDisplay.isConverted) {
        avgTitle = "USD: " + avgDisplay.originalUsdText;
      }
    }

    var avgClass = "";
    if (metrics.averageDropPercent === 10 && pricingHistory.length > 2) {
      avgClass = "grailed-plus__row--alert";
    }

    panel.appendChild(createRow(doc, "Avg. Price Drop", avgText, avgClass, avgTitle));
    panel.appendChild(createRow(doc, "Next Expected Drop", buildExpectedDropText(listing, metrics)));
    panel.appendChild(
      createRow(doc, "Seller Account Created", formatDate(listing.seller && listing.seller.createdAt))
    );
    panel.appendChild(createMarketCompareSection(doc, marketCompare, onMarketCompareClick));

    var actions = doc.createElement("div");
    actions.className = "grailed-plus__actions";

    var metadataButton = doc.createElement("button");
    metadataButton.type = "button";
    metadataButton.className = "grailed-plus__button gp-button";
    metadataButton.textContent = "Listing Metadata";
    if (typeof metadataButton.addEventListener === "function") {
      metadataButton.addEventListener("click", function () {
        openMetadataInNewTab(rawListing, listing);
      });
    } else {
      metadataButton.onclick = function () {
        openMetadataInNewTab(rawListing, listing);
      };
    }

    actions.appendChild(metadataButton);
    panel.appendChild(actions);

    if (mountNode.parentNode) {
      if (mountPosition === "beforebegin") {
        if (typeof mountNode.insertAdjacentElement === "function") {
          mountNode.insertAdjacentElement("beforebegin", panel);
        } else {
          mountNode.parentNode.insertBefore(panel, mountNode);
        }
      } else if (typeof mountNode.insertAdjacentElement === "function") {
        mountNode.insertAdjacentElement("afterend", panel);
      } else if (mountNode.nextSibling) {
        mountNode.parentNode.insertBefore(panel, mountNode.nextSibling);
      } else {
        mountNode.parentNode.appendChild(panel);
      }
    } else if (doc.body) {
      doc.body.appendChild(panel);
    }

    return panel;
  }

  return {
    PANEL_ATTR: PANEL_ATTR,
    PANEL_ATTR_VALUE: PANEL_ATTR_VALUE,
    findMountTarget: findMountTarget,
    findMountNode: findMountNode,
    applySidebarCurrency: applySidebarCurrency,
    applyCardCurrency: applyCardCurrency,
    nodeContainsCardPriceTarget: nodeContainsCardPriceTarget,
    removeExistingPanels: removeExistingPanels,
    renderInsightsPanel: renderInsightsPanel,
    formatCurrency: formatCurrency,
    formatMoney: formatMoney
  };
});
