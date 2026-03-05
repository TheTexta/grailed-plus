(function () {
  "use strict";

  var Settings = globalThis.GrailedPlusSettings;
  var Currency = globalThis.GrailedPlusCurrency;

  var CURRENCY_LABELS = {
    USD: "USD - US Dollar",
    EUR: "EUR - Euro",
    GBP: "GBP - British Pound",
    CAD: "CAD - Canadian Dollar",
    AUD: "AUD - Australian Dollar",
    JPY: "JPY - Japanese Yen"
  };

  function normalizeCurrencyCode(input) {
    if (Settings && typeof Settings.normalizeCurrencyCode === "function") {
      return Settings.normalizeCurrencyCode(input);
    }

    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  function setStatus(node, tone, message) {
    if (!node) {
      return;
    }

    node.textContent = message || "";
    if (!tone) {
      if (typeof node.removeAttribute === "function") {
        node.removeAttribute("data-tone");
      }
      return;
    }

    if (typeof node.setAttribute === "function") {
      node.setAttribute("data-tone", tone);
    }
  }

  function loadSelectedCurrency() {
    if (!Settings || typeof Settings.getSelectedCurrency !== "function") {
      return Promise.resolve("USD");
    }

    return Settings.getSelectedCurrency().then(function (value) {
      return normalizeCurrencyCode(value) || "USD";
    });
  }

  function saveSelectedCurrency(code) {
    if (!Settings || typeof Settings.setSelectedCurrency !== "function") {
      return Promise.resolve({
        ok: false,
        error: "Settings module unavailable."
      });
    }

    return Settings.setSelectedCurrency(code);
  }

  function validateCustomCurrency(code) {
    if (!Currency || typeof Currency.getRates !== "function" || typeof Currency.hasCurrencyCode !== "function") {
      return Promise.resolve({
        ok: false,
        error: "Currency validation unavailable."
      });
    }

    return Currency.getRates("USD")
      .then(function (response) {
        var rates = response && response.rates ? response.rates : {};
        if (!Currency.hasCurrencyCode(code, rates)) {
          return {
            ok: false,
            error: "Code is not available in current USD exchange rates."
          };
        }

        return {
          ok: true
        };
      })
      .catch(function () {
        return {
          ok: false,
          error: "Unable to validate custom code right now."
        };
      });
  }

  function buildCuratedOptions(selectNode, curatedCurrencies) {
    if (!selectNode || typeof selectNode.appendChild !== "function") {
      return;
    }

    curatedCurrencies.forEach(function (code) {
      var option = document.createElement("option");
      option.value = code;
      option.textContent = CURRENCY_LABELS[code] || code;
      selectNode.appendChild(option);
    });

    var customOption = document.createElement("option");
    customOption.value = "CUSTOM";
    customOption.textContent = "Custom code";
    selectNode.appendChild(customOption);
  }

  function syncCustomInput(selectNode, customInputNode) {
    if (!selectNode || !customInputNode) {
      return;
    }

    var isCustom = selectNode.value === "CUSTOM";
    customInputNode.disabled = !isCustom;
    if (!isCustom) {
      customInputNode.value = "";
    }
  }

  function applySelection(selectNode, customInputNode, selectedCurrency, curatedSet) {
    if (!selectNode || !customInputNode) {
      return;
    }

    if (curatedSet[selectedCurrency]) {
      selectNode.value = selectedCurrency;
      customInputNode.value = "";
      customInputNode.disabled = true;
      return;
    }

    selectNode.value = "CUSTOM";
    customInputNode.value = selectedCurrency;
    customInputNode.disabled = false;
  }

  function init() {
    var form = document.getElementById("currency-form");
    var selectNode = document.getElementById("currency-select");
    var customInputNode = document.getElementById("currency-custom");
    var resetButton = document.getElementById("reset-button");
    var statusNode = document.getElementById("status");

    if (!form || !selectNode || !customInputNode || !resetButton || !statusNode) {
      return;
    }

    var curatedCurrencies =
      Settings && Array.isArray(Settings.CURATED_CURRENCIES) && Settings.CURATED_CURRENCIES.length > 0
        ? Settings.CURATED_CURRENCIES
        : ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

    var curatedSet = Object.create(null);
    curatedCurrencies.forEach(function (code) {
      curatedSet[code] = true;
    });

    buildCuratedOptions(selectNode, curatedCurrencies);

    loadSelectedCurrency().then(function (selectedCurrency) {
      applySelection(selectNode, customInputNode, selectedCurrency, curatedSet);
    });

    if (typeof selectNode.addEventListener === "function") {
      selectNode.addEventListener("change", function () {
        syncCustomInput(selectNode, customInputNode);
        setStatus(statusNode, null, "");
      });
    }

    if (typeof form.addEventListener === "function") {
      form.addEventListener("submit", function (event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }

        setStatus(statusNode, null, "");

        var targetCode = null;
        if (selectNode.value === "CUSTOM") {
          targetCode = normalizeCurrencyCode(customInputNode.value);
          if (!targetCode) {
            setStatus(statusNode, "error", "Custom code must be a valid 3-letter value.");
            return;
          }

          validateCustomCurrency(targetCode).then(function (validation) {
            if (!validation.ok) {
              setStatus(statusNode, "error", validation.error || "Invalid currency code.");
              return;
            }

            saveSelectedCurrency(targetCode).then(function (saved) {
              if (!saved.ok) {
                setStatus(statusNode, "error", saved.error || "Unable to save settings.");
                return;
              }
              setStatus(statusNode, "success", "Saved. Refresh open listing tabs to apply.");
            });
          });

          return;
        }

        targetCode = normalizeCurrencyCode(selectNode.value);
        if (!targetCode) {
          setStatus(statusNode, "error", "Please choose a valid currency.");
          return;
        }

        saveSelectedCurrency(targetCode).then(function (saved) {
          if (!saved.ok) {
            setStatus(statusNode, "error", saved.error || "Unable to save settings.");
            return;
          }
          setStatus(statusNode, "success", "Saved. Refresh open listing tabs to apply.");
        });
      });
    }

    if (typeof resetButton.addEventListener === "function") {
      resetButton.addEventListener("click", function () {
        saveSelectedCurrency("USD").then(function (saved) {
          if (!saved.ok) {
            setStatus(statusNode, "error", saved.error || "Unable to reset settings.");
            return;
          }

          applySelection(selectNode, customInputNode, "USD", curatedSet);
          setStatus(statusNode, "success", "Reset to USD. Refresh open listing tabs to apply.");
        });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
