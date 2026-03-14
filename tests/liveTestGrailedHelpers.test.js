"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

function createPageMock(options) {
  const selectorCounts = Object.assign({}, (options && options.selectorCounts) || {});
  const selectorClicks = [];
  const waits = [];
  const keyPresses = [];
  const mouseClicks = [];
  const viewport = (options && options.viewport) || { width: 1200, height: 900 };

  return {
    selectorClicks,
    waits,
    keyPresses,
    mouseClicks,
    locator(selector) {
      return {
        async count() {
          return Number(selectorCounts[selector] || 0);
        },
        first() {
          return {
            async click() {
              selectorClicks.push(selector);
              if (options && options.throwOnSelectorClick) {
                throw new Error("selector_click_failed");
              }
            }
          };
        }
      };
    },
    keyboard: {
      async press(key) {
        keyPresses.push(key);
        if (options && options.throwOnKeyboardPress) {
          throw new Error("keyboard_failed");
        }
      }
    },
    viewportSize() {
      return viewport;
    },
    mouse: {
      async click(x, y) {
        mouseClicks.push({ x, y });
        if (options && options.throwOnMouseClick) {
          throw new Error("mouse_failed");
        }
      }
    },
    async waitForTimeout(ms) {
      waits.push(ms);
    }
  };
}

test("dismissLoginModal attempts close selectors then Escape and corner clicks", async () => {
  const module = await import("../scripts/live-test-grailed.mjs");
  const page = createPageMock({
    selectorCounts: {
      '[data-testid="close-modal"]': 1,
      '[aria-label="Close"]': 1
    },
    viewport: { width: 1000, height: 700 }
  });

  await module.dismissLoginModal(page);

  assert.deepEqual(page.selectorClicks, ['[data-testid="close-modal"]', '[aria-label="Close"]']);
  assert.deepEqual(page.keyPresses, ["Escape"]);
  assert.deepEqual(page.mouseClicks, [
    { x: 8, y: 8 },
    { x: 992, y: 8 },
    { x: 8, y: 692 }
  ]);
});

test("dismissLoginModal remains best-effort when selector and keyboard actions fail", async () => {
  const module = await import("../scripts/live-test-grailed.mjs");
  const page = createPageMock({
    selectorCounts: {
      '[data-testid="close-modal"]': 1
    },
    throwOnSelectorClick: true,
    throwOnKeyboardPress: true
  });

  await module.dismissLoginModal(page);

  assert.equal(page.selectorClicks.length, 1);
  assert.deepEqual(page.keyPresses, ["Escape"]);
  assert.equal(page.mouseClicks.length, 3);
});
