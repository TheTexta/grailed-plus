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

  function formatCurrency(value) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }
    return "$" + Math.round(value).toLocaleString("en-US");
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

  function findMountNode(doc) {
    if (!doc || typeof doc.querySelector !== "function") {
      return null;
    }

    var selectors = [
      '[data-testid="listing-price"]',
      '[data-testid*="price"]',
      '[class*="listing-price"]',
      '[class*="ListingPrice"]',
      '[class*="price"][class*="listing"]',
      'main h1'
    ];

    var i;
    var node;
    for (i = 0; i < selectors.length; i += 1) {
      node = doc.querySelector(selectors[i]);
      if (node) {
        return node;
      }
    }

    if (typeof doc.querySelectorAll === "function") {
      var ctaCandidates = doc.querySelectorAll("button, a");
      var cta;
      for (i = 0; i < ctaCandidates.length; i += 1) {
        cta = ctaCandidates[i];
        if (!cta || typeof cta.textContent !== "string") {
          continue;
        }
        if (/buy now|make offer|send offer/i.test(cta.textContent)) {
          if (typeof cta.closest === "function") {
            node = cta.closest("section, article, div");
            if (node) {
              return node;
            }
          }
          return cta;
        }
      }
    }

    return doc.querySelector("main") || doc.body || null;
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
    var rawListing = options && options.rawListing ? options.rawListing : null;
    var statusMessage = options && options.statusMessage ? String(options.statusMessage) : "";
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
          return formatCurrency(Number(value));
        })
        .join(", ");
      historyText += " (total drops: " + listing.priceDrops.length + ")";
    } else {
      historyText = "No price drops on record";
    }

    panel.appendChild(createRow(doc, "Price History", historyText));

    var avgText = "N/A";
    if (Number.isFinite(metrics.avgDropPercent) && Number.isFinite(metrics.avgDropAmount)) {
      avgText = String(metrics.avgDropPercent) + "% (" + formatCurrency(metrics.avgDropAmount) + ")";
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
      if (typeof mountNode.insertAdjacentElement === "function") {
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
    findMountNode: findMountNode,
    removeExistingPanels: removeExistingPanels,
    renderPanel: renderPanel,
    formatCurrency: formatCurrency
  };
});
