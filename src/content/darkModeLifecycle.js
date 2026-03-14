(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusDarkModeLifecycle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalizeHexColor(input, settings) {
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

  function normalizeDarkModeBehavior(input, settings) {
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

    return trimmed;
  }

  function getSystemDarkModeQuery() {
    if (typeof globalThis.matchMedia !== "function") {
      return null;
    }

    try {
      return globalThis.matchMedia("(prefers-color-scheme: dark)");
    } catch (_) {
      return null;
    }
  }

  function getSystemPrefersDark() {
    var query = getSystemDarkModeQuery();
    return Boolean(query && query.matches);
  }

  function createDefaultDarkModeContext() {
    return {
      enabled: getSystemPrefersDark(),
      behavior: "system",
      primaryColor: "#000000"
    };
  }

  function resolveDarkModeContext(settings) {
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

    return Promise.all([enabledPromise, behaviorPromise, colorPromise])
      .then(function (values) {
        var configuredEnabled = Boolean(values[0]);
        var behavior = normalizeDarkModeBehavior(values[1], settings) || defaultContext.behavior;
        var primaryColor = normalizeHexColor(values[2], settings) || defaultContext.primaryColor;
        var enabled = configuredEnabled && (behavior === "permanent" ? true : getSystemPrefersDark());
        return {
          enabled: enabled,
          behavior: behavior,
          primaryColor: primaryColor
        };
      })
      .catch(function () {
        return defaultContext;
      });
  }

  function refreshDarkMode(options) {
    var config = options && typeof options === "object" ? options : {};
    var state = config.state;
    var settings = config.settings || null;
    var onApply = typeof config.onApply === "function" ? config.onApply : function () {};

    if (!state || typeof state !== "object") {
      return;
    }

    var darkModeToken = state.darkModeToken + 1;
    state.darkModeToken = darkModeToken;

    resolveDarkModeContext(settings).then(function (darkModeContext) {
      if (darkModeToken !== state.darkModeToken) {
        return;
      }
      onApply(darkModeContext);
    });
  }

  function setupDarkModeMediaListener(options) {
    var config = options && typeof options === "object" ? options : {};
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
