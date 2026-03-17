interface UUrlModule {
  parseListingIdFromUrl: (input: unknown) => string | null;
  isListingPath: (pathname: unknown) => boolean;
}

interface UGlobalRoot {
  GrailedPlusUrl?: UUrlModule;
}

(function (root: UGlobalRoot, factory: () => UUrlModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusUrl = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as UGlobalRoot) : {},
  function () {
    "use strict";

    function isNumericId(value: unknown): boolean {
      return /^\d+$/.test(String(value || "").trim());
    }

    function normalizeToPath(input: unknown): string {
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

    function parseListingIdFromUrl(input: unknown): string | null {
      if (isNumericId(input)) {
        return String(input).trim();
      }

      const source = normalizeToPath(String(input || ""));
      const match = source.match(/\/listings\/(\d+)(?:[^\d]|$)/);
      if (match && match[1]) {
        return match[1];
      }

      return null;
    }

    function isListingPath(pathname: unknown): boolean {
      if (typeof pathname !== "string") {
        return false;
      }
      return pathname.indexOf("/listings/") !== -1;
    }

    return {
      parseListingIdFromUrl,
      isListingPath
    };
  }
);
