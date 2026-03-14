(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusFilterScopeLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function getThemeAttrOrFallback(theme, key, fallback) {
    if (!theme || typeof theme !== "object") {
      return fallback;
    }
    return theme[key] || fallback;
  }

  function clearFilterTargets(options) {
    var config = options && typeof options === "object" ? options : {};
    var documentObj = config.documentObj;
    var filterTargetAttr = config.filterTargetAttr;
    var filterScopeSkipAttr = config.filterScopeSkipAttr;

    if (!documentObj || typeof documentObj.querySelectorAll !== "function") {
      return;
    }

    var nodes = documentObj.querySelectorAll(
      "[" + filterTargetAttr + "],[" + filterScopeSkipAttr + "]"
    );
    var i;
    var node;

    for (i = 0; i < nodes.length; i += 1) {
      node = nodes[i];
      if (typeof node.removeAttribute === "function") {
        node.removeAttribute(filterTargetAttr);
        node.removeAttribute(filterScopeSkipAttr);
      }
    }
  }

  function getDarkModeRootState(options) {
    var config = options && typeof options === "object" ? options : {};
    var documentObj = config.documentObj;
    var theme = config.theme;

    var rootNode = documentObj.documentElement || null;
    var bodyNode = documentObj.body || null;
    var nextRoot =
      typeof documentObj.getElementById === "function"
        ? documentObj.getElementById("__next")
        : null;
    var rootAttr = getThemeAttrOrFallback(theme, "ROOT_ATTR", "data-grailed-plus-dark-mode");
    var nextRootAttr = getThemeAttrOrFallback(
      theme,
      "NEXT_ROOT_ATTR",
      "data-grailed-plus-next-root"
    );
    var rootEnabled = Boolean(rootNode && rootNode.getAttribute(rootAttr) === "1");
    var nextRootEnabled = Boolean(rootNode && rootNode.getAttribute(nextRootAttr) === "1");
    var filterRoot = null;
    var mode = "none";

    if (rootEnabled && nextRootEnabled && nextRoot) {
      filterRoot = nextRoot;
      mode = "next";
    } else if (rootEnabled && bodyNode) {
      filterRoot = bodyNode;
      mode = "legacy";
    }

    return {
      rootNode: rootNode,
      bodyNode: bodyNode,
      nextRoot: nextRoot,
      enabled: Boolean(filterRoot),
      mode: mode,
      filterRoot: filterRoot
    };
  }

  function containsHeaderBoundary(node, headerRoot, headerSelector, menuSelector) {
    if (!node) {
      return false;
    }

    if (headerRoot && node === headerRoot) {
      return true;
    }

    if (typeof node.matches === "function") {
      if (node.matches(headerSelector) || node.matches(menuSelector)) {
        return true;
      }
    }

    if (typeof node.querySelector === "function") {
      return Boolean(node.querySelector(headerSelector + ", " + menuSelector));
    }

    return false;
  }

  function isDirectHeaderBoundary(node, headerRoot, headerSelector, menuSelector) {
    if (!node) {
      return false;
    }

    if (headerRoot && node === headerRoot) {
      return true;
    }

    if (typeof node.matches !== "function") {
      return false;
    }

    return Boolean(node.matches(headerSelector) || node.matches(menuSelector));
  }

  function markFilterTargetsWithin(boundaryNode, headerRoot, depth, options) {
    var config = options && typeof options === "object" ? options : {};
    var headerSelector = config.headerSelector;
    var menuSelector = config.menuSelector;
    var filterTargetAttr = config.filterTargetAttr;
    var filterTargetAttrValue = config.filterTargetAttrValue;
    var filterScopeSkipAttr = config.filterScopeSkipAttr;
    var filterScopeSkipAttrValue = config.filterScopeSkipAttrValue;

    if (!boundaryNode || !boundaryNode.children || depth > 6) {
      return;
    }

    var children = boundaryNode.children;
    var i;
    var child;
    var hasBoundary;
    var isDirectBoundary;

    for (i = 0; i < children.length; i += 1) {
      child = children[i];
      isDirectBoundary = isDirectHeaderBoundary(child, headerRoot, headerSelector, menuSelector);

      if (isDirectBoundary) {
        if (typeof child.setAttribute === "function") {
          child.setAttribute(filterScopeSkipAttr, filterScopeSkipAttrValue);
        }
        continue;
      }

      hasBoundary = containsHeaderBoundary(child, headerRoot, headerSelector, menuSelector);

      if (hasBoundary) {
        if (typeof child.setAttribute === "function") {
          child.setAttribute(filterScopeSkipAttr, filterScopeSkipAttrValue);
        }
        markFilterTargetsWithin(child, headerRoot, depth + 1, options);
        continue;
      }

      if (typeof child.setAttribute === "function") {
        child.setAttribute(filterTargetAttr, filterTargetAttrValue);
      }
    }
  }

  function refreshFilterTargets(options) {
    var config = options && typeof options === "object" ? options : {};
    var documentObj = config.documentObj;
    var headerSelector = config.headerSelector;
    var menuSelector = config.menuSelector;

    clearFilterTargets(config);

    var modeState = getDarkModeRootState({
      documentObj: documentObj,
      theme: config.theme
    });

    if (!modeState.enabled) {
      return;
    }

    var filterRoot = modeState.filterRoot;
    if (!filterRoot || !filterRoot.children) {
      return;
    }

    var headerRoot =
      typeof filterRoot.querySelector === "function"
        ? filterRoot.querySelector(headerSelector)
        : null;
    var topChildren = filterRoot.children;
    var i;
    var topChild;
    var hasBoundary;

    for (i = 0; i < topChildren.length; i += 1) {
      topChild = topChildren[i];
      hasBoundary = containsHeaderBoundary(topChild, headerRoot, headerSelector, menuSelector);

      if (hasBoundary) {
        if (typeof topChild.setAttribute === "function") {
          topChild.setAttribute(config.filterScopeSkipAttr, config.filterScopeSkipAttrValue);
        }
        markFilterTargetsWithin(topChild, headerRoot, 0, config);
        continue;
      }

      if (typeof topChild.setAttribute === "function") {
        topChild.setAttribute(config.filterTargetAttr, config.filterTargetAttrValue);
      }
    }
  }

  function scheduleFilterTargetsRefresh(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var onRefresh = typeof config.onRefresh === "function" ? config.onRefresh : function () {};

    if (!state || typeof state !== "object" || state.filterScopeTick != null) {
      return;
    }

    var run = function () {
      state.filterScopeTick = null;
      onRefresh();
    };

    if (typeof globalThis.requestAnimationFrame === "function") {
      state.filterScopeTick = globalThis.requestAnimationFrame(run);
      return;
    }

    state.filterScopeTick = globalThis.setTimeout(run, 16);
  }

  function clearFilterTargetsRefreshDelayTimers(state) {
    if (!state || typeof state !== "object") {
      return;
    }

    var timers = state.filterScopeDelayTimers || [];
    var i;
    for (i = 0; i < timers.length; i += 1) {
      clearTimeout(timers[i]);
    }
    state.filterScopeDelayTimers = [];
  }

  function scheduleFilterTargetsRefreshBurst(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var delays = Array.isArray(config.delays) ? config.delays : [];
    var onScheduleRefresh =
      typeof config.onScheduleRefresh === "function" ? config.onScheduleRefresh : function () {};

    if (!state || typeof state !== "object") {
      return;
    }

    var timers = [];
    var i;
    var delayMs;

    clearFilterTargetsRefreshDelayTimers(state);
    onScheduleRefresh();

    for (i = 0; i < delays.length; i += 1) {
      delayMs = delays[i];
      timers.push(globalThis.setTimeout(onScheduleRefresh, delayMs));
    }

    state.filterScopeDelayTimers = timers;
  }

  function setupFilterScopeObserver(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var documentObj = config.documentObj;
    var onScheduleRefresh =
      typeof config.onScheduleRefresh === "function" ? config.onScheduleRefresh : function () {};

    if (!state || typeof state !== "object" || state.filterScopeObserver || typeof MutationObserver !== "function") {
      return;
    }

    var root = documentObj.body || documentObj.documentElement;
    if (!root) {
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      var i;
      var mutation;
      var shouldRefresh = false;

      for (i = 0; i < mutations.length; i += 1) {
        mutation = mutations[i];
        if (!mutation) {
          continue;
        }

        if (mutation.type === "childList") {
          if (
            (mutation.addedNodes && mutation.addedNodes.length > 0) ||
            (mutation.removedNodes && mutation.removedNodes.length > 0)
          ) {
            shouldRefresh = true;
            break;
          }
          continue;
        }

        if (mutation.type === "attributes") {
          shouldRefresh = true;
          break;
        }
      }

      if (shouldRefresh) {
        onScheduleRefresh();
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "id"]
    });

    state.filterScopeObserver = observer;
  }

  function disconnectFilterScopeObserver(state) {
    if (!state || typeof state !== "object") {
      return;
    }

    if (state.filterScopeObserver && typeof state.filterScopeObserver.disconnect === "function") {
      state.filterScopeObserver.disconnect();
    }
    state.filterScopeObserver = null;
  }

  function syncFilterScopeObserver(options) {
    var config = options && typeof options === "object" ? options : {};
    var enabled = Boolean(config.enabled);
    var onSetup = typeof config.onSetup === "function" ? config.onSetup : function () {};
    var onDisconnect =
      typeof config.onDisconnect === "function" ? config.onDisconnect : function () {};

    if (!enabled) {
      onDisconnect();
      return;
    }

    onSetup();
  }

  return {
    getThemeAttrOrFallback: getThemeAttrOrFallback,
    clearFilterTargets: clearFilterTargets,
    getDarkModeRootState: getDarkModeRootState,
    refreshFilterTargets: refreshFilterTargets,
    scheduleFilterTargetsRefresh: scheduleFilterTargetsRefresh,
    clearFilterTargetsRefreshDelayTimers: clearFilterTargetsRefreshDelayTimers,
    scheduleFilterTargetsRefreshBurst: scheduleFilterTargetsRefreshBurst,
    setupFilterScopeObserver: setupFilterScopeObserver,
    disconnectFilterScopeObserver: disconnectFilterScopeObserver,
    syncFilterScopeObserver: syncFilterScopeObserver
  };
});
