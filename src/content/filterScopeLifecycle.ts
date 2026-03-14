interface FThemeLike {
  [key: string]: string | undefined;
}

interface FFilterScopeState {
  filterScopeTick: number | ReturnType<typeof setTimeout> | null;
  filterScopeDelayTimers: Array<ReturnType<typeof setTimeout>>;
  filterScopeObserver: MutationObserver | null;
}

interface FDarkModeRootState {
  rootNode: HTMLElement | null;
  bodyNode: HTMLElement | null;
  nextRoot: HTMLElement | null;
  enabled: boolean;
  mode: string;
  filterRoot: HTMLElement | null;
}

interface FClearFilterOptions {
  documentObj?: Document | null;
  filterTargetAttr?: string;
  filterScopeSkipAttr?: string;
}

interface FGetDarkModeRootStateOptions {
  documentObj: Document;
  theme?: FThemeLike | null;
}

interface FMarkFilterTargetsOptions {
  headerSelector: string;
  menuSelector: string;
  filterTargetAttr: string;
  filterTargetAttrValue: string;
  filterScopeSkipAttr: string;
  filterScopeSkipAttrValue: string;
}

interface FRefreshFilterTargetsOptions extends FClearFilterOptions {
  theme?: FThemeLike | null;
  headerSelector?: string;
  menuSelector?: string;
  filterTargetAttrValue?: string;
  filterScopeSkipAttrValue?: string;
}

interface FScheduleFilterTargetsRefreshOptions {
  state?: FFilterScopeState | null;
  onRefresh?: (() => void) | null;
}

interface FScheduleFilterTargetsRefreshBurstOptions {
  state?: FFilterScopeState | null;
  delays?: number[];
  onScheduleRefresh?: (() => void) | null;
}

interface FSetupFilterScopeObserverOptions {
  state?: FFilterScopeState | null;
  documentObj?: Document | null;
  onScheduleRefresh?: (() => void) | null;
}

interface FSyncFilterScopeObserverOptions {
  enabled?: boolean;
  onSetup?: (() => void) | null;
  onDisconnect?: (() => void) | null;
}

interface FFilterScopeLifecycleModule {
  getThemeAttrOrFallback: (theme: FThemeLike | null | undefined, key: string, fallback: string) => string;
  clearFilterTargets: (options: FClearFilterOptions | null | undefined) => void;
  getDarkModeRootState: (options: FGetDarkModeRootStateOptions | null | undefined) => FDarkModeRootState;
  refreshFilterTargets: (options: FRefreshFilterTargetsOptions | null | undefined) => void;
  scheduleFilterTargetsRefresh: (
    options: FScheduleFilterTargetsRefreshOptions | null | undefined
  ) => void;
  clearFilterTargetsRefreshDelayTimers: (state: FFilterScopeState | null | undefined) => void;
  scheduleFilterTargetsRefreshBurst: (
    options: FScheduleFilterTargetsRefreshBurstOptions | null | undefined
  ) => void;
  setupFilterScopeObserver: (options: FSetupFilterScopeObserverOptions | null | undefined) => void;
  disconnectFilterScopeObserver: (state: FFilterScopeState | null | undefined) => void;
  syncFilterScopeObserver: (options: FSyncFilterScopeObserverOptions | null | undefined) => void;
}

interface FFilterScopeGlobal {
  GrailedPlusFilterScopeLifecycle?: FFilterScopeLifecycleModule;
}

(function (root: FFilterScopeGlobal, factory: () => FFilterScopeLifecycleModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusFilterScopeLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as FFilterScopeGlobal) : {}, function () {
  "use strict";

  function getThemeAttrOrFallback(
    theme: FThemeLike | null | undefined,
    key: string,
    fallback: string
  ): string {
    if (!theme || typeof theme !== "object") {
      return fallback;
    }
    return theme[key] || fallback;
  }

  function clearFilterTargets(options: FClearFilterOptions | null | undefined): void {
    var config = options && typeof options === "object" ? options : ({} as FClearFilterOptions);
    var documentObj = config.documentObj;
    var filterTargetAttr = config.filterTargetAttr;
    var filterScopeSkipAttr = config.filterScopeSkipAttr;

    if (
      !documentObj ||
      typeof documentObj.querySelectorAll !== "function" ||
      typeof filterTargetAttr !== "string" ||
      typeof filterScopeSkipAttr !== "string"
    ) {
      return;
    }

    var nodes = documentObj.querySelectorAll("[" + filterTargetAttr + "],[" + filterScopeSkipAttr + "]");
    var i;
    var node;

    for (i = 0; i < nodes.length; i += 1) {
      node = nodes[i];
      if (typeof (node as Element).removeAttribute === "function") {
        (node as Element).removeAttribute(filterTargetAttr);
        (node as Element).removeAttribute(filterScopeSkipAttr);
      }
    }
  }

  function getDarkModeRootState(
    options: FGetDarkModeRootStateOptions | null | undefined
  ): FDarkModeRootState {
    var config = options && typeof options === "object" ? options : ({} as FGetDarkModeRootStateOptions);
    var documentObj = config.documentObj;
    var theme = config.theme;

    if (!documentObj) {
      return {
        rootNode: null,
        bodyNode: null,
        nextRoot: null,
        enabled: false,
        mode: "none",
        filterRoot: null
      };
    }

    var rootNode = documentObj.documentElement || null;
    var bodyNode = documentObj.body || null;
    var nextRoot =
      typeof documentObj.getElementById === "function"
        ? (documentObj.getElementById("__next") as HTMLElement | null)
        : null;
    var rootAttr = getThemeAttrOrFallback(theme, "ROOT_ATTR", "data-grailed-plus-dark-mode");
    var nextRootAttr = getThemeAttrOrFallback(theme, "NEXT_ROOT_ATTR", "data-grailed-plus-next-root");
    var rootEnabled = Boolean(rootNode && rootNode.getAttribute(rootAttr) === "1");
    var nextRootEnabled = Boolean(rootNode && rootNode.getAttribute(nextRootAttr) === "1");
    var filterRoot: HTMLElement | null = null;
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

  function containsHeaderBoundary(
    node: Element | null,
    headerRoot: Element | null,
    headerSelector: string,
    menuSelector: string
  ): boolean {
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

  function isDirectHeaderBoundary(
    node: Element | null,
    headerRoot: Element | null,
    headerSelector: string,
    menuSelector: string
  ): boolean {
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

  function markFilterTargetsWithin(
    boundaryNode: Element | null,
    headerRoot: Element | null,
    depth: number,
    options: FMarkFilterTargetsOptions | null | undefined
  ): void {
    var config = options && typeof options === "object" ? options : ({} as FMarkFilterTargetsOptions);
    var headerSelector = config.headerSelector;
    var menuSelector = config.menuSelector;
    var filterTargetAttr = config.filterTargetAttr;
    var filterTargetAttrValue = config.filterTargetAttrValue;
    var filterScopeSkipAttr = config.filterScopeSkipAttr;
    var filterScopeSkipAttrValue = config.filterScopeSkipAttrValue;

    if (
      !boundaryNode ||
      !boundaryNode.children ||
      depth > 6 ||
      !headerSelector ||
      !menuSelector ||
      !filterTargetAttr ||
      !filterScopeSkipAttr
    ) {
      return;
    }

    var children = boundaryNode.children;
    var i;
    var child;
    var hasBoundary;
    var isDirectBoundary;

    for (i = 0; i < children.length; i += 1) {
      child = children[i] as Element;
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
        markFilterTargetsWithin(child, headerRoot, depth + 1, config);
        continue;
      }

      if (typeof child.setAttribute === "function") {
        child.setAttribute(filterTargetAttr, filterTargetAttrValue);
      }
    }
  }

  function refreshFilterTargets(options: FRefreshFilterTargetsOptions | null | undefined): void {
    var config = options && typeof options === "object" ? options : ({} as FRefreshFilterTargetsOptions);
    var documentObj = config.documentObj;
    var headerSelector = config.headerSelector;
    var menuSelector = config.menuSelector;

    clearFilterTargets(config);

    if (!documentObj || !headerSelector || !menuSelector) {
      return;
    }

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
      typeof filterRoot.querySelector === "function" ? filterRoot.querySelector(headerSelector) : null;
    var topChildren = filterRoot.children;
    var i;
    var topChild;
    var hasBoundary;

    for (i = 0; i < topChildren.length; i += 1) {
      topChild = topChildren[i] as Element;
      hasBoundary = containsHeaderBoundary(topChild, headerRoot as Element | null, headerSelector, menuSelector);

      if (hasBoundary) {
        if (typeof topChild.setAttribute === "function") {
          topChild.setAttribute(config.filterScopeSkipAttr || "", config.filterScopeSkipAttrValue || "1");
        }
        markFilterTargetsWithin(topChild, headerRoot as Element | null, 0, {
          headerSelector: headerSelector,
          menuSelector: menuSelector,
          filterTargetAttr: config.filterTargetAttr || "",
          filterTargetAttrValue: config.filterTargetAttrValue || "1",
          filterScopeSkipAttr: config.filterScopeSkipAttr || "",
          filterScopeSkipAttrValue: config.filterScopeSkipAttrValue || "1"
        });
        continue;
      }

      if (typeof topChild.setAttribute === "function") {
        topChild.setAttribute(config.filterTargetAttr || "", config.filterTargetAttrValue || "1");
      }
    }
  }

  function scheduleFilterTargetsRefresh(
    options: FScheduleFilterTargetsRefreshOptions | null | undefined
  ): void {
    var config = options && typeof options === "object" ? options : ({} as FScheduleFilterTargetsRefreshOptions);
    var state = config.state;
    var onRefresh = typeof config.onRefresh === "function" ? config.onRefresh : function () {};

    if (!state || typeof state !== "object" || state.filterScopeTick != null) {
      return;
    }

    var safeState = state;

    var run = function () {
      safeState.filterScopeTick = null;
      onRefresh();
    };

    if (typeof globalThis.requestAnimationFrame === "function") {
      safeState.filterScopeTick = globalThis.requestAnimationFrame(run);
      return;
    }

    safeState.filterScopeTick = globalThis.setTimeout(run, 16);
  }

  function clearFilterTargetsRefreshDelayTimers(state: FFilterScopeState | null | undefined): void {
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

  function scheduleFilterTargetsRefreshBurst(
    options: FScheduleFilterTargetsRefreshBurstOptions | null | undefined
  ): void {
    var config = options && typeof options === "object" ? options : ({} as FScheduleFilterTargetsRefreshBurstOptions);
    var state = config.state;
    var delays = Array.isArray(config.delays) ? config.delays : [];
    var onScheduleRefresh =
      typeof config.onScheduleRefresh === "function" ? config.onScheduleRefresh : function () {};

    if (!state || typeof state !== "object") {
      return;
    }

    var timers: Array<ReturnType<typeof setTimeout>> = [];
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

  function setupFilterScopeObserver(options: FSetupFilterScopeObserverOptions | null | undefined): void {
    var config = options && typeof options === "object" ? options : ({} as FSetupFilterScopeObserverOptions);
    var state = config.state;
    var documentObj = config.documentObj;
    var onScheduleRefresh =
      typeof config.onScheduleRefresh === "function" ? config.onScheduleRefresh : function () {};

    if (
      !state ||
      typeof state !== "object" ||
      state.filterScopeObserver ||
      typeof MutationObserver !== "function" ||
      !documentObj
    ) {
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

  function disconnectFilterScopeObserver(state: FFilterScopeState | null | undefined): void {
    if (!state || typeof state !== "object") {
      return;
    }

    if (state.filterScopeObserver && typeof state.filterScopeObserver.disconnect === "function") {
      state.filterScopeObserver.disconnect();
    }
    state.filterScopeObserver = null;
  }

  function syncFilterScopeObserver(options: FSyncFilterScopeObserverOptions | null | undefined): void {
    var config = options && typeof options === "object" ? options : ({} as FSyncFilterScopeObserverOptions);
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
