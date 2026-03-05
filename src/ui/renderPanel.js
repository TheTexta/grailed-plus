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
  var SIDEBAR_USD_TEXT_ATTR = "data-grailed-plus-usd-text";
  var SIDEBAR_USD_VALUE_ATTR = "data-grailed-plus-usd-value";

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

    if (normalizedContext.mode === "dual") {
      return convertedText + " (" + usdText + ")";
    }

    return convertedText;
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

  function createRow(doc, label, value, extraClass) {
    var row = doc.createElement("div");
    row.className = "grailed-plus__row" + (extraClass ? " " + extraClass : "");

    var labelNode = doc.createElement("span");
    labelNode.className = "grailed-plus__label";
    labelNode.textContent = label;

    var valueNode = doc.createElement("span");
    valueNode.className = "grailed-plus__value";
    valueNode.textContent = value;

    row.appendChild(labelNode);
    row.appendChild(valueNode);
    return row;
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

  function applySidebarCurrency(doc, currencyContext) {
    if (!doc || typeof doc.querySelector !== "function") {
      return false;
    }

    var priceNode = findFirstBySelectors(doc, PRICE_SELECTORS);
    if (!priceNode) {
      return false;
    }

    var existingText = typeof priceNode.textContent === "string" ? priceNode.textContent.trim() : "";
    var storedUsdText =
      typeof priceNode.getAttribute === "function"
        ? priceNode.getAttribute(SIDEBAR_USD_TEXT_ATTR) || ""
        : "";

    if (!storedUsdText && existingText && typeof priceNode.setAttribute === "function") {
      storedUsdText = existingText;
      priceNode.setAttribute(SIDEBAR_USD_TEXT_ATTR, existingText);
    }

    var storedUsdValueRaw =
      typeof priceNode.getAttribute === "function"
        ? priceNode.getAttribute(SIDEBAR_USD_VALUE_ATTR)
        : null;
    var usdValue = Number(storedUsdValueRaw);

    if (!Number.isFinite(usdValue)) {
      usdValue = parseUsdAmount(storedUsdText || existingText);
      if (Number.isFinite(usdValue) && typeof priceNode.setAttribute === "function") {
        priceNode.setAttribute(SIDEBAR_USD_VALUE_ATTR, String(usdValue));
      }
    }

    var normalizedContext = normalizeCurrencyContext(currencyContext);

    if (
      normalizedContext.selectedCurrency === "USD" ||
      !Number.isFinite(normalizedContext.rate) ||
      normalizedContext.rate <= 0
    ) {
      if (storedUsdText) {
        priceNode.textContent = storedUsdText;
      }
      return true;
    }

    if (!Number.isFinite(usdValue)) {
      return false;
    }

    var convertedText = formatCurrencyByCode(usdValue * normalizedContext.rate, normalizedContext.selectedCurrency);
    if (convertedText === "N/A") {
      return false;
    }

    priceNode.textContent = convertedText + " (" + (storedUsdText || formatCurrency(usdValue)) + ")";
    return true;
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

    var heading = doc.createElement("h2");
    heading.className = "grailed-plus-panel__title";
    heading.textContent = "Grailed Plus";
    panel.appendChild(heading);

    if (statusMessage) {
      panel.appendChild(createRow(doc, "Status", statusMessage, "grailed-plus__row--status"));
    }

    var historyText;
    if (Array.isArray(listing.priceDrops) && listing.priceDrops.length > 0) {
      historyText = listing.priceDrops
        .map(function (value) {
          return formatMoney(Number(value), currencyContext);
        })
        .join(", ");
      historyText += " (total drops: " + listing.priceDrops.length + ")";
    } else {
      historyText = "No price drops on record";
    }

    panel.appendChild(createRow(doc, "Price History", historyText));

    var avgText = "N/A";
    if (Number.isFinite(metrics.avgDropPercent) && Number.isFinite(metrics.avgDropAmount)) {
      avgText = String(metrics.avgDropPercent) + "% (" + formatMoney(metrics.avgDropAmount, currencyContext) + ")";
    }

    var avgClass = "";
    if (metrics.avgDropPercent === 10 && Array.isArray(listing.priceDrops) && listing.priceDrops.length > 2) {
      avgClass = "grailed-plus__row--alert";
    }

    panel.appendChild(createRow(doc, "Avg. Price Drop", avgText, avgClass));
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
    removeExistingPanels: removeExistingPanels,
    renderPanel: renderPanel,
    formatCurrency: formatCurrency,
    formatMoney: formatMoney
  };
});
