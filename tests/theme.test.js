"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ROOT_ATTR,
  ROOT_ATTR_VALUE,
  CUSTOM_COLOR_ATTR,
  CUSTOM_COLOR_ATTR_VALUE,
  NEXT_ROOT_ATTR,
  NEXT_ROOT_ATTR_VALUE,
  PRIMARY_COLOR_VAR,
  PRIMARY_COLOR_USER_VAR,
  PRIMARY_COLOR_SAFE_VAR,
  PRIMARY_COLOR_SAFE_RGB_VAR,
  normalizeDarkModeContext,
  applyDarkModeToDocument
} = require("../src/ui/theme.js");

function createRootNode() {
  const attributes = Object.create(null);
  const styleState = Object.create(null);

  return {
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    getAttribute(name) {
      return attributes[name];
    },
    removeAttribute(name) {
      delete attributes[name];
    },
    style: {
      setProperty(name, value) {
        styleState[name] = String(value);
      },
      removeProperty(name) {
        delete styleState[name];
      },
      getPropertyValue(name) {
        return styleState[name] || "";
      }
    }
  };
}

test("normalizeDarkModeContext normalizes enabled flag and hex color", () => {
  assert.deepEqual(normalizeDarkModeContext({ enabled: true, primaryColor: "#0f0" }), {
    enabled: true,
    primaryColor: "#00FF00",
    customColorEnabled: true
  });

  assert.deepEqual(normalizeDarkModeContext({ enabled: 1, primaryColor: "invalid" }), {
    enabled: true,
    primaryColor: "#000000",
    customColorEnabled: false
  });
});

test("applyDarkModeToDocument applies root attribute and primary color variables", () => {
  const root = createRootNode();
  const nextRoot = {};
  const doc = {
    documentElement: root,
    getElementById(id) {
      return id === "__next" ? nextRoot : null;
    }
  };

  const applied = applyDarkModeToDocument(doc, {
    enabled: true,
    primaryColor: "#123456"
  });

  assert.equal(applied, true);
  assert.equal(root.getAttribute(ROOT_ATTR), ROOT_ATTR_VALUE);
  assert.equal(root.getAttribute(CUSTOM_COLOR_ATTR), CUSTOM_COLOR_ATTR_VALUE);
  assert.equal(root.getAttribute(NEXT_ROOT_ATTR), NEXT_ROOT_ATTR_VALUE);
  assert.equal(root.style.getPropertyValue(PRIMARY_COLOR_USER_VAR), "#123456");
  assert.equal(root.style.getPropertyValue(PRIMARY_COLOR_VAR), "#FFFFFF");
  assert.equal(root.style.getPropertyValue(PRIMARY_COLOR_SAFE_VAR), "#4CA5FF");
  assert.equal(root.style.getPropertyValue(PRIMARY_COLOR_SAFE_RGB_VAR), "76, 165, 255");
});

test("applyDarkModeToDocument does not mark custom color for default color", () => {
  const root = createRootNode();
  const doc = {
    documentElement: root
  };

  const applied = applyDarkModeToDocument(doc, {
    enabled: true,
    primaryColor: "#000000"
  });

  assert.equal(applied, true);
  assert.equal(root.getAttribute(ROOT_ATTR), ROOT_ATTR_VALUE);
  assert.equal(root.getAttribute(CUSTOM_COLOR_ATTR), undefined);
  assert.equal(root.getAttribute(NEXT_ROOT_ATTR), undefined);
});

test("applyDarkModeToDocument clears root state when disabled", () => {
  const root = createRootNode();
  const doc = {
    documentElement: root
  };

  applyDarkModeToDocument(doc, {
    enabled: true,
    primaryColor: "#ABCDEF"
  });

  const applied = applyDarkModeToDocument(doc, {
    enabled: false,
    primaryColor: "#ABCDEF"
  });

  assert.equal(applied, false);
  assert.equal(root.getAttribute(ROOT_ATTR), undefined);
  assert.equal(root.getAttribute(CUSTOM_COLOR_ATTR), undefined);
  assert.equal(root.getAttribute(NEXT_ROOT_ATTR), undefined);
  assert.equal(root.style.getPropertyValue(PRIMARY_COLOR_USER_VAR), "");
  assert.equal(root.style.getPropertyValue(PRIMARY_COLOR_VAR), "");
  assert.equal(root.style.getPropertyValue(PRIMARY_COLOR_SAFE_VAR), "");
  assert.equal(root.style.getPropertyValue(PRIMARY_COLOR_SAFE_RGB_VAR), "");
});

test("applyDarkModeToDocument returns false when no root node exists", () => {
  const applied = applyDarkModeToDocument({}, { enabled: true, primaryColor: "#000000" });
  assert.equal(applied, false);
});
