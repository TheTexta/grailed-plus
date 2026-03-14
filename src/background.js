"use strict";
(function () {
    "use strict";
    var SEARCH_PREFIX = "https://www.depop.com/search/?q=";
    var API_SEARCH_PREFIX = "https://www.depop.com/api/v3/search/products/";
    var MESSAGE_TYPE = "grailed-plus:depop-search-fetch";
    var MESSAGE_VERSION = 1;
    function isObjectRecord(value) {
        return Boolean(value) && typeof value === "object";
    }
    function isAllowedSearchUrl(url) {
        return (typeof url === "string" &&
            (url.indexOf(SEARCH_PREFIX) === 0 || url.indexOf(API_SEARCH_PREFIX) === 0));
    }
    function isValidRequestMessage(message) {
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
    async function handleSearchFetch(message) {
        if (!isValidRequestMessage(message)) {
            return {
                ok: false,
                status: 400,
                text: "",
                error: "invalid_request"
            };
        }
        var url = message.url;
        try {
            var accept = typeof message.accept === "string" && message.accept.trim()
                ? message.accept.trim()
                : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
            if (accept.length > 256) {
                accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
            }
            var defaultLanguage = "en-US,en;q=0.9";
            var browserLanguage = typeof navigator !== "undefined" && navigator && typeof navigator.language === "string"
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
            }
            catch (_) {
                text = "";
            }
            return {
                ok: Boolean(response && response.ok),
                status: response ? Number(response.status) : 0,
                text: text,
                error: ""
            };
        }
        catch (error) {
            return {
                ok: false,
                status: 0,
                text: "",
                error: error && error.message ? String(error.message) : "fetch_failed"
            };
        }
    }
    function addListenerForChromeApi() {
        var runtime = typeof chrome !== "undefined" && chrome && chrome.runtime
            ? chrome.runtime
            : null;
        if (!runtime || !runtime.onMessage || typeof runtime.onMessage.addListener !== "function") {
            return;
        }
        runtime.onMessage.addListener(function (message, _sender, sendResponse) {
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