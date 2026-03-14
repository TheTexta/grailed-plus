(function () {
  "use strict";

  var Settings = (globalThis as any).GrailedPlusSettings;

  function setStatus(node: any, message: string): void {
    if (!node) {
      return;
    }
    node.textContent = message || "";
  }

  function openOptionsPage(): void {
    var chromeRuntime =
      typeof chrome !== "undefined" && chrome && chrome.runtime
        ? (chrome.runtime as any)
        : null;
    if (chromeRuntime && typeof chromeRuntime.openOptionsPage === "function") {
      chromeRuntime.openOptionsPage();
      return;
    }

    var browserRuntime =
      typeof browser !== "undefined" && browser && browser.runtime
        ? (browser.runtime as any)
        : null;
    if (
      browserRuntime &&
      typeof browserRuntime.openOptionsPage === "function"
    ) {
      browserRuntime.openOptionsPage();
    }
  }

  function init(): void {
    var statusNode = document.getElementById("popup-status") as any;
    var openSettingsButton = document.getElementById("open-settings") as any;

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
    ]).then(function (values: any[]) {
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
