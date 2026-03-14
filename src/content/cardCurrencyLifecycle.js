(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusCardCurrencyLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function isConversionContextEnabled(currencyContext, normalizeCurrencyCode) {
    var selectedCurrency =
      typeof normalizeCurrencyCode === "function"
        ? normalizeCurrencyCode(currencyContext && currencyContext.selectedCurrency)
        : null;
    var rate = Number(currencyContext && currencyContext.rate);
    return Boolean(selectedCurrency && selectedCurrency !== "USD" && Number.isFinite(rate) && rate > 0);
  }

  function isElementNode(node) {
    if (!node) {
      return false;
    }

    if (node.nodeType === 1) {
      return true;
    }

    return typeof node.querySelector === "function";
  }

  function nodeContainsCardPriceTarget(options) {
    var config = options && typeof options === "object" ? options : {};
    var node = config.node;
    var insightsPanel = config.insightsPanel;
    var selector = config.selector;

    if (!isElementNode(node)) {
      return false;
    }

    if (insightsPanel && typeof insightsPanel.nodeContainsCardPriceTarget === "function") {
      try {
        return Boolean(insightsPanel.nodeContainsCardPriceTarget(node));
      } catch (_) {
        // Fall through to local selector checks.
      }
    }

    if (typeof node.matches === "function") {
      if (node.matches(selector)) {
        return true;
      }
    }

    if (typeof node.querySelector === "function") {
      return Boolean(node.querySelector(selector));
    }

    return false;
  }

  function clearCardCurrencyTick(state) {
    if (!state || typeof state !== "object" || state.cardCurrencyTick == null) {
      return;
    }

    if (
      state.cardCurrencyTickUsesAnimationFrame &&
      typeof globalThis.cancelAnimationFrame === "function"
    ) {
      globalThis.cancelAnimationFrame(state.cardCurrencyTick);
    } else {
      clearTimeout(state.cardCurrencyTick);
    }

    state.cardCurrencyTick = null;
    state.cardCurrencyTickUsesAnimationFrame = false;
  }

  function disconnectCardCurrencyObserver(state) {
    if (!state || typeof state !== "object") {
      return;
    }

    if (state.cardCurrencyObserver && typeof state.cardCurrencyObserver.disconnect === "function") {
      state.cardCurrencyObserver.disconnect();
    }
    state.cardCurrencyObserver = null;
    state.cardCurrencyContext = null;
    clearCardCurrencyTick(state);
  }

  function scheduleCardCurrencyRefresh(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var onRefresh = typeof config.onRefresh === "function" ? config.onRefresh : function () {};

    if (!state || typeof state !== "object" || state.cardCurrencyTick != null) {
      return;
    }

    var run = function () {
      state.cardCurrencyTick = null;
      state.cardCurrencyTickUsesAnimationFrame = false;
      onRefresh();
    };

    if (typeof globalThis.requestAnimationFrame === "function") {
      state.cardCurrencyTickUsesAnimationFrame = true;
      state.cardCurrencyTick = globalThis.requestAnimationFrame(run);
      return;
    }

    state.cardCurrencyTickUsesAnimationFrame = false;
    state.cardCurrencyTick = globalThis.setTimeout(run, 16);
  }

  function setupCardCurrencyObserver(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var documentObj = config.documentObj;
    var selector = config.selector;
    var insightsPanel = config.insightsPanel;
    var onScheduleRefresh =
      typeof config.onScheduleRefresh === "function" ? config.onScheduleRefresh : function () {};

    if (!state || typeof state !== "object" || state.cardCurrencyObserver || typeof MutationObserver !== "function") {
      return;
    }

    var root = documentObj.body || documentObj.documentElement;
    if (!root) {
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      var i;
      var j;
      var mutation;
      var addedNode;
      var shouldRefresh = false;
      var mutationTarget;

      for (i = 0; i < mutations.length; i += 1) {
        mutation = mutations[i];
        if (!mutation) {
          continue;
        }

        mutationTarget = mutation.target || null;

        if (mutation.type === "characterData") {
          if (
            nodeContainsCardPriceTarget({
              node: mutationTarget && mutationTarget.parentNode,
              insightsPanel: insightsPanel,
              selector: selector
            })
          ) {
            shouldRefresh = true;
            break;
          }
          continue;
        }

        if (mutation.type !== "childList") {
          continue;
        }

        if (
          nodeContainsCardPriceTarget({
            node: mutationTarget,
            insightsPanel: insightsPanel,
            selector: selector
          })
        ) {
          shouldRefresh = true;
          break;
        }

        if (!mutation.addedNodes) {
          continue;
        }

        for (j = 0; j < mutation.addedNodes.length; j += 1) {
          addedNode = mutation.addedNodes[j];
          if (addedNode && addedNode.nodeType === 3) {
            if (
              nodeContainsCardPriceTarget({
                node: addedNode.parentNode,
                insightsPanel: insightsPanel,
                selector: selector
              })
            ) {
              shouldRefresh = true;
              break;
            }
            continue;
          }

          if (
            nodeContainsCardPriceTarget({
              node: addedNode,
              insightsPanel: insightsPanel,
              selector: selector
            })
          ) {
            shouldRefresh = true;
            break;
          }
        }

        if (shouldRefresh) {
          break;
        }
      }

      if (shouldRefresh) {
        onScheduleRefresh();
      }
    });

    observer.observe(root, {
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden", "data-testid"],
      characterData: true,
      subtree: true
    });

    state.cardCurrencyObserver = observer;
  }

  function syncCardCurrencyObserver(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var currencyContext = config.currencyContext;
    var createUsdCurrencyContext = config.createUsdCurrencyContext;
    var normalizeCurrencyCode = config.normalizeCurrencyCode;
    var onSetup = typeof config.onSetup === "function" ? config.onSetup : function () {};
    var onDisconnect =
      typeof config.onDisconnect === "function" ? config.onDisconnect : function () {};

    if (!state || typeof state !== "object") {
      return;
    }

    state.cardCurrencyContext =
      currencyContext ||
      (typeof createUsdCurrencyContext === "function" ? createUsdCurrencyContext() : null);

    if (!isConversionContextEnabled(state.cardCurrencyContext, normalizeCurrencyCode)) {
      onDisconnect();
      return;
    }

    onSetup();
  }

  return {
    isConversionContextEnabled: isConversionContextEnabled,
    nodeContainsCardPriceTarget: nodeContainsCardPriceTarget,
    clearCardCurrencyTick: clearCardCurrencyTick,
    disconnectCardCurrencyObserver: disconnectCardCurrencyObserver,
    scheduleCardCurrencyRefresh: scheduleCardCurrencyRefresh,
    setupCardCurrencyObserver: setupCardCurrencyObserver,
    syncCardCurrencyObserver: syncCardCurrencyObserver
  };
});
