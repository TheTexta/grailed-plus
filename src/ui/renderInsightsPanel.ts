(function (root: any, factory: any) {
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
  var TREND_POINT_RADIUS = 3;
  var TREND_PLOT_PADDING = 6;
  var PANEL_TITLE_TEXT = "Pricing Insights";
  var DEFAULT_MARKET_COMPARE_RESULTS_LIMIT = 5;
  var trendClipIdCounter = 0;
  var panelTitleIdCounter = 0;
  var cachedDateFormatter: Intl.DateTimeFormat | null = null;

  function normalizeCurrencyCode(input: any) {
    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  function formatCurrencyByCode(value: any, currencyCode: any) {
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

  function normalizeCurrencyContext(currencyContext: any) {
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

  function formatCurrency(value: any) {
    return formatCurrencyByCode(value, "USD");
  }

  function formatMoney(valueUsd: any, currencyContext: any) {
    if (!Number.isFinite(valueUsd)) {
      return "N/A";
    }

    var usdText = formatCurrency(valueUsd);
    var normalizedContext = normalizeCurrencyContext(currencyContext);
    var rate = Number(normalizedContext.rate);
    if (
      normalizedContext.selectedCurrency === "USD" ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      return usdText;
    }

    var converted = valueUsd * rate;
    var convertedText = formatCurrencyByCode(converted, normalizedContext.selectedCurrency);
    if (convertedText === "N/A") {
      return usdText;
    }

    return convertedText;
  }

  function buildMoneyDisplay(valueUsd: any, currencyContext: any) {
    if (!Number.isFinite(valueUsd)) {
      return {
        text: "N/A",
        isConverted: false,
        originalUsdText: ""
      };
    }

    var usdText = formatCurrency(valueUsd);
    var normalizedContext = normalizeCurrencyContext(currencyContext);
    var rate = Number(normalizedContext.rate);
    if (
      normalizedContext.selectedCurrency === "USD" ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      return {
        text: usdText,
        isConverted: false,
        originalUsdText: usdText
      };
    }

    var converted = valueUsd * rate;
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

  function normalizeMaxFractionDigits(value: any, fallback: any) {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    var rounded = Math.floor(value);
    if (rounded < 0) {
      return fallback;
    }

    return rounded;
  }

  function formatAmountWithoutCurrency(value: any, maxFractionDigits: any) {
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

  function formatDate(isoValue: any) {
    if (!isoValue) {
      return "Unknown";
    }
    var date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) {
      return "Unknown";
    }
    if (!cachedDateFormatter) {
      try {
        cachedDateFormatter = new Intl.DateTimeFormat(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
      } catch (_) {
        cachedDateFormatter = null;
      }
    }

    if (cachedDateFormatter) {
      return cachedDateFormatter.format(date);
    }

    try {
      return date.toDateString();
    } catch (_) {
      return "Unknown";
    }
  }

  function normalizeExternalUrl(input: any) {
    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    try {
      var parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return null;
      }
      return parsed.toString();
    } catch (_) {
      return null;
    }
  }

  function formatTrendPointAriaLabel(point: any, currencyContext: any) {
    if (!point || !(point.date instanceof Date) || !Number.isFinite(point.priceUsd)) {
      return "Price point";
    }

    var display = buildMoneyDisplay(point.priceUsd, currencyContext);
    var dateText = formatDate(point.date.toISOString());
    if (display.isConverted) {
      return dateText + ": " + display.text + " (USD: " + display.originalUsdText + ")";
    }

    return dateText + ": " + display.text;
  }

  function buildTrendChartAriaLabel(points: any, currencyContext: any) {
    if (!Array.isArray(points) || points.length <= 1) {
      return "Price trend unavailable: no price history data";
    }

    var first = points[0];
    var last = points[points.length - 1];
    if (!first || !last) {
      return "Price trend";
    }

    return (
      "Price trend with " +
      String(points.length) +
      " points from " +
      formatDate(first.date.toISOString()) +
      " to " +
      formatDate(last.date.toISOString()) +
      ". Latest " +
      buildMoneyDisplay(last.priceUsd, currencyContext).text
    );
  }

  function parseDateMs(value: any) {
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

  function normalizeTrendPoints(listing: any) {
    var history =
      listing && listing.pricing && Array.isArray(listing.pricing.history)
        ? listing.pricing.history
        : [];

    if (!Array.isArray(history) || history.length <= 1) {
      return [];
    }

    var createdAtMs = parseDateMs(listing ? listing.createdAt : null);
    var updatedAtMs = parseDateMs(listing && listing.pricing ? listing.pricing.updatedAt : null);
    var createdAtMsValue = Number(createdAtMs);
    var updatedAtMsValue = Number(updatedAtMs);
    if (
      !Number.isFinite(createdAtMsValue) ||
      !Number.isFinite(updatedAtMsValue) ||
      updatedAtMsValue <= createdAtMsValue
    ) {
      return [];
    }

    var intervalMs = (updatedAtMsValue - createdAtMsValue) / (history.length - 1);
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

      ts = createdAtMsValue + intervalMs * i;
      points.push({
        key: String(Math.round(ts)) + ":" + String(price) + ":" + String(i),
        index: i,
        timestampMs: Math.round(ts),
        date: new Date(ts),
        priceUsd: price
      });
    }

    points.sort(function (a: any, b: any) {
      return a.timestampMs - b.timestampMs;
    });

    return points;
  }

  function createTrendChartRow(doc: any, listing: any, currencyContext: any) {
    var row = doc.createElement("div");
    row.className = "grailed-plus__trend-row";

    var chart = doc.createElement("div");
    chart.className = "grailed-plus__trend-chart";
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "Price trend");
    row.appendChild(chart);

    var points = normalizeTrendPoints(listing);
    chart.setAttribute("aria-label", buildTrendChartAriaLabel(points, currencyContext));

    if (points.length <= 1) {
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

    function createSvgElement(tagName: any) {
      if (doc && typeof doc.createElementNS === "function") {
        return doc.createElementNS("http://www.w3.org/2000/svg", tagName);
      }

      return doc.createElement(tagName);
    }

    function setAttr(node: any, key: any, value: any) {
      if (!node || typeof node.setAttribute !== "function") {
        return;
      }

      node.setAttribute(key, String(value));
    }

    function setClass(node: any, className: any) {
      if (!node) {
        return;
      }

      if (typeof node.className === "string") {
        node.className = className;
      }

      if (typeof node.setAttribute === "function") {
        node.setAttribute("class", className);
      }
    }

    var minTimestamp = points[0].timestampMs;
    var maxTimestamp = points[points.length - 1].timestampMs;
    var yMin = points[0].priceUsd;
    var yMax = points[0].priceUsd;
    var i;

    for (i = 1; i < points.length; i += 1) {
      if (points[i].priceUsd < yMin) {
        yMin = points[i].priceUsd;
      }
      if (points[i].priceUsd > yMax) {
        yMax = points[i].priceUsd;
      }
    }

    if (yMin === yMax) {
      yMin = yMin - 1;
      yMax = yMax + 1;
    }

    var xStart = TREND_PLOT_PADDING;
    var xEnd = Math.max(TREND_PLOT_PADDING, innerWidth - TREND_PLOT_PADDING);
    var yStart = Math.max(TREND_PLOT_PADDING, innerHeight - TREND_PLOT_PADDING);
    var yEnd = TREND_PLOT_PADDING;

    function scaleX(timestampMs: any) {
      if (maxTimestamp === minTimestamp) {
        return (xStart + xEnd) / 2;
      }

      return xStart + ((timestampMs - minTimestamp) / (maxTimestamp - minTimestamp)) * (xEnd - xStart);
    }

    function scaleY(priceUsd: any) {
      if (yMax === yMin) {
        return (yStart + yEnd) / 2;
      }

      return yStart + ((priceUsd - yMin) / (yMax - yMin)) * (yEnd - yStart);
    }

    var svg = createSvgElement("svg");
    setClass(svg, "grailed-plus__trend-svg");
    setAttr(svg, "viewBox", "0 0 " + String(width) + " " + String(height));
    setAttr(svg, "preserveAspectRatio", "xMidYMid meet");
    setAttr(svg, "aria-hidden", "true");
    chart.appendChild(svg);

    var root = createSvgElement("g");
    setClass(root, "grailed-plus__trend-root");
    setAttr(root, "transform", "translate(" + String(TREND_MARGIN.left) + "," + String(TREND_MARGIN.top) + ")");
    svg.appendChild(root);

    var clipPathId = TREND_CLIP_ID_PREFIX + String(trendClipIdCounter);
    var clipPadding = TREND_POINT_RADIUS + 1;
    trendClipIdCounter += 1;

    var defs = createSvgElement("defs");
    svg.appendChild(defs);

    var clipPath = createSvgElement("clipPath");
    setAttr(clipPath, "id", clipPathId);
    setAttr(clipPath, "clipPathUnits", "userSpaceOnUse");
    defs.appendChild(clipPath);

    var clipRect = createSvgElement("rect");
    setAttr(clipRect, "x", -clipPadding);
    setAttr(clipRect, "y", -clipPadding);
    setAttr(clipRect, "width", innerWidth + clipPadding * 2);
    setAttr(clipRect, "height", innerHeight + clipPadding * 2);
    clipPath.appendChild(clipRect);

    var trendLineLayer = createSvgElement("g");
    setClass(trendLineLayer, "grailed-plus__trend-line-layer");
    setAttr(trendLineLayer, "clip-path", "url(#" + clipPathId + ")");
    root.appendChild(trendLineLayer);

    var trendPointLayer = createSvgElement("g");
    setClass(trendPointLayer, "grailed-plus__trend-point-layer");
    setAttr(trendPointLayer, "clip-path", "url(#" + clipPathId + ")");
    root.appendChild(trendPointLayer);

    var pathData = "";
    for (i = 0; i < points.length; i += 1) {
      var cmd = i === 0 ? "M" : "L";
      pathData +=
        cmd + String(scaleX(points[i].timestampMs)) + " " + String(scaleY(points[i].priceUsd)) + " ";
    }

    var linePath = createSvgElement("path");
    setClass(linePath, "grailed-plus__trend-line");
    setAttr(linePath, "d", pathData.trim());
    trendLineLayer.appendChild(linePath);

    var tooltip = doc.createElement("div");
    tooltip.className = "grailed-plus__trend-tooltip";
    tooltip.setAttribute("aria-hidden", "true");
    chart.appendChild(tooltip);

    function setTooltipAlignment(alignment: any) {
      var normalized = alignment === "left" || alignment === "right" ? alignment : "center";
      tooltip.className = "grailed-plus__trend-tooltip grailed-plus__trend-tooltip--" + normalized;
    }

    setTooltipAlignment("center");

    function showTooltip(event: any, point: any) {
      var display = buildMoneyDisplay(point.priceUsd, currencyContext);
      var tooltipText = display.text + " - " + formatDate(point.date.toISOString());

      tooltip.textContent = tooltipText;
      if (display.isConverted) {
        tooltip.setAttribute("title", "USD: " + display.originalUsdText);
      } else {
        tooltip.removeAttribute("title");
      }

      var xPos = Number(event && event.offsetX);
      var yPos = Number(event && event.offsetY);
      if (!Number.isFinite(xPos) || !Number.isFinite(yPos)) {
        xPos = scaleX(point.timestampMs) + TREND_MARGIN.left;
        yPos = scaleY(point.priceUsd) + TREND_MARGIN.top;
      }

      var chartWidth = Number(chart && chart.clientWidth);
      if (!Number.isFinite(chartWidth) || chartWidth <= 0) {
        chartWidth = width;
      }
      var chartHeight = Number(chart && chart.clientHeight);
      if (!Number.isFinite(chartHeight) || chartHeight <= 0) {
        chartHeight = height;
      }

      var tooltipRect =
        tooltip && typeof tooltip.getBoundingClientRect === "function"
          ? tooltip.getBoundingClientRect()
          : null;
      var tooltipWidth = Number(tooltipRect && tooltipRect.width);
      if (!Number.isFinite(tooltipWidth) || tooltipWidth <= 0) {
        tooltipWidth = tooltipText.length * 6.2;
      }

      var chartInset = 8;
      var edgeOffset = 5;
      var alignment = "center";
      var tooltipX = xPos;

      if (xPos + tooltipWidth / 2 > chartWidth - chartInset) {
        alignment = "right";
        tooltipX = Math.max(chartInset, xPos - edgeOffset);
      } else if (xPos - tooltipWidth / 2 < chartInset) {
        alignment = "left";
        tooltipX = Math.min(chartWidth - chartInset, xPos + edgeOffset);
      }

      var tooltipY = Math.max(10, Math.min(chartHeight - 4, yPos - 12));

      if (tooltip && tooltip.style) {
        setTooltipAlignment(alignment);
        tooltip.style.opacity = "1";
        tooltip.style.left = String(tooltipX) + "px";
        tooltip.style.top = String(tooltipY) + "px";
      }
      tooltip.setAttribute("aria-hidden", "false");
    }

    function hideTooltip() {
      if (tooltip && tooltip.style) {
        tooltip.style.opacity = "0";
      }
      tooltip.setAttribute("aria-hidden", "true");
    }

    var pointNodes: any[] = [];

    function setActivePointByKey(pointKey: any) {
      var j;
      var node;
      var key;
      for (j = 0; j < pointNodes.length; j += 1) {
        node = pointNodes[j];
        key = typeof node.getAttribute === "function" ? node.getAttribute("data-point-key") : null;
        setClass(node, key === pointKey ? "grailed-plus__trend-point is-active" : "grailed-plus__trend-point");
      }
    }

    for (i = 0; i < points.length; i += 1) {
      (function (point: any) {
        var pointNode = createSvgElement("circle");
        setClass(pointNode, "grailed-plus__trend-point");
        setAttr(pointNode, "cx", scaleX(point.timestampMs));
        setAttr(pointNode, "cy", scaleY(point.priceUsd));
        setAttr(pointNode, "r", TREND_POINT_RADIUS);
        setAttr(pointNode, "tabindex", 0);
        setAttr(pointNode, "data-point-key", point.key);
        setAttr(pointNode, "aria-label", formatTrendPointAriaLabel(point, currencyContext));

        if (typeof pointNode.addEventListener === "function") {
          pointNode.addEventListener("focus", function (event: any) {
            setActivePointByKey(point.key);
            showTooltip(event, point);
          });
          pointNode.addEventListener("blur", function () {
            setActivePointByKey(null);
            hideTooltip();
          });
        }

        trendPointLayer.appendChild(pointNode);
        pointNodes.push(pointNode);
      })(points[i]);
    }

    function findNearestPoint(event: any) {
      var px = Number(event && event.offsetX);
      if (Number.isFinite(px)) {
        px = px - TREND_MARGIN.left;
      }

      if (!Number.isFinite(px) && event && Number.isFinite(Number(event.clientX))) {
        var svgRect = typeof svg.getBoundingClientRect === "function" ? svg.getBoundingClientRect() : null;
        if (svgRect) {
          px = Number(event.clientX) - Number(svgRect.left) - TREND_MARGIN.left;
        }
      }

      if (!Number.isFinite(px)) {
        return points[points.length - 1];
      }

      var clampedPx = Math.max(0, Math.min(innerWidth, px));
      var nearestPoint = points[0];
      var nearestDelta = Math.abs(scaleX(points[0].timestampMs) - clampedPx);
      var j;
      var nextDelta;
      for (j = 1; j < points.length; j += 1) {
        nextDelta = Math.abs(scaleX(points[j].timestampMs) - clampedPx);
        if (nextDelta < nearestDelta) {
          nearestDelta = nextDelta;
          nearestPoint = points[j];
        }
      }

      return nearestPoint;
    }

    function syncHoverState(event: any) {
      var nearest = findNearestPoint(event);
      setActivePointByKey(nearest.key);
      showTooltip(event, nearest);
    }

    var rafScope = typeof globalThis !== "undefined" ? (globalThis as any) : null;
    var requestFrame =
      rafScope && typeof rafScope.requestAnimationFrame === "function"
        ? rafScope.requestAnimationFrame.bind(rafScope)
        : null;
    var cancelFrame =
      rafScope && typeof rafScope.cancelAnimationFrame === "function"
        ? rafScope.cancelAnimationFrame.bind(rafScope)
        : null;
    var pendingHoverEvent: any = null;
    var hoverFrameHandle: any = null;

    function flushHoverFrame() {
      hoverFrameHandle = null;
      if (!pendingHoverEvent) {
        return;
      }

      var nextEvent = pendingHoverEvent;
      pendingHoverEvent = null;
      syncHoverState(nextEvent);
    }

    function scheduleHoverSync(event: any) {
      pendingHoverEvent = event;
      if (!requestFrame) {
        flushHoverFrame();
        return;
      }

      if (hoverFrameHandle !== null) {
        return;
      }

      hoverFrameHandle = requestFrame(flushHoverFrame);
    }

    var hitArea = createSvgElement("rect");
    setClass(hitArea, "grailed-plus__trend-hit-area");
    setAttr(hitArea, "x", 0);
    setAttr(hitArea, "y", 0);
    setAttr(hitArea, "width", innerWidth);
    setAttr(hitArea, "height", innerHeight);
    setAttr(hitArea, "fill", "transparent");
    setAttr(hitArea, "pointer-events", "all");
    if (typeof hitArea.addEventListener === "function") {
      hitArea.addEventListener("mouseenter", scheduleHoverSync);
      hitArea.addEventListener("mousemove", scheduleHoverSync);
      hitArea.addEventListener("mouseleave", function () {
        pendingHoverEvent = null;
        if (hoverFrameHandle !== null && cancelFrame) {
          cancelFrame(hoverFrameHandle);
        }
        hoverFrameHandle = null;
        setActivePointByKey(null);
        hideTooltip();
      });
    }
    root.appendChild(hitArea);

    return row;
  }

  function createRow(doc: any, label: any, value: any, extraClass: any = "", valueTitle: any = "") {
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

  function setNodeTitle(node: any, title: any) {
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

  function removeExistingPanels(doc: any) {
    if (!doc || typeof doc.querySelectorAll !== "function") {
      return;
    }

    var existingPanels = doc.querySelectorAll("[" + PANEL_ATTR + '="' + PANEL_ATTR_VALUE + '"]');
    Array.prototype.forEach.call(existingPanels, function (panel: any) {
      if (panel && typeof panel.remove === "function") {
        panel.remove();
      } else if (panel && panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    });
  }

  function getClassName(node: any) {
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

  function findFirstBySelectors(root: any, selectors: any) {
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

  function collectCtaCandidates(root: any) {
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

  function appendUniqueNodes(target: any, source: any) {
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

  function isCardPriceContainer(node: any) {
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

  function findClosestCardPriceContainer(node: any) {
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

  function collectCardPriceContainers(doc: any) {
    if (!doc || typeof doc.querySelectorAll !== "function") {
      return [];
    }

    var currentNodes = doc.querySelectorAll(CARD_PRICE_CURRENT_SELECTOR);
    var containers: any[] = [];
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

  function collectMoneyRootPriceNodes(doc: any) {
    if (!doc || typeof doc.querySelectorAll !== "function") {
      return [];
    }

    var nodes = doc.querySelectorAll(MONEY_ROOT_PRICE_SELECTOR);
    var matches: any[] = [];
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      appendUniqueNodes(matches, [nodes[i]]);
    }

    return matches;
  }

  function isNodeWithinAnyTarget(node: any, targets: any) {
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

  function collectCardPriceTargets(doc: any) {
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

  function nodeContainsCardPriceTarget(node: any) {
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

  function findSidebarScope(priceNode: any) {
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

  function getRootNode(node: any) {
    var current = node;
    while (current && current.parentNode) {
      current = current.parentNode;
    }
    return current;
  }

  function getChildIndex(node: any) {
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

  function buildNodePath(node: any) {
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

  function compareNodeOrder(left: any, right: any) {
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

  function findCtaNode(doc: any, priceNode: any) {
    var candidates: any[] = [];

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

  function findMountTarget(doc: any) {
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

  function findMountNode(doc: any) {
    var mountTarget = findMountTarget(doc);
    return mountTarget && mountTarget.mountNode ? mountTarget.mountNode : null;
  }

  function parseUsdAmount(text: any) {
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

  function parseStoredAmount(value: any) {
    if (value == null) {
      return null;
    }

    if (typeof value === "string" && value.trim() === "") {
      return null;
    }

    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getNodeText(node: any) {
    if (!node || typeof node.textContent !== "string") {
      return "";
    }
    return node.textContent.trim();
  }

  function getNodePrimaryText(node: any) {
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

  function setNodePrimaryText(node: any, text: any) {
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

  function isDescendantOf(node: any, potentialAncestor: any) {
    var current = node && node.parentNode;
    while (current) {
      if (current === potentialAncestor) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  }

  function hasConvertibleDescendant(node: any, candidates: any) {
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

  function isUsdPriceText(text: any) {
    if (typeof text !== "string") {
      return false;
    }

    // Convert USD-like price text (e.g. "$500", "US $500", "$500 (Offer Price)").
    // This intentionally excludes percentage/label strings like "23% off".
    return /^\s*(?:[A-Z]{0,3}\s*)?\$\s*-?\d[\d,]*(?:\.\d+)?\s*(?:\([^)]*\))?\s*$/i.test(text);
  }

  function hasStoredOriginalPrice(node: any) {
    if (!node || typeof node.getAttribute !== "function") {
      return false;
    }

    return Boolean(node.getAttribute(SIDEBAR_USD_TEXT_ATTR));
  }

  function isStrikethroughNode(node: any) {
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

  function collectPriceTextCandidates(priceNode: any) {
    if (!priceNode) {
      return [];
    }

    var candidates = [priceNode];
    if (typeof priceNode.querySelectorAll === "function") {
      var descendants = priceNode.querySelectorAll("*");
      Array.prototype.forEach.call(descendants, function (node: any) {
        candidates.push(node);
      });
    }

    return candidates.filter(function (node: any) {
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

  function getPriceTextTargets(priceNode: any) {
    var candidates = collectPriceTextCandidates(priceNode);
    if (candidates.length === 0) {
      return priceNode ? [priceNode] : [];
    }

    var terminalCandidates = candidates.filter(function (node: any) {
      return !hasConvertibleDescendant(node, candidates);
    });

    if (terminalCandidates.length > 0) {
      return terminalCandidates;
    }

    return [candidates[0]];
  }

  function choosePrimaryPriceIndex(entries: any) {
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

  function applyCurrencyToPriceContainer(priceNode: any, currencyContext: any, options: any = {}) {
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
    var conversionRate = Number(normalizedContext.rate);
    var handled = false;
    var convertedAny = false;
    var conversionEnabled =
      normalizedContext.selectedCurrency !== "USD" &&
      Number.isFinite(conversionRate) &&
      conversionRate > 0;
    var normalizedOptions = options || {};
    var strikeMaxFractionDigits = normalizeMaxFractionDigits(
      normalizedOptions.strikeMaxFractionDigits,
      null
    );
    var targetEntries: any[] = [];
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
      var entry = targetEntries[i];
      if (!entry || !Number.isFinite(entry.usdValue)) {
        continue;
      }
      var usdAmount = Number(entry.usdValue);

      if (i === primaryIndex) {
        convertedText = formatCurrencyByCode(
          usdAmount * conversionRate,
          normalizedContext.selectedCurrency
        );
      } else {
        convertedText = formatAmountWithoutCurrency(
          usdAmount * conversionRate,
          entry.isStrikethrough && strikeMaxFractionDigits != null
            ? strikeMaxFractionDigits
            : 2
        );
      }

      if (convertedText === "N/A") {
        setNodeTitle(entry.node, "");
        continue;
      }

      setNodePrimaryText(entry.node, convertedText);
      setNodeTitle(
        entry.node,
        "USD: " + (entry.storedUsdText || formatCurrency(usdAmount))
      );
      convertedAny = true;
    }

    return {
      handled: handled,
      convertedAny: convertedAny,
      result: convertedAny
    };
  }

  function applySidebarCurrency(doc: any, currencyContext: any) {
    if (!doc || typeof doc.querySelector !== "function") {
      return false;
    }

    var priceNode = findFirstBySelectors(doc, PRICE_SELECTORS);
    if (!priceNode) {
      return false;
    }

    return applyCurrencyToPriceContainer(priceNode, currencyContext).result;
  }

  function applyCardCurrency(doc: any, currencyContext: any) {
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

  function openMetadataInNewTab(rawListing: any, listing: any) {
    var payload = rawListing || (listing && listing.rawListing) || listing || {};
    var blob;
    var objectUrl = "";
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

  function buildExpectedDropText(listing: any, metrics: any) {
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

  function formatRelativeTimestamp(timestampMs: any) {
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

  function extractPercentValue(input: any) {
    if (typeof input !== "string") {
      return null;
    }

    var match = input.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
    if (!match) {
      return null;
    }

    var value = Number(match[1]);
    if (!Number.isFinite(value)) {
      return null;
    }

    return value;
  }

  function normalizeMarketCompareResultsLimit(input: any) {
    var parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_MARKET_COMPARE_RESULTS_LIMIT;
    }

    return Math.floor(parsed);
  }

  function getPercentToneClass(percentValue: any) {
    if (!Number.isFinite(percentValue) || percentValue === 0) {
      return "";
    }

    var absPercent = Math.abs(Number(percentValue));
    var intensity = "soft";
    if (absPercent >= 15) {
      intensity = "strong";
    } else if (absPercent >= 8) {
      intensity = "mid";
    }

    if (percentValue < 0) {
      return "grailed-plus__percent--down-" + intensity;
    }

    return "grailed-plus__percent--up-" + intensity;
  }

  function appendMetaSegment(doc: any, parent: any, text: any, extraClass: any = "") {
    if (!parent || typeof text !== "string") {
      return;
    }

    if (parent.childNodes && parent.childNodes.length > 0) {
      var separator = doc.createElement("span");
      separator.className = "grailed-plus__market-meta-separator";
      separator.textContent = " | ";
      parent.appendChild(separator);
    }

    var segment = doc.createElement("span");
    segment.className = "grailed-plus__market-meta-segment" + (extraClass ? " " + extraClass : "");
    segment.textContent = text;
    parent.appendChild(segment);
  }

  function createMarketCompareSection(
    doc: any,
    marketCompare: any,
    onCompareClick: any,
    marketCompareResultsLimit: any
  ) {
    var state = marketCompare && typeof marketCompare === "object" ? marketCompare : {};
    var status = typeof state.status === "string" ? state.status : "idle";
    var provider = typeof state.provider === "string" ? state.provider : "Depop";
    var message = typeof state.message === "string" ? state.message : "";
    var results = Array.isArray(state.results) ? state.results : [];
    var displayLimit = normalizeMarketCompareResultsLimit(marketCompareResultsLimit);
    var displayResults = results.slice(0, displayLimit);

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

    if (status === "results" && displayResults.length > 0) {
      var list = doc.createElement("ul");
      list.className = "grailed-plus__market-list";
      var providerLower = provider.toLowerCase();

      displayResults.forEach(function (entry: any) {
        var row = doc.createElement("li");
        row.className = "grailed-plus__market-row";
        var body = doc.createElement("div");
        body.className = "grailed-plus__market-body";

        var listingTitle =
          entry && typeof entry.title === "string" && entry.title.trim()
            ? entry.title.trim()
            : "Listing";
        var url = normalizeExternalUrl(entry && entry.url);
        var link;
        if (url) {
          link = doc.createElement("a");
          link.className = "grailed-plus__market-link";
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = listingTitle;
        } else {
          link = doc.createElement("span");
          link.className = "grailed-plus__market-link grailed-plus__market-link--unavailable";
          link.textContent = listingTitle;
          if (typeof link.setAttribute === "function") {
            link.setAttribute("aria-disabled", "true");
          }
        }

        var meta = doc.createElement("span");
        meta.className = "grailed-plus__market-meta";
        var deltaText =
          entry && typeof entry.deltaLabel === "string" ? entry.deltaLabel.trim() : "";
        var deltaPercent = extractPercentValue(deltaText);
        var deltaToneClass = getPercentToneClass(deltaPercent);

        if (Number.isFinite(entry.price)) {
          appendMetaSegment(doc, meta, formatCurrencyByCode(entry.price, entry.currency || "USD"));
        }
        if (Number.isFinite(entry.score)) {
          appendMetaSegment(doc, meta, "score " + String(Math.round(entry.score)));
        }
        if (deltaText) {
          appendMetaSegment(doc, meta, deltaText, deltaToneClass);
        }

        var imageUrl = normalizeExternalUrl(entry && entry.imageUrl);
        if (providerLower === "depop" && imageUrl) {
          var preview = doc.createElement("span");
          preview.className = "grailed-plus__market-preview";

          var previewImage = doc.createElement("img");
          previewImage.className = "grailed-plus__market-preview-image";
          previewImage.src = imageUrl;
          previewImage.alt = listingTitle;
          previewImage.loading = "lazy";
          previewImage.decoding = "async";

          preview.appendChild(previewImage);
          row.appendChild(preview);
        }

        body.appendChild(link);
        body.appendChild(meta);
        row.appendChild(body);

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
    compareButton.className = "gp-button grailed-plus__panel-button";
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

  function renderInsightsPanel(options: any) {
    var listing = options && options.listing ? options.listing : {};
    var metrics = options && options.metrics ? options.metrics : {};
    var mountNode = options && options.mountNode ? options.mountNode : null;
    var mountPosition =
      options && options.mountPosition === "beforebegin" ? "beforebegin" : "afterend";
    var rawListing = options && options.rawListing ? options.rawListing : null;
    var statusMessage = options && options.statusMessage ? String(options.statusMessage) : "";
    var currencyContext = options && options.currencyContext ? options.currencyContext : null;
    var marketCompare = options && options.marketCompare ? options.marketCompare : null;
    var marketCompareResultsLimit =
      options && options.marketCompareResultsLimit != null
        ? options.marketCompareResultsLimit
        : DEFAULT_MARKET_COMPARE_RESULTS_LIMIT;
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

    var panelTitleId = "grailed-plus-panel-title-" + String(panelTitleIdCounter);
    panelTitleIdCounter += 1;
    panel.setAttribute("aria-labelledby", panelTitleId);

    var panelTitle = doc.createElement("h2");
    panelTitle.className = "grailed-plus-panel__title";
    panelTitle.id = panelTitleId;
    panelTitle.textContent = PANEL_TITLE_TEXT;
    panel.appendChild(panelTitle);

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

    var avgRow = createRow(doc, "Avg. Price Drop", avgText, avgClass, avgTitle);
    var avgValueNode = avgRow.querySelector(".grailed-plus__value");
    var avgToneClass = getPercentToneClass(-Number(metrics.averageDropPercent));
    if (avgValueNode && avgToneClass) {
      avgValueNode.className += " " + avgToneClass;
    }
    panel.appendChild(avgRow);
    panel.appendChild(createRow(doc, "Next Expected Drop", buildExpectedDropText(listing, metrics)));
    panel.appendChild(
      createRow(doc, "Seller Account Created", formatDate(listing.seller && listing.seller.createdAt))
    );
    panel.appendChild(
      createMarketCompareSection(
        doc,
        marketCompare,
        onMarketCompareClick,
        marketCompareResultsLimit
      )
    );

    var actions = doc.createElement("div");
    actions.className = "grailed-plus__actions";

    var metadataButton = doc.createElement("button");
    metadataButton.type = "button";
    metadataButton.className = "gp-button grailed-plus__panel-button";
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
