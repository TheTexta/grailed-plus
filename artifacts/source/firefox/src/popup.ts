(function () {
  "use strict";

  var Settings = (globalThis as any).GrailedPlusSettings;

  function setStatus(node: any, message: string): void {
    if (!node) {
      return;
    }
    node.textContent = message || "";
  }

  function getRuntime(): any {
    if (typeof browser !== "undefined" && browser && browser.runtime) {
      return browser.runtime as any;
    }

    if (typeof chrome !== "undefined" && chrome && chrome.runtime) {
      return chrome.runtime as any;
    }

    return null;
  }

  function openOptionsPage(): void {
    var runtime = getRuntime();
    if (runtime && typeof runtime.openOptionsPage === "function") {
      runtime.openOptionsPage();
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
