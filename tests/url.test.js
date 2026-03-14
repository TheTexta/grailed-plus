"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { parseListingIdFromUrl, isListingPath } = require("../.tmp/ts-build/src/domain/url");

test("parseListingIdFromUrl handles canonical listing URL", () => {
  const input = "https://www.grailed.com/listings/21536148-gucci-gucci-apron-monogram-grail";
  assert.equal(parseListingIdFromUrl(input), "21536148");
});

test("parseListingIdFromUrl handles path-only slug", () => {
  const input = "/listings/99999-sample";
  assert.equal(parseListingIdFromUrl(input), "99999");
});

test("parseListingIdFromUrl handles numeric input", () => {
  assert.equal(parseListingIdFromUrl("1234"), "1234");
});

test("parseListingIdFromUrl returns null for invalid inputs", () => {
  assert.equal(parseListingIdFromUrl("https://www.grailed.com/designers/gucci"), null);
  assert.equal(parseListingIdFromUrl(""), null);
});

test("isListingPath identifies listing routes", () => {
  assert.equal(isListingPath("/listings/123-test"), true);
  assert.equal(isListingPath("/search"), false);
});
