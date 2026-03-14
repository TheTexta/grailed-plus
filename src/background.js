(function () {
  "use strict";

  var SEARCH_PREFIX = "https://www.depop.com/search/?q=";
  var API_SEARCH_PREFIX = "https://www.depop.com/api/v3/search/products/";
  var MESSAGE_TYPE = "grailed-plus:depop-search-fetch";

  function isAllowedSearchUrl(url) {
    return (
      typeof url === "string" &&
      (url.indexOf(SEARCH_PREFIX) === 0 || url.indexOf(API_SEARCH_PREFIX) === 0)
    );
  }

  async function handleSearchFetch(message) {
    var url = message && message.url;
    if (!isAllowedSearchUrl(url)) {
      return {
        ok: false,
        status: 400,
        text: "",
        error: "invalid_url"
      };
    }

    try {
      var accept =
        message && typeof message.accept === "string" && message.accept.trim()
          ? message.accept.trim()
          : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
      var defaultLanguage = "en-US,en;q=0.9";
      var browserLanguage =
        typeof navigator !== "undefined" && navigator && typeof navigator.language === "string"
          ? navigator.language
          : "";
      var acceptLanguage = browserLanguage
        ? browserLanguage + "," + defaultLanguage
        : defaultLanguage;

      var response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        redirect: "follow",
        headers: {
          Accept: accept,
          "Accept-Language": acceptLanguage
        }
      });

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
    } catch (error) {
      return {
        ok: false,
        status: 0,
        text: "",
        error: error && error.message ? String(error.message) : "fetch_failed"
      };
    }
  }

  function addListenerForChromeApi() {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.onMessage) {
      return;
    }

    chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
      if (!message || message.type !== MESSAGE_TYPE) {
        return false;
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
