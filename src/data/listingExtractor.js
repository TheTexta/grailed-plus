(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusListingExtractor = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var ListingModel = null;
  if (typeof globalThis !== "undefined" && globalThis.GrailedPlusListingModel) {
    ListingModel = globalThis.GrailedPlusListingModel;
  }
  if (!ListingModel && typeof require === "function") {
    try {
      ListingModel = require("./listingModel.js");
    } catch (_) {
      ListingModel = null;
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
    if (ListingModel && typeof ListingModel.fromNextData === "function") {
      return ListingModel.fromNextData(rawNextData);
    }

    // Fallback defaults if the listing model module fails to load.
    return {
      id: null,
      title: "",
      createdAt: null,
      pricing: {
        history: [],
        updatedAt: null
      },
      seller: {
        createdAt: null
      },
      prettyPath: null,
      sold: false,
      rawListing: null,
      sourceStatus: "listing_model_unavailable"
    };
  }

  return {
    readNextDataFromDocument: readNextDataFromDocument,
    extractListing: extractListing
  };
});
