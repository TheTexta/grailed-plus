type DDarkModeBehavior = "system" | "permanent";

interface DDarkModeContext {
  enabled: boolean;
  behavior: DDarkModeBehavior;
  primaryColor: string;
  legacyColorCustomizationEnabled: boolean;
}

interface DSettingsLike {
  normalizeHexColor?: (input: unknown) => string | null;
  normalizeDarkModeBehavior?: (input: unknown) => DDarkModeBehavior | null;
  getDarkModeEnabled?: () => Promise<boolean>;
  getDarkModeBehavior?: () => Promise<unknown>;
  getDarkModePrimaryColor?: () => Promise<unknown>;
  getDarkModeLegacyColorCustomizationEnabled?: () => Promise<unknown>;
}

interface DRefreshDarkModeOptions {
  state?: {
    darkModeToken: number;
  } | null;
  settings?: DSettingsLike | null;
  onApply?: ((darkModeContext: DDarkModeContext) => void) | null;
}

interface DDarkModeMediaQuery {
  matches?: boolean;
  addEventListener?: (eventName: string, callback: () => void) => void;
  addListener?: (callback: () => void) => void;
}

interface DSetupDarkModeMediaListenerOptions {
  state?: {
    darkModeMediaQuery: DDarkModeMediaQuery | null;
    darkModeMediaListener: (() => void) | null;
  } | null;
  onChange?: (() => void) | null;
}

interface DDarkModeLifecycleModule {
  normalizeHexColor: (input: unknown, settings?: DSettingsLike | null) => string | null;
  normalizeDarkModeBehavior: (
    input: unknown,
    settings?: DSettingsLike | null
  ) => DDarkModeBehavior | null;
  getSystemDarkModeQuery: () => DDarkModeMediaQuery | null;
  getSystemPrefersDark: () => boolean;
  createDefaultDarkModeContext: () => DDarkModeContext;
  resolveDarkModeContext: (settings?: DSettingsLike | null) => Promise<DDarkModeContext>;
  refreshDarkMode: (options: DRefreshDarkModeOptions | null | undefined) => void;
  setupDarkModeMediaListener: (
    options: DSetupDarkModeMediaListenerOptions | null | undefined
  ) => void;
}

interface DDarkModeGlobal {
  GrailedPlusDarkModeLifecycle?: DDarkModeLifecycleModule;
}

(function (root: DDarkModeGlobal, factory: () => DDarkModeLifecycleModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusDarkModeLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as DDarkModeGlobal) : {}, function () {
  "use strict";

  function normalizeHexColor(input: unknown, settings?: DSettingsLike | null): string | null {
    if (settings && typeof settings.normalizeHexColor === "function") {
      return settings.normalizeHexColor(input);
    }

    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    var shortMatch = trimmed.match(/^#?([0-9a-fA-F]{3})$/);
    if (shortMatch && shortMatch[1]) {
      var shortHex = shortMatch[1].toUpperCase();
      return (
        "#" +
        shortHex.charAt(0) +
        shortHex.charAt(0) +
        shortHex.charAt(1) +
        shortHex.charAt(1) +
        shortHex.charAt(2) +
        shortHex.charAt(2)
      );
    }

    var longMatch = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
    if (longMatch && longMatch[1]) {
      return "#" + longMatch[1].toUpperCase();
    }

    return null;
  }

  function normalizeDarkModeBehavior(
    input: unknown,
    settings?: DSettingsLike | null
  ): DDarkModeBehavior | null {
    if (settings && typeof settings.normalizeDarkModeBehavior === "function") {
      return settings.normalizeDarkModeBehavior(input);
    }

    if (typeof input !== "string") {
      return null;
    }

    var trimmed = input.trim().toLowerCase();
    if (trimmed !== "system" && trimmed !== "permanent") {
      return null;
    }

    return trimmed as DDarkModeBehavior;
  }

  function getSystemDarkModeQuery(): DDarkModeMediaQuery | null {
    if (typeof globalThis.matchMedia !== "function") {
      return null;
    }

    try {
      return globalThis.matchMedia("(prefers-color-scheme: dark)") as DDarkModeMediaQuery;
    } catch (_) {
      return null;
    }
  }

  function getSystemPrefersDark(): boolean {
    var query = getSystemDarkModeQuery();
    return Boolean(query && query.matches);
  }

  function createDefaultDarkModeContext(): DDarkModeContext {
    return {
      enabled: getSystemPrefersDark(),
      behavior: "system",
      primaryColor: "#000000",
      legacyColorCustomizationEnabled: false
    };
  }

  function resolveDarkModeContext(settings?: DSettingsLike | null): Promise<DDarkModeContext> {
    var defaultContext = createDefaultDarkModeContext();
    if (!settings) {
      return Promise.resolve(defaultContext);
    }

    var enabledPromise =
      typeof settings.getDarkModeEnabled === "function"
        ? settings.getDarkModeEnabled()
        : Promise.resolve(defaultContext.enabled);
    var behaviorPromise =
      typeof settings.getDarkModeBehavior === "function"
        ? settings.getDarkModeBehavior()
        : Promise.resolve(defaultContext.behavior);
    var colorPromise =
      typeof settings.getDarkModePrimaryColor === "function"
        ? settings.getDarkModePrimaryColor()
        : Promise.resolve(defaultContext.primaryColor);
    var legacyColorCustomizationPromise =
      typeof settings.getDarkModeLegacyColorCustomizationEnabled === "function"
        ? settings.getDarkModeLegacyColorCustomizationEnabled()
        : Promise.resolve(defaultContext.legacyColorCustomizationEnabled);

    return Promise.all([
      enabledPromise,
      behaviorPromise,
      colorPromise,
      legacyColorCustomizationPromise
    ])
      .then(function (values) {
        var configuredEnabled = Boolean(values[0]);
        var behavior = normalizeDarkModeBehavior(values[1], settings) || defaultContext.behavior;
        var primaryColor = normalizeHexColor(values[2], settings) || defaultContext.primaryColor;
        var legacyColorCustomizationEnabled =
          typeof values[3] === "boolean"
            ? values[3]
            : defaultContext.legacyColorCustomizationEnabled;
        var enabled = configuredEnabled && (behavior === "permanent" ? true : getSystemPrefersDark());
        return {
          enabled: enabled,
          behavior: behavior,
          primaryColor: primaryColor,
          legacyColorCustomizationEnabled: legacyColorCustomizationEnabled
        };
      })
      .catch(function () {
        return defaultContext;
      });
  }

  function refreshDarkMode(options: DRefreshDarkModeOptions | null | undefined): void {
    var config = options && typeof options === "object" ? options : ({} as DRefreshDarkModeOptions);
    var state = config.state;
    var settings = config.settings || null;
    var onApply = typeof config.onApply === "function" ? config.onApply : function () {};

    if (!state || typeof state !== "object") {
      return;
    }

    var darkModeToken = state.darkModeToken + 1;
    state.darkModeToken = darkModeToken;
    var safeState = state;

    resolveDarkModeContext(settings).then(function (darkModeContext) {
      if (darkModeToken !== safeState.darkModeToken) {
        return;
      }
      onApply(darkModeContext);
    });
  }

  function setupDarkModeMediaListener(
    options: DSetupDarkModeMediaListenerOptions | null | undefined
  ): void {
    var config =
      options && typeof options === "object" ? options : ({} as DSetupDarkModeMediaListenerOptions);
    var state = config.state;
    var onChange = typeof config.onChange === "function" ? config.onChange : function () {};

    if (!state || typeof state !== "object" || state.darkModeMediaQuery) {
      return;
    }

    var query = getSystemDarkModeQuery();
    if (!query) {
      return;
    }

    var listener = function () {
      onChange();
    };

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", listener);
    } else if (typeof query.addListener === "function") {
      query.addListener(listener);
    } else {
      return;
    }

    state.darkModeMediaQuery = query;
    state.darkModeMediaListener = listener;
  }

  return {
    normalizeHexColor: normalizeHexColor,
    normalizeDarkModeBehavior: normalizeDarkModeBehavior,
    getSystemDarkModeQuery: getSystemDarkModeQuery,
    getSystemPrefersDark: getSystemPrefersDark,
    createDefaultDarkModeContext: createDefaultDarkModeContext,
    resolveDarkModeContext: resolveDarkModeContext,
    refreshDarkMode: refreshDarkMode,
    setupDarkModeMediaListener: setupDarkModeMediaListener
  };
});
