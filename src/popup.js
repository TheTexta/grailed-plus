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
    if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.openOptionsPage === "function") {
      chrome.runtime.openOptionsPage();
      return;
    }

    if (
      typeof browser !== "undefined" &&
      browser.runtime &&
      typeof browser.runtime.openOptionsPage === "function"
    ) {
      browser.runtime.openOptionsPage();
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
  } else {
    init();
  }
})();
