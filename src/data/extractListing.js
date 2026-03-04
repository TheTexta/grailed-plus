(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusExtractListing = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var Adapter = null;
  if (typeof globalThis !== "undefined" && globalThis.GrailedPlusListingAdapter) {
    Adapter = globalThis.GrailedPlusListingAdapter;
  }
  if (!Adapter && typeof require === "function") {
    try {
      Adapter = require("./listingAdapter.js");
    } catch (_) {
      Adapter = null;
    }
  }

  function safeParseJson(text) {
    if (!text || typeof text !== "string") {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function readNextDataFromDocument(doc) {
    if (!doc || typeof doc.getElementById !== "function") {
      return null;
    }

    var node = doc.getElementById("__NEXT_DATA__");
    if (!node || !node.textContent) {
      return null;
    }

    return safeParseJson(node.textContent);
  }

  function extractListing(rawNextData) {
    if (Adapter && typeof Adapter.fromNextData === "function") {
      return Adapter.fromNextData(rawNextData);
    }

    // Fallback defaults if the adapter module fails to load.
    return {
      id: null,
      title: "",
      priceDrops: [],
      createdAt: null,
      priceUpdatedAt: null,
      seller: {
        createdAt: null
      },
      prettyPath: null,
      sold: false,
      rawListing: null,
      sourceStatus: "adapter_unavailable"
    };
  }

  return {
    readNextDataFromDocument: readNextDataFromDocument,
    extractListing: extractListing
  };
});
