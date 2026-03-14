(function () {
  "use strict";

  var SEARCH_PREFIX = "https://www.depop.com/search/?q=";
  var API_SEARCH_PREFIX = "https://www.depop.com/api/v3/search/products/";
  var MESSAGE_TYPE = "grailed-plus:depop-search-fetch";
  var MESSAGE_VERSION = 1;
  var DEFAULT_FETCH_TIMEOUT_MS = 20000;
  var FETCH_TIMEOUT_OVERRIDE_KEY = "__grailedPlusBackgroundFetchTimeoutMs";
  var GRAILED_URL_REGEX = /^https:\/\/([a-z0-9-]+\.)?grailed\.com\//i;

  function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object";
  }

  function isAllowedSearchUrl(url: unknown): boolean {
    return (
      typeof url === "string" &&
      (url.indexOf(SEARCH_PREFIX) === 0 || url.indexOf(API_SEARCH_PREFIX) === 0)
    );
  }

  function isValidRequestMessage(message: unknown): message is {
    type: string;
    url: string;
    accept?: string;
    v?: number;
  } {
    if (!isObjectRecord(message)) {
      return false;
    }

    if (message.type !== MESSAGE_TYPE) {
      return false;
    }

    if (!isAllowedSearchUrl(message.url)) {
      return false;
    }

    if (message.v != null && Number(message.v) !== MESSAGE_VERSION) {
      return false;
    }

    if (message.accept != null && typeof message.accept !== "string") {
      return false;
    }

    return true;
  }

  function resolveFetchTimeoutMs(): number {
    var globalObj = typeof globalThis !== "undefined" ? (globalThis as Record<string, unknown>) : null;
    var override = globalObj ? Number(globalObj[FETCH_TIMEOUT_OVERRIDE_KEY]) : NaN;
    if (Number.isFinite(override) && override > 0) {
      return Math.max(100, Math.floor(override));
    }
    return DEFAULT_FETCH_TIMEOUT_MS;
  }

  function getSenderUrl(sender: unknown): string {
    if (!isObjectRecord(sender)) {
      return "";
    }

    if (isObjectRecord(sender.tab) && typeof sender.tab.url === "string") {
      return sender.tab.url;
    }

    return typeof sender.url === "string" ? sender.url : "";
  }

  function isAllowedSender(sender: unknown): boolean {
    var senderUrl = getSenderUrl(sender);
    return Boolean(senderUrl && GRAILED_URL_REGEX.test(senderUrl));
  }

  async function handleSearchFetch(message: any): Promise<{
    ok: boolean;
    status: number;
    text: string;
    error: string;
  }> {
    if (!isValidRequestMessage(message)) {
      return {
        ok: false,
        status: 400,
        text: "",
        error: "invalid_request"
      };
    }

    var url = message.url;
    var timeoutMs = resolveFetchTimeoutMs();

    try {
      var accept =
        typeof message.accept === "string" && message.accept.trim()
          ? message.accept.trim()
          : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
      if (accept.length > 256) {
        accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
      }
      var defaultLanguage = "en-US,en;q=0.9";
      var browserLanguage =
        typeof navigator !== "undefined" && navigator && typeof navigator.language === "string"
          ? navigator.language
          : "";
      var acceptLanguage = browserLanguage
        ? browserLanguage + "," + defaultLanguage
        : defaultLanguage;

      var abortController = typeof AbortController === "function" ? new AbortController() : null;
      var timeoutId =
        abortController && typeof setTimeout === "function"
          ? setTimeout(function () {
              if (abortController) {
                try {
                  abortController.abort();
                } catch (_) {
                  // Ignore abort failures.
                }
              }
            }, timeoutMs)
          : null;

      var response;
      try {
        response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          redirect: "follow",
          headers: {
            Accept: accept,
            "Accept-Language": acceptLanguage
          },
          signal: abortController ? abortController.signal : undefined
        });
      } finally {
        if (timeoutId != null && typeof clearTimeout === "function") {
          clearTimeout(timeoutId);
        }
      }

      var text = "";
      try {
        text = await response.text();
      } catch (_) {
        text = "";
      }

      return {
        ok: Boolean(response && response.ok),
        status: response ? Number(response.status) : 0,
        text: text,
        error: ""
      };
    } catch (error: any) {
      if (error && error.name === "AbortError") {
        return {
          ok: false,
          status: 0,
          text: "",
          error: "timeout"
        };
      }

      return {
        ok: false,
        status: 0,
        text: "",
        error: error && error.message ? String(error.message) : "fetch_failed"
      };
    }
  }

  function addListenerForChromeApi(): void {
    var runtime =
      typeof chrome !== "undefined" && chrome && chrome.runtime
        ? (chrome.runtime as any)
        : null;

    if (!runtime || !runtime.onMessage || typeof runtime.onMessage.addListener !== "function") {
      return;
    }

    runtime.onMessage.addListener(function (message: any, sender: unknown, sendResponse: (value: any) => void) {
      if (!message || message.type !== MESSAGE_TYPE) {
        return false;
      }

      if (!isAllowedSender(sender)) {
        sendResponse({
          ok: false,
          status: 400,
          text: "",
          error: "invalid_request"
        });
        return true;
      }

      handleSearchFetch(message)
        .then(function (result) {
          sendResponse(result);
        })
        .catch(function () {
          sendResponse({
            ok: false,
            status: 0,
            text: "",
            error: "handler_failed"
          });
        });

      return true;
    });
  }

  addListenerForChromeApi();
})();
