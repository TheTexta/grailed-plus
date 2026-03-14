interface TThemeContext {
  enabled?: unknown;
  primaryColor?: unknown;
}

interface TNormalizedThemeContext {
  enabled: boolean;
  primaryColor: string;
  customColorEnabled: boolean;
  blackBaseEnabled: boolean;
}

interface TThemeModule {
  DEFAULT_DARK_MODE_ENABLED: boolean;
  DEFAULT_DARK_MODE_PRIMARY_COLOR: string;
  ROOT_ATTR: string;
  ROOT_ATTR_VALUE: string;
  CUSTOM_COLOR_ATTR: string;
  CUSTOM_COLOR_ATTR_VALUE: string;
  BLACK_BASE_ATTR: string;
  BLACK_BASE_ATTR_VALUE: string;
  NEXT_ROOT_ATTR: string;
  NEXT_ROOT_ATTR_VALUE: string;
  PRIMARY_COLOR_VAR: string;
  PRIMARY_COLOR_USER_VAR: string;
  PRIMARY_COLOR_SAFE_VAR: string;
  PRIMARY_COLOR_SAFE_RGB_VAR: string;
  normalizeHexColor: (input: unknown) => string | null;
  normalizeDarkModeContext: (context: unknown) => TNormalizedThemeContext;
  applyDarkModeToDocument: (doc: unknown, context: unknown) => boolean;
}

interface TThemeGlobalRoot {
  GrailedPlusTheme?: TThemeModule;
}

type TThemeNode = {
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
  style?: {
    setProperty?: (key: string, value: string) => void;
    removeProperty?: (key: string) => void;
  };
} | null;

(function (root: TThemeGlobalRoot, factory: () => TThemeModule) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusTheme = factory();
  }
})(typeof globalThis !== "undefined" ? (globalThis as unknown as TThemeGlobalRoot) : {}, function () {
  "use strict";

  var DEFAULT_DARK_MODE_ENABLED = true;
  var DEFAULT_DARK_MODE_PRIMARY_COLOR = "#000000";
  var DEFAULT_DARK_MODE_BASE_TONE = "#FFFFFF";
  var ROOT_ATTR = "data-grailed-plus-dark-mode";
  var ROOT_ATTR_VALUE = "1";
  var CUSTOM_COLOR_ATTR = "data-grailed-plus-custom-color";
  var CUSTOM_COLOR_ATTR_VALUE = "1";
  var BLACK_BASE_ATTR = "data-grailed-plus-black-base";
  var BLACK_BASE_ATTR_VALUE = "1";
  var NEXT_ROOT_ATTR = "data-grailed-plus-next-root";
  var NEXT_ROOT_ATTR_VALUE = "1";
  var PRIMARY_COLOR_VAR = "--gp-dm-primary";
  var PRIMARY_COLOR_USER_VAR = "--gp-dm-primary-user";
  var PRIMARY_COLOR_SAFE_VAR = "--gp-dm-primary-safe";
  var PRIMARY_COLOR_SAFE_RGB_VAR = "--gp-dm-primary-safe-rgb";
  var DARK_MODE_TINT_SATURATION = 1;
  var DARK_MODE_TINT_LIGHTNESS = 0.35;

  function normalizeHexColor(input: unknown): string | null {
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

  function toHexChannel(value: number): string {
    var hex = value.toString(16).toUpperCase();
    return hex.length === 1 ? "0" + hex : hex;
  }

  function clampUnit(value: number): number {
    if (value < 0) {
      return 0;
    }
    if (value > 1) {
      return 1;
    }
    return value;
  }

  function rgbToHsl(red: number, green: number, blue: number): { h: number; s: number; l: number } {
    var r = red / 255;
    var g = green / 255;
    var b = blue / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var hue = 0;
    var saturation = 0;
    var lightness = (max + min) / 2;

    if (max !== min) {
      var diff = max - min;
      saturation = lightness > 0.5 ? diff / (2 - max - min) : diff / (max + min);

      if (max === r) {
        hue = (g - b) / diff + (g < b ? 6 : 0);
      } else if (max === g) {
        hue = (b - r) / diff + 2;
      } else {
        hue = (r - g) / diff + 4;
      }

      hue = hue / 6;
    }

    return {
      h: hue,
      s: saturation,
      l: lightness
    };
  }

  function hueToRgb(p: number, q: number, t: number): number {
    var temp = t;
    if (temp < 0) {
      temp += 1;
    }
    if (temp > 1) {
      temp -= 1;
    }
    if (temp < 1 / 6) {
      return p + (q - p) * 6 * temp;
    }
    if (temp < 1 / 2) {
      return q;
    }
    if (temp < 2 / 3) {
      return p + (q - p) * (2 / 3 - temp) * 6;
    }
    return p;
  }

  function hslToRgb(hue: number, saturation: number, lightness: number): { r: number; g: number; b: number } {
    var h = hue;
    var s = clampUnit(saturation);
    var l = clampUnit(lightness);
    var red;
    var green;
    var blue;

    if (s === 0) {
      red = l;
      green = l;
      blue = l;
    } else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      red = hueToRgb(p, q, h + 1 / 3);
      green = hueToRgb(p, q, h);
      blue = hueToRgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(red * 255),
      g: Math.round(green * 255),
      b: Math.round(blue * 255)
    };
  }

  function rotateHexHue(normalizedHex: unknown, degrees: number): string | null {
    var normalized = normalizeHexColor(normalizedHex);
    if (!normalized) {
      return null;
    }

    var red = parseInt(normalized.slice(1, 3), 16);
    var green = parseInt(normalized.slice(3, 5), 16);
    var blue = parseInt(normalized.slice(5, 7), 16);
    var hsl = rgbToHsl(red, green, blue);
    var normalizedDegrees = ((degrees % 360) + 360) % 360;
    var hue = (hsl.h + normalizedDegrees / 360) % 1;
    var rotated = hslToRgb(hue, hsl.s, hsl.l);

    return "#" + toHexChannel(rotated.r) + toHexChannel(rotated.g) + toHexChannel(rotated.b);
  }

  function lockHexToHueOnly(normalizedHex: unknown): string | null {
    var normalized = normalizeHexColor(normalizedHex);
    if (!normalized) {
      return null;
    }

    var red = parseInt(normalized.slice(1, 3), 16);
    var green = parseInt(normalized.slice(3, 5), 16);
    var blue = parseInt(normalized.slice(5, 7), 16);
    var hsl = rgbToHsl(red, green, blue);
    var locked = hslToRgb(hsl.h, DARK_MODE_TINT_SATURATION, DARK_MODE_TINT_LIGHTNESS);

    return "#" + toHexChannel(locked.r) + toHexChannel(locked.g) + toHexChannel(locked.b);
  }

  function invertHexColor(normalizedHex: unknown): string | null {
    var normalized = normalizeHexColor(normalizedHex);
    if (!normalized) {
      return null;
    }

    var red = 255 - parseInt(normalized.slice(1, 3), 16);
    var green = 255 - parseInt(normalized.slice(3, 5), 16);
    var blue = 255 - parseInt(normalized.slice(5, 7), 16);
    return "#" + toHexChannel(red) + toHexChannel(green) + toHexChannel(blue);
  }

  function hexToRgbChannels(normalizedHex: unknown): string | null {
    var normalized = normalizeHexColor(normalizedHex);
    if (!normalized) {
      return null;
    }

    var red = parseInt(normalized.slice(1, 3), 16);
    var green = parseInt(normalized.slice(3, 5), 16);
    var blue = parseInt(normalized.slice(5, 7), 16);
    return red + ", " + green + ", " + blue;
  }

  function normalizeDarkModeContext(context: unknown): TNormalizedThemeContext {
    var typedContext = context && typeof context === "object" ? (context as TThemeContext) : null;
    var normalizedPrimary = normalizeHexColor(typedContext && typedContext.primaryColor);
    var primaryColor = normalizedPrimary || DEFAULT_DARK_MODE_PRIMARY_COLOR;
    return {
      enabled: Boolean(typedContext && typedContext.enabled),
      primaryColor: primaryColor,
      customColorEnabled: primaryColor !== DEFAULT_DARK_MODE_PRIMARY_COLOR,
      blackBaseEnabled: primaryColor === DEFAULT_DARK_MODE_PRIMARY_COLOR
    };
  }

  function setAttribute(node: TThemeNode, name: string, value: string): void {
    if (!node || typeof node.setAttribute !== "function") {
      return;
    }
    node.setAttribute(name, value);
  }

  function removeAttribute(node: TThemeNode, name: string): void {
    if (!node) {
      return;
    }
    if (typeof node.removeAttribute === "function") {
      node.removeAttribute(name);
      return;
    }
    if (typeof node.setAttribute === "function") {
      node.setAttribute(name, "");
    }
  }

  function setCssVar(node: TThemeNode, key: string, value: string): void {
    if (!node || !node.style || typeof node.style.setProperty !== "function") {
      return;
    }
    node.style.setProperty(key, value);
  }

  function removeCssVar(node: TThemeNode, key: string): void {
    if (!node || !node.style) {
      return;
    }
    if (typeof node.style.removeProperty === "function") {
      node.style.removeProperty(key);
      return;
    }
    if (typeof node.style.setProperty === "function") {
      node.style.setProperty(key, "");
    }
  }

  function resolveRootNode(doc: unknown): TThemeNode {
    if (!doc) {
      return null;
    }
    var typedDoc = doc as { documentElement?: unknown; body?: unknown };
    return (typedDoc.documentElement as TThemeNode) || (typedDoc.body as TThemeNode) || null;
  }

  function hasNextRoot(doc: unknown): boolean {
    if (!doc || typeof (doc as { getElementById?: unknown }).getElementById !== "function") {
      return false;
    }

    return Boolean((doc as { getElementById: (id: string) => unknown }).getElementById("__next"));
  }

  function applyDarkModeToDocument(doc: unknown, context: unknown): boolean {
    var rootNode = resolveRootNode(doc);
    if (!rootNode) {
      return false;
    }

    var normalizedContext = normalizeDarkModeContext(context);
    if (!normalizedContext.enabled) {
      removeAttribute(rootNode, ROOT_ATTR);
      removeAttribute(rootNode, CUSTOM_COLOR_ATTR);
      removeAttribute(rootNode, BLACK_BASE_ATTR);
      removeAttribute(rootNode, NEXT_ROOT_ATTR);
      removeCssVar(rootNode, PRIMARY_COLOR_VAR);
      removeCssVar(rootNode, PRIMARY_COLOR_USER_VAR);
      removeCssVar(rootNode, PRIMARY_COLOR_SAFE_VAR);
      removeCssVar(rootNode, PRIMARY_COLOR_SAFE_RGB_VAR);
      return false;
    }

    setAttribute(rootNode, ROOT_ATTR, ROOT_ATTR_VALUE);
    if (normalizedContext.customColorEnabled) {
      setAttribute(rootNode, CUSTOM_COLOR_ATTR, CUSTOM_COLOR_ATTR_VALUE);
    } else {
      removeAttribute(rootNode, CUSTOM_COLOR_ATTR);
    }
    if (normalizedContext.blackBaseEnabled) {
      setAttribute(rootNode, BLACK_BASE_ATTR, BLACK_BASE_ATTR_VALUE);
    } else {
      removeAttribute(rootNode, BLACK_BASE_ATTR);
    }
    if (hasNextRoot(doc)) {
      setAttribute(rootNode, NEXT_ROOT_ATTR, NEXT_ROOT_ATTR_VALUE);
    } else {
      removeAttribute(rootNode, NEXT_ROOT_ATTR);
    }
    setCssVar(rootNode, PRIMARY_COLOR_USER_VAR, normalizedContext.primaryColor);
    var hueOnlyColor = lockHexToHueOnly(normalizedContext.primaryColor) || normalizedContext.primaryColor;
    // Body uses "invert(1) hue-rotate(180deg)", so pre-transform custom color accordingly.
    var hueRotatedColor = rotateHexHue(hueOnlyColor, 180) || hueOnlyColor;
    var safeColor = invertHexColor(hueRotatedColor) || DEFAULT_DARK_MODE_BASE_TONE;
    var safeColorRgb = hexToRgbChannels(safeColor) || "255, 255, 255";
    setCssVar(rootNode, PRIMARY_COLOR_SAFE_VAR, safeColor);
    setCssVar(rootNode, PRIMARY_COLOR_SAFE_RGB_VAR, safeColorRgb);
    // Keep base tone stable; custom color is applied through targeted gradient accents.
    setCssVar(rootNode, PRIMARY_COLOR_VAR, DEFAULT_DARK_MODE_BASE_TONE);
    return true;
  }

  return {
    DEFAULT_DARK_MODE_ENABLED: DEFAULT_DARK_MODE_ENABLED,
    DEFAULT_DARK_MODE_PRIMARY_COLOR: DEFAULT_DARK_MODE_PRIMARY_COLOR,
    ROOT_ATTR: ROOT_ATTR,
    ROOT_ATTR_VALUE: ROOT_ATTR_VALUE,
    CUSTOM_COLOR_ATTR: CUSTOM_COLOR_ATTR,
    CUSTOM_COLOR_ATTR_VALUE: CUSTOM_COLOR_ATTR_VALUE,
    BLACK_BASE_ATTR: BLACK_BASE_ATTR,
    BLACK_BASE_ATTR_VALUE: BLACK_BASE_ATTR_VALUE,
    NEXT_ROOT_ATTR: NEXT_ROOT_ATTR,
    NEXT_ROOT_ATTR_VALUE: NEXT_ROOT_ATTR_VALUE,
    PRIMARY_COLOR_VAR: PRIMARY_COLOR_VAR,
    PRIMARY_COLOR_USER_VAR: PRIMARY_COLOR_USER_VAR,
    PRIMARY_COLOR_SAFE_VAR: PRIMARY_COLOR_SAFE_VAR,
    PRIMARY_COLOR_SAFE_RGB_VAR: PRIMARY_COLOR_SAFE_RGB_VAR,
    normalizeHexColor: normalizeHexColor,
    normalizeDarkModeContext: normalizeDarkModeContext,
    applyDarkModeToDocument: applyDarkModeToDocument
  };
});
