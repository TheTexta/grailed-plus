"use strict";

function getNodeClassName(node) {
  if (!node) {
    return "";
  }
  if (typeof node.className === "string") {
    return node.className;
  }
  if (node.attributes && typeof node.attributes.class === "string") {
    return node.attributes.class;
  }
  return "";
}

function getNodeAttribute(node, name) {
  if (!node || !name) {
    return "";
  }
  if (name === "class") {
    return getNodeClassName(node);
  }
  if (node.attributes && Object.prototype.hasOwnProperty.call(node.attributes, name)) {
    return String(node.attributes[name]);
  }
  return "";
}

function hasClassToken(node, token) {
  if (!token) {
    return false;
  }
  const classes = getNodeClassName(node)
    .split(/\s+/)
    .filter(Boolean);
  return classes.includes(token);
}

function matchesSimpleSelector(node, selector) {
  if (!node || !selector) {
    return false;
  }

  const trimmed = String(selector).trim();
  if (!trimmed) {
    return false;
  }

  const classSelectors = trimmed.match(/\.[A-Za-z0-9_-]+/g) || [];
  let i;
  for (i = 0; i < classSelectors.length; i += 1) {
    if (!hasClassToken(node, classSelectors[i].slice(1))) {
      return false;
    }
  }

  const attrPattern = /\[\s*([^\]\s~|^$*=]+)\s*(\*?=)?\s*(?:"([^"]*)"|'([^']*)'|([^\]]*))?\s*\]/g;
  let attrMatch = attrPattern.exec(trimmed);
  while (attrMatch) {
    const attrName = attrMatch[1];
    const operator = attrMatch[2] || "";
    const expected = attrMatch[3] || attrMatch[4] || attrMatch[5] || "";
    const actual = getNodeAttribute(node, attrName);

    if (operator === "=" && actual !== expected) {
      return false;
    }
    if (operator === "*=" && actual.indexOf(expected) === -1) {
      return false;
    }
    if (!operator && actual === "") {
      return false;
    }

    attrMatch = attrPattern.exec(trimmed);
  }

  const withoutClasses = trimmed.replace(/\.[A-Za-z0-9_-]+/g, "");
  const withoutAttrs = withoutClasses.replace(attrPattern, "").trim();
  if (withoutAttrs && withoutAttrs !== "*") {
    return node.tagName === withoutAttrs.toUpperCase();
  }

  return true;
}

function matchesSelectorSequence(node, selector) {
  const parts = String(selector)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return false;
  }

  if (!matchesSimpleSelector(node, parts[parts.length - 1])) {
    return false;
  }

  let currentAncestor = node.parentNode;
  let i;
  for (i = parts.length - 2; i >= 0; i -= 1) {
    while (currentAncestor && !matchesSimpleSelector(currentAncestor, parts[i])) {
      currentAncestor = currentAncestor.parentNode;
    }
    if (!currentAncestor) {
      return false;
    }
    currentAncestor = currentAncestor.parentNode;
  }

  return true;
}

function matchesSelector(node, selector) {
  if (!node || !selector) {
    return false;
  }

  const parts = String(selector)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  let i;
  for (i = 0; i < parts.length; i += 1) {
    if (matchesSelectorSequence(node, parts[i])) {
      return true;
    }
  }

  return false;
}

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

  removeAttribute(name) {
    if (!name) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(this.attributes, name)) {
      delete this.attributes[name];
    }

    if (name === "class") {
      this.className = "";
    }
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  addEventListener(type, callback) {
    this._listeners[type] = callback;
  }

  querySelectorAll(selector) {
    return this.ownerDocument._collectWithin(this, (node) => matchesSelector(node, selector), false);
  }

  querySelector(selector) {
    const results = this.querySelectorAll(selector);
    return results.length > 0 ? results[0] : null;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (matchesSelector(current, selector)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  compareDocumentPosition(other) {
    if (!other || this === other) {
      return 0;
    }

    const thisPath = this.ownerDocument._nodePath(this);
    const otherPath = this.ownerDocument._nodePath(other);

    if (!thisPath || !otherPath) {
      return 1;
    }

    const minLength = Math.min(thisPath.length, otherPath.length);
    let i;
    for (i = 0; i < minLength; i += 1) {
      if (thisPath[i] < otherPath[i]) {
        return 4;
      }
      if (thisPath[i] > otherPath[i]) {
        return 2;
      }
    }

    if (thisPath.length < otherPath.length) {
      return 4;
    }
    if (thisPath.length > otherPath.length) {
      return 2;
    }

    return 0;
  }

  insertAdjacentElement(position, element) {
    if (!this.parentNode) {
      return null;
    }

    const parent = this.parentNode;
    if (position === "beforebegin") {
      return parent.insertBefore(element, this);
    }

    if (position === "afterend") {
      const thisIndex = parent.children.indexOf(this);
      if (thisIndex === -1) {
        return parent.appendChild(element);
      }

      const refNode = parent.children[thisIndex + 1] || null;
      return parent.insertBefore(element, refNode);
    }

    throw new Error("MockElement only supports beforebegin and afterend insertions");
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
    return this._collectWithin(this.body, (node) => matchesSelector(node, selector), true);
  }

  querySelector(selector) {
    const results = this.querySelectorAll(selector);
    return results.length > 0 ? results[0] : null;
  }

  _collectWithin(root, predicate, includeRoot) {
    const matches = [];

    function walk(node, canMatch) {
      if (canMatch && predicate(node)) {
        matches.push(node);
      }
      node.children.forEach((child) => walk(child, true));
    }

    walk(root, includeRoot);
    return matches;
  }

  _nodePath(node) {
    if (!node) {
      return null;
    }

    const path = [];
    let current = node;
    while (current && current !== this.body) {
      if (!current.parentNode) {
        return null;
      }
      const index = current.parentNode.children.indexOf(current);
      if (index === -1) {
        return null;
      }
      path.unshift(index);
      current = current.parentNode;
    }

    if (current !== this.body) {
      return null;
    }

    return path;
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
