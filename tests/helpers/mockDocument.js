"use strict";

class MockElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.children = [];
    this.attributes = {};
    this.className = "";
    this.textContent = "";
    this.nextSibling = null;
    this._listeners = {};
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.push(child);
    this._syncSiblingPointers();
    return child;
  }

  insertBefore(child, referenceNode) {
    if (!referenceNode) {
      return this.appendChild(child);
    }

    const index = this.children.indexOf(referenceNode);
    if (index === -1) {
      return this.appendChild(child);
    }

    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }

    child.parentNode = this;
    this.children.splice(index, 0, child);
    this._syncSiblingPointers();
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index === -1) {
      return child;
    }

    this.children.splice(index, 1);
    child.parentNode = null;
    this._syncSiblingPointers();
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "class") {
      this.className = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  addEventListener(type, callback) {
    this._listeners[type] = callback;
  }

  insertAdjacentElement(position, element) {
    if (position !== "afterend") {
      throw new Error("MockElement only supports afterend insertions");
    }

    if (!this.parentNode) {
      return null;
    }

    const parent = this.parentNode;
    const thisIndex = parent.children.indexOf(this);
    if (thisIndex === -1) {
      return parent.appendChild(element);
    }

    const refNode = parent.children[thisIndex + 1] || null;
    return parent.insertBefore(element, refNode);
  }

  _syncSiblingPointers() {
    let i;
    for (i = 0; i < this.children.length; i += 1) {
      this.children[i].nextSibling = this.children[i + 1] || null;
    }
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement("body", this);
    this._ids = Object.create(null);
  }

  createElement(tagName) {
    return new MockElement(tagName, this);
  }

  getElementById(id) {
    return this._ids[id] || null;
  }

  registerElementById(id, element) {
    this._ids[id] = element;
  }

  querySelectorAll(selector) {
    if (selector === '[data-grailed-plus-panel="1"]') {
      return this._collect((node) => node.attributes["data-grailed-plus-panel"] === "1");
    }
    if (selector === ".grailed-plus-panel") {
      return this._collect((node) =>
        typeof node.className === "string" && node.className.split(/\s+/).includes("grailed-plus-panel")
      );
    }
    return [];
  }

  querySelector(selector) {
    const results = this.querySelectorAll(selector);
    return results.length > 0 ? results[0] : null;
  }

  _collect(predicate) {
    const matches = [];

    function walk(node) {
      if (predicate(node)) {
        matches.push(node);
      }
      node.children.forEach(walk);
    }

    walk(this.body);
    return matches;
  }
}

function flattenText(node) {
  let output = node.textContent || "";
  node.children.forEach((child) => {
    output += flattenText(child);
  });
  return output;
}

module.exports = {
  MockDocument,
  MockElement,
  flattenText
};
