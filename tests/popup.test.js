"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { MockDocument } = require("./helpers/mockDocument");

function flushAsync() {
  return Promise.resolve().then(function () {
    return Promise.resolve();
  });
}

function createNode(doc, tagName, id) {
  const node = doc.createElement(tagName);
  if (id) {
    node.id = id;
    doc.registerElementById(id, node);
  }
  return node;
}

function createPopupDocument() {
  const doc = new MockDocument();
  doc.readyState = "complete";
  doc.addEventListener = function () {};

  const main = createNode(doc, "main");
  const status = createNode(doc, "p", "popup-status");
  const button = createNode(doc, "button", "open-settings");

  main.appendChild(status);
  main.appendChild(button);
  doc.body.appendChild(main);

  return {
    document: doc,
    nodes: {
      status,
      button
    }
  };
}

function loadPopupModule(documentObj, settings, browserRuntime, chromeRuntime) {
  const previousDocument = global.document;
  const previousSettings = global.GrailedPlusSettings;
  const previousBrowser = global.browser;
  const previousChrome = global.chrome;
  const modulePath = require.resolve("../.tmp/ts-build/src/popup");

  delete require.cache[modulePath];
  global.document = documentObj;
  global.GrailedPlusSettings = settings;
  global.browser = browserRuntime ? { runtime: browserRuntime } : undefined;
  global.chrome = chromeRuntime ? { runtime: chromeRuntime } : undefined;

  require(modulePath);

  return function cleanup() {
    delete require.cache[modulePath];
    global.document = previousDocument;
    global.GrailedPlusSettings = previousSettings;
    global.browser = previousBrowser;
    global.chrome = previousChrome;
  };
}

test("popup opens options page through browser.runtime when only browser exists", async () => {
  const { document, nodes } = createPopupDocument();
  let openOptionsPageCalls = 0;
  const cleanup = loadPopupModule(
    document,
    {
      getCurrencyConversionEnabled: () => Promise.resolve(false),
      getSelectedCurrency: () => Promise.resolve("USD")
    },
    {
      openOptionsPage() {
        openOptionsPageCalls += 1;
      }
    }
  );

  try {
    await flushAsync();

    assert.match(nodes.status.textContent, /disabled by default/i);
    assert.equal(typeof nodes.button._listeners.click, "function");

    nodes.button._listeners.click();

    assert.equal(openOptionsPageCalls, 1);
  } finally {
    cleanup();
  }
});
