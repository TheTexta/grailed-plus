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

  function loadConversionEnabled() {
    if (!Settings || typeof Settings.getCurrencyConversionEnabled !== "function") {
      return Promise.resolve(false);
    }

    return Settings.getCurrencyConversionEnabled().then(function (value) {
      return Boolean(value);
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

  function saveConversionEnabled(enabled) {
    if (!Settings || typeof Settings.setCurrencyConversionEnabled !== "function") {
      return Promise.resolve({
        ok: false,
        error: "Settings module unavailable."
      });
    }

    return Settings.setCurrencyConversionEnabled(Boolean(enabled));
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

  function syncCurrencyInputs(selectNode, customInputNode, isEnabled) {
    if (!selectNode || !customInputNode) {
      return;
    }

    selectNode.disabled = !isEnabled;
    var isCustom = selectNode.value === "CUSTOM";
    customInputNode.disabled = !isEnabled || !isCustom;
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
      return;
    }

    selectNode.value = "CUSTOM";
    customInputNode.value = selectedCurrency;
  }

  function init() {
    var form = document.getElementById("currency-form");
    var enabledNode = document.getElementById("conversion-enabled");
    var selectNode = document.getElementById("currency-select");
    var customInputNode = document.getElementById("currency-custom");
    var resetButton = document.getElementById("reset-button");
    var statusNode = document.getElementById("status");

    if (!form || !enabledNode || !selectNode || !customInputNode || !resetButton || !statusNode) {
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

    Promise.all([loadSelectedCurrency(), loadConversionEnabled()]).then(function (values) {
      var selectedCurrency = values[0];
      var enabled = values[1];

      applySelection(selectNode, customInputNode, selectedCurrency, curatedSet);
      enabledNode.checked = enabled;
      syncCurrencyInputs(selectNode, customInputNode, enabled);
    });

    if (typeof selectNode.addEventListener === "function") {
      selectNode.addEventListener("change", function () {
        syncCurrencyInputs(selectNode, customInputNode, enabledNode.checked);
        setStatus(statusNode, null, "");
      });
    }

    if (typeof enabledNode.addEventListener === "function") {
      enabledNode.addEventListener("change", function () {
        syncCurrencyInputs(selectNode, customInputNode, enabledNode.checked);
        setStatus(statusNode, null, "");
      });
    }

    if (typeof form.addEventListener === "function") {
      form.addEventListener("submit", function (event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }

        setStatus(statusNode, null, "");

        var conversionEnabled = Boolean(enabledNode.checked);
        var usingCustom = selectNode.value === "CUSTOM";
        var targetCode = null;

        if (usingCustom) {
          targetCode = normalizeCurrencyCode(customInputNode.value);
          if (!targetCode) {
            setStatus(statusNode, "error", "Custom code must be a valid 3-letter value.");
            return;
          }
        } else {
          targetCode = normalizeCurrencyCode(selectNode.value);
          if (!targetCode) {
            setStatus(statusNode, "error", "Please choose a valid currency.");
            return;
          }
        }

        var validationPromise = Promise.resolve({ ok: true });
        if (usingCustom && conversionEnabled) {
          validationPromise = validateCustomCurrency(targetCode);
        }

        validationPromise
          .then(function (validation) {
            if (!validation.ok) {
              setStatus(statusNode, "error", validation.error || "Invalid currency code.");
              return Promise.reject(new Error("validation_failed"));
            }

            return saveSelectedCurrency(targetCode).then(function (savedCurrency) {
              if (!savedCurrency.ok) {
                setStatus(statusNode, "error", savedCurrency.error || "Unable to save settings.");
                return Promise.reject(new Error("save_currency_failed"));
              }

              return saveConversionEnabled(conversionEnabled).then(function (savedEnabled) {
                if (!savedEnabled.ok) {
                  setStatus(statusNode, "error", savedEnabled.error || "Unable to save settings.");
                  return Promise.reject(new Error("save_enabled_failed"));
                }

                if (!conversionEnabled) {
                  setStatus(statusNode, "success", "Saved. Currency conversion is currently disabled.");
                  return;
                }

                setStatus(statusNode, "success", "Saved. Refresh open listing tabs to apply.");
              });
            });
          })
          .catch(function () {
            // Errors are handled with status updates above.
          });
      });
    }

    if (typeof resetButton.addEventListener === "function") {
      resetButton.addEventListener("click", function () {
        Promise.all([saveSelectedCurrency("USD"), saveConversionEnabled(false)]).then(function (results) {
          var savedCurrency = results[0];
          var savedEnabled = results[1];

          if (!savedCurrency.ok || !savedEnabled.ok) {
            setStatus(statusNode, "error", "Unable to reset settings.");
            return;
          }

          enabledNode.checked = false;
          applySelection(selectNode, customInputNode, "USD", curatedSet);
          syncCurrencyInputs(selectNode, customInputNode, false);
          setStatus(statusNode, "success", "Reset to defaults (conversion disabled, currency USD).");
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
