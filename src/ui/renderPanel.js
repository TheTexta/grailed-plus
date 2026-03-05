(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusRender = factory();
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
  var SIDEBAR_USD_TEXT_ATTR = "data-grailed-plus-original-price-text";
  var SIDEBAR_USD_VALUE_ATTR = "data-grailed-plus-original-price-value";

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
      mode: currencyContext && currencyContext.mode === "dual" ? "dual" : "dual"
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

  function formatAmountWithoutCurrency(value) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }

    try {
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(value);
    } catch (_) {
      return Number(value).toFixed(2);
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

  function hasElementChildren(node) {
    return Boolean(node && node.children && node.children.length > 0);
  }

  function getNodeText(node) {
    if (!node || typeof node.textContent !== "string") {
      return "";
    }
    return node.textContent.trim();
  }

  function isUsdPriceText(text) {
    if (typeof text !== "string") {
      return false;
    }

    // Convert only plain USD-like price text (e.g. "$500", "US $500", "CA$500").
    // This intentionally excludes percentage/label strings like "23% off".
    return /^\s*(?:[A-Z]{0,3}\s*)?\$\s*-?\d[\d,]*(?:\.\d+)?\s*$/i.test(text);
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
      var text = getNodeText(node);
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

    var leafCandidates = candidates.filter(function (node) {
      return !hasElementChildren(node);
    });

    if (leafCandidates.length > 0) {
      return leafCandidates;
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

  function applyCurrencyToPriceContainer(priceNode, currencyContext) {
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

      existingText = getNodeText(priceTextTarget);
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
          targetEntries[i].node.textContent = targetEntries[i].storedUsdText;
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
        convertedText = formatAmountWithoutCurrency(targetEntries[i].usdValue * normalizedContext.rate);
      }

      if (convertedText === "N/A") {
        setNodeTitle(targetEntries[i].node, "");
        continue;
      }

      targetEntries[i].node.textContent = convertedText;
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

    var containers = collectCardPriceContainers(doc);
    if (!Array.isArray(containers) || containers.length === 0) {
      return false;
    }

    var handledAny = false;
    var i;
    var outcome;
    for (i = 0; i < containers.length; i += 1) {
      outcome = applyCurrencyToPriceContainer(containers[i], currencyContext);
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
      return "Listing appears inactive. Last update was " + formatDate(listing.priceUpdatedAt);
    }

    if (metrics.expectedDropState === "scheduled" && Number.isFinite(metrics.expectedDropDays)) {
      return String(metrics.expectedDropDays) + " days";
    }

    return "Not enough data to estimate";
  }

  function renderPanel(options) {
    var listing = options && options.listing ? options.listing : {};
    var metrics = options && options.metrics ? options.metrics : {};
    var mountNode = options && options.mountNode ? options.mountNode : null;
    var mountPosition =
      options && options.mountPosition === "beforebegin" ? "beforebegin" : "afterend";
    var rawListing = options && options.rawListing ? options.rawListing : null;
    var statusMessage = options && options.statusMessage ? String(options.statusMessage) : "";
    var currencyContext = options && options.currencyContext ? options.currencyContext : null;
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

    var historyText;
    var historyTitle = "";
    if (Array.isArray(listing.priceDrops) && listing.priceDrops.length > 0) {
      var historyDisplays = listing.priceDrops.map(function (value) {
        return buildMoneyDisplay(Number(value), currencyContext);
      });
      historyText = historyDisplays
        .map(function (display) {
          return display.text;
        })
        .join(", ");
      historyText += " (total drops: " + listing.priceDrops.length + ")";

      var convertedOriginals = historyDisplays
        .filter(function (display) {
          return display.isConverted;
        })
        .map(function (display) {
          return display.originalUsdText;
        });
      if (convertedOriginals.length > 0) {
        historyTitle = "USD: " + convertedOriginals.join(", ");
      }
    } else {
      historyText = "No price drops on record";
    }

    panel.appendChild(createRow(doc, "Price History", historyText, "", historyTitle));

    var avgText = "N/A";
    var avgTitle = "";
    if (Number.isFinite(metrics.avgDropPercent) && Number.isFinite(metrics.avgDropAmount)) {
      var avgDisplay = buildMoneyDisplay(metrics.avgDropAmount, currencyContext);
      avgText = String(metrics.avgDropPercent) + "% (" + avgDisplay.text + ")";
      if (avgDisplay.isConverted) {
        avgTitle = "USD: " + avgDisplay.originalUsdText;
      }
    }

    var avgClass = "";
    if (metrics.avgDropPercent === 10 && Array.isArray(listing.priceDrops) && listing.priceDrops.length > 2) {
      avgClass = "grailed-plus__row--alert";
    }

    panel.appendChild(createRow(doc, "Avg. Price Drop", avgText, avgClass, avgTitle));
    panel.appendChild(createRow(doc, "Next Expected Drop", buildExpectedDropText(listing, metrics)));
    panel.appendChild(
      createRow(doc, "Seller Account Created", formatDate(listing.seller && listing.seller.createdAt))
    );

    var actions = doc.createElement("div");
    actions.className = "grailed-plus__actions";

    var metadataButton = doc.createElement("button");
    metadataButton.type = "button";
    metadataButton.className = "grailed-plus__button";
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
    removeExistingPanels: removeExistingPanels,
    renderPanel: renderPanel,
    formatCurrency: formatCurrency,
    formatMoney: formatMoney
  };
});
