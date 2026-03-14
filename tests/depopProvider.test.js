"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createDepopProvider, parseCandidates, mapHttpError } = require("../.tmp/ts-build/src/domain/depopProvider");

test("mapHttpError classifies common HTTP statuses", () => {
  assert.equal(mapHttpError(403).errorCode, "FORBIDDEN_OR_BLOCKED");
  assert.equal(mapHttpError(429).errorCode, "RATE_LIMITED");
  assert.equal(mapHttpError(502).errorCode, "NETWORK_ERROR");
});

test("parseCandidates extracts product info from JSON-LD", () => {
  const html = [
    "<html><head>",
    '<script type="application/ld+json">',
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      sku: "abc123",
      name: "Vintage Jacket",
      url: "https://www.depop.com/products/user-vintage-jacket/",
      image: "https://images.depop.test/jacket.jpg",
      offers: {
        price: "120",
        priceCurrency: "USD"
      }
    }),
    "</script>",
    "</head><body></body></html>"
  ].join("");

  const parsed = parseCandidates(html);
  assert.equal(parsed.parserMismatchLikely, false);
  assert.equal(parsed.candidates.length, 1);
  assert.equal(parsed.candidates[0].id, "abc123");
  assert.equal(parsed.candidates[0].price, 120);
});

test("parseCandidates keeps non-USD currency from JSON-LD label", () => {
  const html = [
    "<html><head>",
    '<script type=\"application/ld+json\">',
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      sku: "eur123",
      name: "Euro Jacket",
      url: "https://www.depop.com/products/user-euro-jacket/",
      image: "https://images.depop.test/eur.jpg",
      offers: {
        price: "95",
        priceCurrency: "EUR"
      }
    }),
    "</script>",
    "</head><body></body></html>"
  ].join("");

  const parsed = parseCandidates(html);
  assert.equal(parsed.candidates.length, 1);
  assert.equal(parsed.candidates[0].currency, "EUR");
  assert.equal(parsed.candidates[0].price, 95);
});

test("parseCandidates extracts product info from Next flight payload", () => {
  const flightData = JSON.stringify({
    state: {
      data: {
        pages: [
          {
            data: {
              products: [
                {
                  id: "nf-1",
                  title: "Flight Payload Jacket",
                  url: "https://www.depop.com/products/user-flight-payload-jacket/",
                  price: {
                    amount: 140,
                    currency: "USD"
                  },
                  pictures: [
                    {
                      url: "https://images.depop.test/flight.jpg"
                    }
                  ]
                }
              ],
              meta: {
                total_count: 1,
                result_count: 1
              }
            }
          }
        ]
      }
    }
  });

  const escaped = JSON.stringify(flightData).slice(1, -1);
  const html = [
    "<html><head></head><body>",
    `<script>self.__next_f.push([1, "${escaped}"])</script>`,
    "</body></html>"
  ].join("");

  const parsed = parseCandidates(html);
  assert.equal(parsed.parserMismatchLikely, false);
  assert.equal(parsed.candidates.length, 1);
  assert.equal(parsed.candidates[0].id, "nf-1");
  assert.equal(parsed.candidates[0].price, 140);
  assert.equal(parsed.candidates[0].currency, "USD");
});

test("depop provider returns parsed candidates for successful fetch", async () => {
  const html = [
    "<html><head>",
    '<script type="application/ld+json">',
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      sku: "it1",
      name: "Bomber Jacket",
      url: "https://www.depop.com/products/user-bomber-jacket/",
      image: "https://images.depop.test/bomber.jpg",
      offers: {
        price: "95",
        priceCurrency: "USD"
      }
    }),
    "</script>",
    "</head></html>"
  ].join("");

  const provider = createDepopProvider({
    maxRequests: 1,
    cooldownMs: 0,
    fetchImpl: async function () {
      return {
        ok: true,
        text: async function () {
          return html;
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["bomber jacket"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, true);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.requestCount, 1);
  assert.equal(result.sourceType, "html");
  assert.equal(result.parserVersion, "depop-hybrid-v2");
});

test("depop provider falls back to api v3 search when html has no candidates", async () => {
  let calls = [];
  const provider = createDepopProvider({
    fetchImpl: async function (url) {
      calls.push(String(url));

      if (String(url).indexOf("/api/v3/search/products/") !== -1) {
        return {
          ok: true,
          status: 200,
          text: async function () {
            return JSON.stringify({
              data: {
                products: [
                  {
                    id: "api-1",
                    title: "API Jacket",
                    url: "https://www.depop.com/products/user-api-jacket/",
                    price: {
                      amount: 123,
                      currency: "USD"
                    },
                    pictures: [
                      {
                        url: "https://images.depop.test/api-jacket.jpg"
                      }
                    ]
                  }
                ]
              }
            });
          }
        };
      }

      return {
        ok: true,
        status: 200,
        text: async function () {
          return "<html><head><title>Search | Depop</title></head><body></body></html>";
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["api jacket"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, true);
  assert.ok(result.candidates.length >= 1);
  assert.ok(result.candidates.some((candidate) => candidate.id === "api-1"));
  assert.ok(calls.some((url) => url.indexOf("/api/v3/search/products/") !== -1));
});

test("depop provider returns MISSING_LISTING_DATA when queries missing", async () => {
  const provider = createDepopProvider({
    fetchImpl: async function () {
      throw new Error("should not fetch");
    }
  });

  const result = await provider.search({ queries: [] });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "MISSING_LISTING_DATA");
});

test("depop provider can fetch via runtime message bridge", async () => {
  const html = [
    "<html><head>",
    '<script type="application/ld+json">',
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      sku: "runtime1",
      name: "Runtime Tee",
      url: "https://www.depop.com/products/user-runtime-tee/",
      image: "https://images.depop.test/runtime.jpg",
      offers: {
        price: "88",
        priceCurrency: "USD"
      }
    }),
    "</script>",
    "</head></html>"
  ].join("");

  const provider = createDepopProvider({
    fetchImpl: null,
    runtimeSendMessage: async function () {
      return {
        ok: true,
        status: 200,
        text: html
      };
    }
  });

  const result = await provider.search({
    queries: ["runtime tee"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, true);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].id, "runtime1");
});

test("depop provider ignores malformed runtime bridge response and falls back to fetch", async () => {
  let fetchCalls = 0;
  const html = [
    "<html><head>",
    '<script type="application/ld+json">',
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      sku: "fallback-runtime-1",
      name: "Fallback Runtime Tee",
      url: "https://www.depop.com/products/user-fallback-runtime-tee/",
      image: "https://images.depop.test/fallback-runtime.jpg",
      offers: {
        price: "79",
        priceCurrency: "USD"
      }
    }),
    "</script>",
    "</head></html>"
  ].join("");

  const provider = createDepopProvider({
    runtimeSendMessage: async function () {
      return {
        ok: true,
        status: "bad-status",
        text: html
      };
    },
    fetchImpl: async function () {
      fetchCalls += 1;
      return {
        ok: true,
        status: 200,
        text: async function () {
          return html;
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["fallback runtime tee"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(fetchCalls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].id, "fallback-runtime-1");
});

test("depop provider uses cookie-aware fetch options", async () => {
  let captured = null;
  const html = [
    "<html><head>",
    '<script type="application/ld+json">',
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      sku: "cookie-1",
      name: "Cookie Tee",
      url: "https://www.depop.com/products/user-cookie-tee/",
      image: "https://images.depop.test/cookie.jpg",
      offers: {
        price: "77",
        priceCurrency: "USD"
      }
    }),
    "</script>",
    "</head></html>"
  ].join("");

  const provider = createDepopProvider({
    fetchImpl: async function (_url, options) {
      captured = options;
      return {
        ok: true,
        status: 200,
        text: async function () {
          return html;
        }
      };
    }
  });

  await provider.search({
    queries: ["cookie test"],
    limit: 1,
    currency: "USD"
  });

  assert.ok(captured);
  assert.equal(captured.credentials, "include");
  assert.match(String(captured.headers && captured.headers.Accept), /text\/html/i);
});

test("depop provider classifies Cloudflare block pages as FORBIDDEN_OR_BLOCKED", async () => {
  const blockedHtml = [
    "<!DOCTYPE html>",
    "<html><head><title>Attention Required! | Cloudflare</title></head>",
    "<body><div id=\"cf-error-details\">Sorry, you have been blocked</div></body></html>"
  ].join("");

  const provider = createDepopProvider({
    fetchImpl: null,
    runtimeSendMessage: async function () {
      return {
        ok: true,
        status: 200,
        text: blockedHtml
      };
    }
  });

  const result = await provider.search({
    queries: ["drain gang tee"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "FORBIDDEN_OR_BLOCKED");
  assert.equal(result.retryAfterMs, 120000);
});

test("depop provider retries once when response is loading shell", async () => {
  const loadingShellHtml = [
    "<!DOCTYPE html>",
    "<html><head><title>Search | Depop</title></head>",
    "<body><span>loading results</span><script>self.__next_f.push([1,\"stub\"])</script></body></html>"
  ].join("");

  const successHtml = [
    "<html><head>",
    '<script type="application/ld+json">',
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      sku: "retry-1",
      name: "Retry Tee",
      url: "https://www.depop.com/products/user-retry-tee/",
      image: "https://images.depop.test/retry.jpg",
      offers: {
        price: "55",
        priceCurrency: "USD"
      }
    }),
    "</script>",
    "</head></html>"
  ].join("");

  let calls = 0;
  const provider = createDepopProvider({
    cooldownMs: 0,
    maxRequests: 3,
    fetchImpl: async function () {
      calls += 1;
      const text = calls === 1 ? loadingShellHtml : successHtml;
      return {
        ok: true,
        status: 200,
        text: async function () {
          return text;
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["retry tee"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, true);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].id, "retry-1");
  assert.equal(calls, 2);
});

test("depop provider maps explicit zero-result markers to NO_RESULTS", async () => {
  const noResultsHtml = [
    "<!DOCTYPE html>",
    "<html><head><title>Search | Depop</title></head>",
    '<body><script>self.__next_f.push([1, "{\\\"total_count\\\":0,\\\"result_count\\\":0}"])</script></body></html>'
  ].join("");

  const provider = createDepopProvider({
    cooldownMs: 0,
    maxRequests: 2,
    fetchImpl: async function () {
      return {
        ok: true,
        status: 200,
        text: async function () {
          return noResultsHtml;
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["nonexistent piece"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "NO_RESULTS");
});

test("depop provider does not emit NO_RESULTS while page is still loading shell", async () => {
  const loadingWithZeroHtml = [
    "<!DOCTYPE html>",
    "<html><head><title>Search | Depop</title></head>",
    '<body><span>loading results</span><script>self.__next_f.push([1, "{\\\"total_count\\\":0,\\\"result_count\\\":0}"])</script></body></html>'
  ].join("");

  const provider = createDepopProvider({
    cooldownMs: 0,
    maxRequests: 3,
    fetchImpl: async function () {
      return {
        ok: true,
        status: 200,
        text: async function () {
          return loadingWithZeroHtml;
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["still loading"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, false);
  assert.notEqual(result.errorCode, "NO_RESULTS");
});

test("depop provider emits NO_RESULTS when loading shell includes embedded empty product_search state", async () => {
  const loadingWithEmbeddedEmptySearchHtml = [
    "<!DOCTYPE html>",
    "<html><head><title>Search | Depop</title></head>",
    "<body>",
    "<span>loading results</span>",
    '<script>self.__next_f.push([1, "{\\\"queryHash\\\":\\\"[\\\\\\\"product_search\\\\\\\"]\\\",\\\"products\\\":[],\\\"total_count\\\":0,\\\"result_count\\\":0}"])</script>',
    "</body></html>"
  ].join("");

  const provider = createDepopProvider({
    cooldownMs: 0,
    maxRequests: 2,
    fetchImpl: async function () {
      return {
        ok: true,
        status: 200,
        text: async function () {
          return loadingWithEmbeddedEmptySearchHtml;
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["drain gang chaos"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "NO_RESULTS");
});

test("depop provider treats local no-results banner as valid when API provides priced products", async () => {
  const noLocalButCrossBorderHtml = [
    "<!DOCTYPE html>",
    "<html><head><title>Search | Depop</title></head>",
    "<body>",
    '<div class="styles_noResultsFallbackContainer__amKC_">No items available in your location. Check out other matching items from US sellers.</div>',
    '<ol class="styles_productGrid__Cpzyf">',
    '<li><a href="/products/lain_xox-drain-gang-2022-world-tour/">item</a></li>',
    '<li><a href="/products/jetaz-drain-gang-world-tour-chaos/">item</a></li>',
    "</ol>",
    "</body></html>"
  ].join("");

  const provider = createDepopProvider({
    cooldownMs: 0,
    maxRequests: 2,
    fetchImpl: async function (url) {
      if (String(url).indexOf("/api/v3/search/products") !== -1) {
        return {
          ok: true,
          status: 200,
          text: async function () {
            return JSON.stringify({
              products: [
                {
                  id: "priced-local-1",
                  slug: "priced-local-1",
                  description: "Drain Gang 2022 World Tour Tee",
                  price: { amount: 91, currency: "USD" }
                },
                {
                  id: "priced-local-2",
                  slug: "priced-local-2",
                  description: "Drain Gang World Tour Chaos",
                  price: { amount: 77, currency: "USD" }
                }
              ]
            });
          }
        };
      }

      return {
        ok: true,
        status: 200,
        text: async function () {
          return noLocalButCrossBorderHtml;
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["drain gang chaos"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.candidates));
  assert.equal(result.candidates.length, 2);
  assert.ok(result.candidates.every((candidate) => Number(candidate.price) > 0));
});

test("depop provider preserves API fallback budget after loading-shell retry", async () => {
  const loadingWithZeroHtml = [
    "<!DOCTYPE html>",
    "<html><head><title>Search | Depop</title></head>",
    '<body><span>loading results</span><script>self.__next_f.push([1, "{\\\"total_count\\\":0,\\\"result_count\\\":0}"])</script></body></html>'
  ].join("");

  const apiPayload = {
    products: [
      {
        id: "api-fallback-1",
        slug: "api-fallback-1",
        description: "API Fallback Tee",
        price: { amount: 88, currency: "USD" },
        pictures: [
          {
            url: "https://images.depop.test/api-fallback.jpg"
          }
        ]
      }
    ]
  };

  var calls = 0;
  const provider = createDepopProvider({
    cooldownMs: 0,
    maxRequests: 3,
    fetchImpl: async function (url) {
      calls += 1;

      if (String(url).indexOf("/api/v3/search/products") !== -1) {
        return {
          ok: true,
          status: 200,
          text: async function () {
            return JSON.stringify(apiPayload);
          }
        };
      }

      return {
        ok: true,
        status: 200,
        text: async function () {
          return loadingWithZeroHtml;
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["drain gang chaos"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, true);
  assert.ok(result.candidates.length >= 1);
  assert.equal(calls, 3);
});

test("depop provider keeps href-only fallback candidates when priced data is unavailable", async () => {
  const loadingShellHtml = [
    "<!DOCTYPE html>",
    "<html><head><title>Search | Depop</title></head>",
    "<body><span>loading results</span></body></html>"
  ].join("");

  const apiHtml = [
    "<!DOCTYPE html>",
    "<html><body>",
    '<ol class="styles_productGrid__Cpzyf">',
    '<li><a href="/products/fallback-html-1/">item</a></li>',
    '<li><a href="/products/fallback-html-2/">item</a></li>',
    "</ol>",
    "</body></html>"
  ].join("");

  const provider = createDepopProvider({
    cooldownMs: 0,
    maxRequests: 3,
    fetchImpl: async function (url) {
      if (String(url).indexOf("/api/v3/search/products") !== -1) {
        return {
          ok: true,
          status: 200,
          text: async function () {
            return apiHtml;
          }
        };
      }

      return {
        ok: true,
        status: 200,
        text: async function () {
          return loadingShellHtml;
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["drain gang chaos"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, true);
  assert.ok(result.candidates.length >= 1);
  assert.ok(result.candidates.every((candidate) => candidate.price == null));
});

test("depop provider maps API slug-only entries to product URLs", async () => {
  const provider = createDepopProvider({
    cooldownMs: 0,
    maxRequests: 2,
    fetchImpl: async function (url) {
      if (String(url).indexOf("/api/v3/search/products") !== -1) {
        return {
          ok: true,
          status: 200,
          text: async function () {
            return JSON.stringify({
              products: [
                {
                  slug: "slug-only-item-1",
                  description: "Slug-only item",
                  price: { amount: 42, currency: "USD" },
                  pictures: [{ url: "https://images.depop.test/slug-only.jpg" }]
                }
              ]
            });
          }
        };
      }

      return {
        ok: true,
        status: 200,
        text: async function () {
          return "<html><body><span>loading results</span></body></html>";
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["drain gang chaos"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, true);
  assert.ok(result.candidates.length >= 1);
  var hasSlugCandidate = result.candidates.some(function (candidate) {
    return /\/products\/slug-only-item-1\/?$/.test(String(candidate && candidate.url || ""));
  });
  assert.equal(hasSlugCandidate, true);
});

test("depop provider prefers API priced results over html href-only fallback", async () => {
  const htmlHrefOnly = [
    "<!DOCTYPE html>",
    "<html><body>",
    '<ol class="styles_productGrid__Cpzyf">',
    '<li><a href="/products/href-only-1/">item</a></li>',
    '<li><a href="/products/href-only-2/">item</a></li>',
    "</ol>",
    "</body></html>"
  ].join("");

  const provider = createDepopProvider({
    cooldownMs: 0,
    maxRequests: 3,
    fetchImpl: async function (url) {
      if (String(url).indexOf("/api/v3/search/products") !== -1) {
        return {
          ok: true,
          status: 200,
          text: async function () {
            return JSON.stringify({
              products: [
                {
                  id: "api-priced-1",
                  slug: "api-priced-1",
                  description: "API priced item",
                  price: { amount: 99, currency: "USD" },
                  pictures: [{ url: "https://images.depop.test/api-priced-1.jpg" }]
                }
              ]
            });
          }
        };
      }

      return {
        ok: true,
        status: 200,
        text: async function () {
          return htmlHrefOnly;
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["drain gang chaos"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, true);
  assert.ok(result.candidates.length >= 1);
  assert.ok(result.candidates.some((candidate) => candidate.id === "api-priced-1"));
  assert.ok(result.candidates.every((candidate) => Number(candidate.price) > 0));
});

test("depop provider extracts amount from pricing-shaped API payload", async () => {
  const provider = createDepopProvider({
    cooldownMs: 0,
    maxRequests: 3,
    fetchImpl: async function (url) {
      if (String(url).indexOf("/api/v3/search/products") !== -1) {
        return {
          ok: true,
          status: 200,
          text: async function () {
            return JSON.stringify({
              products: [
                {
                  id: "api-pricing-1",
                  slug: "api-pricing-1",
                  description: "Drain Gang Chaos T-Shirt White",
                  pricing: {
                    discounted_price: {
                      amount: 74,
                      currency: "USD"
                    }
                  },
                  pictures: [{ url: "https://images.depop.test/api-pricing-1.jpg" }]
                }
              ]
            });
          }
        };
      }

      return {
        ok: true,
        status: 200,
        text: async function () {
          return "<html><body><span>loading results</span></body></html>";
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["drain gang chaos"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, true);
  assert.ok(result.candidates.length >= 1);
  assert.ok(result.candidates.some((candidate) => candidate.id === "api-pricing-1"));
  assert.ok(result.candidates.every((candidate) => Number(candidate.price) > 0));
});

test("depop provider enriches href fallback candidates from product pages", async () => {
  const searchHtml = [
    "<!DOCTYPE html>",
    "<html><body>",
    '<ol class="styles_productGrid__Cpzyf">',
    '<li><a href="/products/enriched-item-1/">item</a></li>',
    "</ol>",
    "</body></html>"
  ].join("");

  const productHtml = [
    "<html><head>",
    '<script type="application/ld+json">',
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      sku: "enriched-item-1",
      name: "Drain Gang Chaos Tee",
      url: "https://www.depop.com/products/enriched-item-1/",
      offers: {
        price: "65",
        priceCurrency: "USD"
      }
    }),
    "</script>",
    "</head><body></body></html>"
  ].join("");

  const provider = createDepopProvider({
    cooldownMs: 0,
    maxRequests: 3,
    fetchImpl: async function (url) {
      var value = String(url);
      if (value.indexOf("/api/v3/search/products") !== -1) {
        return {
          ok: false,
          status: 500,
          text: async function () {
            return "";
          }
        };
      }

      if (value.indexOf("/products/enriched-item-1/") !== -1) {
        return {
          ok: true,
          status: 200,
          text: async function () {
            return productHtml;
          }
        };
      }

      return {
        ok: true,
        status: 200,
        text: async function () {
          return searchHtml;
        }
      };
    }
  });

  const result = await provider.search({
    queries: ["drain gang chaos"],
    limit: 5,
    currency: "USD"
  });

  assert.equal(result.ok, true);
  assert.ok(result.candidates.length >= 1);
  assert.ok(result.candidates.some((candidate) => candidate.id === "enriched-item-1"));
  assert.ok(result.candidates.every((candidate) => Number(candidate.price) > 0));
});
