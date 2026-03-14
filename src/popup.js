"use strict";
(function () {
    "use strict";
    var Settings = globalThis.GrailedPlusSettings;
    function setStatus(node, message) {
        if (!node) {
            return;
        }
        node.textContent = message || "";
    }
    function openOptionsPage() {
        var chromeRuntime = typeof chrome !== "undefined" && chrome && chrome.runtime
            ? chrome.runtime
            : null;
        if (chromeRuntime && typeof chromeRuntime.openOptionsPage === "function") {
            chromeRuntime.openOptionsPage();
            return;
        }
        var browserRuntime = typeof browser !== "undefined" && browser && browser.runtime
            ? browser.runtime
            : null;
        if (browserRuntime &&
            typeof browserRuntime.openOptionsPage === "function") {
            browserRuntime.openOptionsPage();
        }
    }
    function init() {
        var statusNode = document.getElementById("popup-status");
        var openSettingsButton = document.getElementById("open-settings");
        if (!statusNode || !openSettingsButton) {
            return;
        }
        Promise.all([
            Settings && typeof Settings.getCurrencyConversionEnabled === "function"
                ? Settings.getCurrencyConversionEnabled()
                : Promise.resolve(false),
            Settings && typeof Settings.getSelectedCurrency === "function"
                ? Settings.getSelectedCurrency()
                : Promise.resolve("USD")
        ]).then(function (values) {
            var enabled = Boolean(values[0]);
            var currency = typeof values[1] === "string" ? values[1] : "USD";
            if (!enabled) {
                setStatus(statusNode, "Currency conversion is disabled by default.");
                return;
            }
            setStatus(statusNode, "Currency conversion is enabled: " + currency + ".");
        });
        if (typeof openSettingsButton.addEventListener === "function") {
            openSettingsButton.addEventListener("click", function () {
                openOptionsPage();
            });
        }
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    }
    else {
        init();
    }
})();