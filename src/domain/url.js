(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusUrl = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function isNumericId(value) {
    return /^\d+$/.test(String(value || "").trim());
  }

  function normalizeToPath(input) {
    if (typeof input !== "string") {
      return "";
    }

    if (input.startsWith("http://") || input.startsWith("https://")) {
      try {
        return new URL(input).pathname;
      } catch (_) {
        return input;
      }
    }

    return input;
  }

  function parseListingIdFromUrl(input) {
    if (isNumericId(input)) {
      return String(input).trim();
    }

    var source = normalizeToPath(String(input || ""));
    var match = source.match(/\/listings\/(\d+)(?:[^\d]|$)/);
    if (match && match[1]) {
      return match[1];
    }

    return null;
  }

  function isListingPath(pathname) {
    if (typeof pathname !== "string") {
      return false;
    }
    return pathname.indexOf("/listings/") !== -1;
  }

  return {
    parseListingIdFromUrl: parseListingIdFromUrl,
    isListingPath: isListingPath
  };
});
