(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusDepopProvider = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PARSER_VERSION = "depop-hybrid-v2";

  var KNOWN_CURRENCY_CODES = {
    USD: true,
    EUR: true,
    GBP: true,
    CAD: true,
    AUD: true,
    JPY: true,
    SEK: true,
    NOK: true,
    DKK: true,
    CHF: true,
    PLN: true
  };

  var CURRENCY_SYMBOL_MAP = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "A$": "AUD",
    "C$": "CAD"
  };
  var RUNTIME_FETCH_MESSAGE_TYPE = "grailed-plus:depop-search-fetch";

  function normalizeString(value, fallback) {
    if (typeof value === "string") {
      var trimmed = value.trim();
      return trimmed || fallback;
    }
    return fallback;
  }

  function normalizeNumber(value) {
    if (value == null) {
      return null;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== "string") {
      return null;
    }
    if (value.trim() === "") {
      return null;
    }
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeCurrencyCode(value) {
    if (typeof value !== "string") {
      return null;
    }

    var upper = value.trim().toUpperCase();
    if (!upper || !KNOWN_CURRENCY_CODES[upper]) {
      return null;
    }
    return upper;
  }

  function inferCurrencyFromLabel(label) {
    var text = normalizeString(label, "");
    if (!text) {
      return null;
    }

    var codeMatch = text.match(/\b([A-Z]{3})\b/);
    if (codeMatch && codeMatch[1]) {
      var byCode = normalizeCurrencyCode(codeMatch[1]);
      if (byCode) {
        return byCode;
      }
    }

    var symbolCandidates = ["A$", "C$", "€", "£", "¥", "$"];
    for (var i = 0; i < symbolCandidates.length; i += 1) {
      if (text.indexOf(symbolCandidates[i]) !== -1 && CURRENCY_SYMBOL_MAP[symbolCandidates[i]]) {
        return CURRENCY_SYMBOL_MAP[symbolCandidates[i]];
      }
    }

    return null;
  }

  function parseAmountFromLabel(label) {
    var text = normalizeString(label, "");
    if (!text) {
      return null;
    }

    var cleaned = text.replace(/,/g, "");
    var amountMatch = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (!amountMatch) {
      return null;
    }

    var parsed = Number(amountMatch[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function tryParseJsonLenient(text) {
    var raw = normalizeString(text, "");
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (_) {
      // Continue with lenient parsing.
    }

    var cleaned = raw.replace(/^\uFEFF/, "").trim();

    // Handle common XSSI prefixes like )]}', and for(;;);
    cleaned = cleaned.replace(/^\)\]\}',?\s*/, "");
    cleaned = cleaned.replace(/^for\s*\(\s*;\s*;\s*\)\s*;?\s*/, "");

    var firstBrace = cleaned.indexOf("{");
    var firstBracket = cleaned.indexOf("[");
    var start = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
      start = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      start = firstBrace;
    } else if (firstBracket !== -1) {
      start = firstBracket;
    }

    if (start > 0) {
      cleaned = cleaned.slice(start);
    }

    try {
      return JSON.parse(cleaned);
    } catch (_) {
      return null;
    }
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  function normalizeBoolean(value) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      var text = value.trim().toLowerCase();
      if (text === "true") {
        return true;
      }
      if (text === "false") {
        return false;
      }
    }
    return null;
  }

  function withJitter(ms) {
    var base = Math.max(0, Number(ms) || 0);
    var variance = base * 0.1;
    var delta = (Math.random() * variance * 2) - variance;
    return Math.max(0, Math.round(base + delta));
  }

  function mapHttpError(status) {
    if (status === 403 || status === 401) {
      return { errorCode: "FORBIDDEN_OR_BLOCKED", retryAfterMs: 120000 };
    }
    if (status === 429) {
      return { errorCode: "RATE_LIMITED", retryAfterMs: 2000 };
    }
    if (status >= 500) {
      return { errorCode: "NETWORK_ERROR", retryAfterMs: 1500 };
    }
    return { errorCode: "PARSE_ERROR", retryAfterMs: 0 };
  }

  function normalizeProductCandidate(candidate) {
    var input = candidate && typeof candidate === "object" ? candidate : {};
    var isHrefFallback = Boolean(input && input.raw && input.raw.source === "href_fallback");
    var id = normalizeString(input.id, null);
    var title = normalizeString(input.title, "Untitled");
    var url = normalizeString(input.url, "");
    var imageUrl = normalizeString(input.imageUrl, "");
    var inferredAmount = parseAmountFromLabel(input.priceLabel);
    var price = normalizeNumber(input.price);
    if (price == null) {
      price = inferredAmount;
    }

    if (price != null && price <= 0) {
      price = null;
    }

    var currency =
      normalizeCurrencyCode(input.currency) ||
      inferCurrencyFromLabel(input.priceLabel) ||
      "USD";

    if (!id || !url || (price == null && !isHrefFallback)) {
      return null;
    }

    return {
      market: "depop",
      id: id,
      title: title,
      url: url,
      imageUrl: imageUrl,
      price: price,
      currency: currency,
      raw: input.raw || null
    };
  }

  function extractFromJsonLd(html) {
    var matches = [];
    var scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    var scriptMatch = scriptRegex.exec(html);

    while (scriptMatch) {
      try {
        var payload = JSON.parse(scriptMatch[1]);
        var queue = Array.isArray(payload) ? payload.slice() : [payload];

        while (queue.length) {
          var node = queue.shift();
          if (!node || typeof node !== "object") {
            continue;
          }

          if (Array.isArray(node)) {
            node.forEach(function (entry) {
              queue.push(entry);
            });
            continue;
          }

          if (node["@type"] === "Product") {
            var offer = node.offers && typeof node.offers === "object" ? node.offers : {};
            var candidate = normalizeProductCandidate({
              id: normalizeString(node.sku, null) || normalizeString(node.productID, null) || normalizeString(node.url, "").split("/").filter(Boolean).pop(),
              title: normalizeString(node.name, "Untitled"),
              url: normalizeString(node.url, ""),
              imageUrl: Array.isArray(node.image) ? normalizeString(node.image[0], "") : normalizeString(node.image, ""),
              price: normalizeNumber(offer.price),
              currency: normalizeCurrencyCode(normalizeString(offer.priceCurrency, "")) || "USD",
              priceLabel: normalizeString(offer.priceCurrency, "") + " " + normalizeString(offer.price, ""),
              raw: node
            });
            if (candidate) {
              matches.push(candidate);
            }
          }

          Object.keys(node).forEach(function (key) {
            if (node[key] && typeof node[key] === "object") {
              queue.push(node[key]);
            }
          });
        }
      } catch (_) {
        // Ignore malformed JSON-LD blocks.
      }

      scriptMatch = scriptRegex.exec(html);
    }

    return matches;
  }

  function getNestedValue(source, paths) {
    var i;
    var j;
    var path;
    var current;
    for (i = 0; i < paths.length; i += 1) {
      path = paths[i];
      current = source;
      for (j = 0; j < path.length; j += 1) {
        if (!current || typeof current !== "object" || !(path[j] in current)) {
          current = null;
          break;
        }
        current = current[path[j]];
      }
      if (current != null) {
        return current;
      }
    }
    return null;
  }

  function readBalancedJsonArray(text, startIndex) {
    var inString = false;
    var escaped = false;
    var depth = 0;
    var i;
    var ch;
    for (i = startIndex; i < text.length; i += 1) {
      ch = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === "[") {
        depth += 1;
        continue;
      }

      if (ch === "]") {
        depth -= 1;
        if (depth === 0) {
          return text.slice(startIndex, i + 1);
        }
      }
    }

    return "";
  }

  function normalizeFlightText(raw) {
    if (!raw) {
      return "";
    }
    return raw
      .replace(/\\\"/g, '"')
      .replace(/\\n/g, " ")
      .replace(/\\t/g, " ");
  }

  function mapFlightProduct(product) {
    var input = product && typeof product === "object" ? product : {};
    var slug = normalizeString(getNestedValue(input, [["slug"], ["seo", "slug"]]), "");
    var url =
      normalizeString(getNestedValue(input, [["url"], ["path"], ["route"]]), "") ||
      normalizeString(getNestedValue(input, [["permalink"]]), "");

    if (!url && slug) {
      url = "https://www.depop.com/products/" + slug + "/";
    }

    if (url && url.indexOf("/") === 0) {
      url = "https://www.depop.com" + url;
    }

    var id =
      normalizeString(getNestedValue(input, [["id"], ["productId"], ["product_id"], ["slug"]]), null) ||
      (url ? normalizeString(url.split("/").filter(Boolean).pop(), null) : null);

    var imageUrl =
      normalizeString(
        getNestedValue(input, [
          ["imageUrl"],
          ["image", "url"],
          ["pictures", 0, "url"],
          ["photos", 0, "url"]
        ]),
        ""
      ) || "";

    var amount = normalizeNumber(input.price);
    if (amount == null) {
      amount =
        normalizeNumber(
          getNestedValue(input, [
            ["priceAmount"],
            ["price_amount"],
            ["price", "amount"],
            ["priceInfo", "amount"],
            ["price_info", "amount"],
            ["pricing", "amount"],
            ["pricing", "priceAmount"],
            ["pricing", "price", "amount"],
            ["pricing", "price", "display_amount"],
            ["pricing", "display_price", "amount"],
            ["pricing", "discounted_price", "amount"],
            ["pricing", "discountedPrice", "amount"]
          ])
        );
    }

    var cents = normalizeNumber(
      getNestedValue(input, [
        ["priceCents"],
        ["price_cents"],
        ["price", "amountCents"],
        ["price", "amount_cents"],
        ["pricing", "price", "amount_cents"],
        ["pricing", "discounted_price", "amount_cents"],
        ["pricing", "discountedPrice", "amount_cents"]
      ])
    );

    if (amount == null && cents != null) {
      amount = cents / 100;
    }

    return normalizeProductCandidate({
      id: id,
      title: normalizeString(getNestedValue(input, [["title"], ["name"], ["description"]]), "Untitled"),
      url: url,
      imageUrl: imageUrl,
      price: amount,
      currency: normalizeString(
        getNestedValue(input, [
          ["currency"],
          ["price", "currency"],
          ["priceInfo", "currency"],
          ["pricing", "currency"],
          ["pricing", "price", "currency"],
          ["pricing", "discounted_price", "currency"],
          ["pricing", "discountedPrice", "currency"]
        ]),
        "USD"
      ),
      raw: input
    });
  }

  function walkJsonTree(node, visitor) {
    if (node == null) {
      return;
    }
    visitor(node);
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i += 1) {
        walkJsonTree(node[i], visitor);
      }
      return;
    }
    if (typeof node === "object") {
      var keys = Object.keys(node);
      for (var k = 0; k < keys.length; k += 1) {
        walkJsonTree(node[keys[k]], visitor);
      }
    }
  }

  function parseCandidatesFromApiPayload(payload) {
    var candidates = [];
    var seen = Object.create(null);

    walkJsonTree(payload, function (node) {
      if (!node || typeof node !== "object" || Array.isArray(node)) {
        return;
      }

      var maybeId = getNestedValue(node, [["id"], ["product_id"], ["productId"], ["slug"]]);
      var maybeUrl = getNestedValue(node, [["url"], ["path"], ["permalink"], ["route"]]);
      var maybePrice = getNestedValue(node, [["price"], ["price_amount"], ["priceAmount"], ["price", "amount"]]);

      if (maybeId == null && maybeUrl == null && maybePrice == null) {
        return;
      }

      var normalized = mapFlightProduct(node);
      if (!normalized || !normalized.id || seen[normalized.id]) {
        return;
      }

      seen[normalized.id] = true;
      candidates.push(normalized);
    });

    return candidates;
  }

  function hasNoResultsInApiPayload(payload) {
    var foundZero = false;

    walkJsonTree(payload, function (node) {
      if (!node || typeof node !== "object" || Array.isArray(node)) {
        return;
      }

      var totalCount = normalizeNumber(node.total_count);
      var resultCount = normalizeNumber(node.result_count);
      var total = normalizeNumber(node.total);
      var count = normalizeNumber(node.count);

      if (totalCount === 0 || resultCount === 0 || total === 0 || count === 0) {
        foundZero = true;
      }
    });

    return foundZero;
  }

  function extractFromNextFlightPayload(html) {
    var scripts = [];
    var scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    var scriptMatch = scriptRegex.exec(html);
    while (scriptMatch) {
      if (scriptMatch[1] && scriptMatch[1].indexOf("self.__next_f.push") !== -1) {
        scripts.push(scriptMatch[1]);
      }
      scriptMatch = scriptRegex.exec(html);
    }

    if (!scripts.length) {
      return [];
    }

    var decodedChunks = [];
    var pushRegex = /self\.__next_f\.push\(\[1,\s*"((?:\\.|[^"\\])*)"\]\)/g;
    var i;
    var pushMatch;
    for (i = 0; i < scripts.length; i += 1) {
      pushMatch = pushRegex.exec(scripts[i]);
      while (pushMatch) {
        try {
          decodedChunks.push(JSON.parse('"' + pushMatch[1] + '"'));
        } catch (_) {
          decodedChunks.push(pushMatch[1]);
        }
        pushMatch = pushRegex.exec(scripts[i]);
      }
      pushRegex.lastIndex = 0;
    }

    var allText = normalizeFlightText(decodedChunks.join("\n"));
    if (!allText) {
      return [];
    }

    var candidates = [];
    var searchToken = '"products":[';
    var offset = allText.indexOf(searchToken);
    while (offset !== -1) {
      var arrayStart = offset + searchToken.length - 1;
      var jsonArray = readBalancedJsonArray(allText, arrayStart);
      if (jsonArray) {
        try {
          var products = JSON.parse(jsonArray);
          if (Array.isArray(products)) {
            products.forEach(function (product) {
              var normalized = mapFlightProduct(product);
              if (normalized) {
                candidates.push(normalized);
              }
            });
          }
        } catch (_) {
          // Ignore malformed slices and continue scanning.
        }
      }

      offset = allText.indexOf(searchToken, offset + searchToken.length);
    }

    return candidates;
  }

  function extractFromNextDataPayload(html) {
    var match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!match || !match[1]) {
      return [];
    }

    var parsed = tryParseJsonLenient(match[1]);
    if (!parsed || typeof parsed !== "object") {
      return [];
    }

    return parseCandidatesFromApiPayload(parsed)
      .map(normalizeProductCandidate)
      .filter(Boolean);
  }

  function extractFromHrefFallback(html) {
    var output = [];
    var seen = Object.create(null);
    var hrefRegex = /href=["'](\/products\/[^"'#?]+)["']/gi;
    var match = hrefRegex.exec(html);

    while (match) {
      var path = normalizeString(match[1], "");
      if (path && !seen[path]) {
        seen[path] = true;
        var slug = path.split("/").filter(Boolean).pop() || "item";
        var start = Math.max(0, (match.index || 0) - 500);
        var end = Math.min(html.length, (match.index || 0) + 900);
        var snippet = html.slice(start, end);

        var titleMatch = snippet.match(/aria-label=["']([^"']+)["']/i);
        if (!titleMatch) {
          titleMatch = snippet.match(/alt=["']([^"']+)["']/i);
        }

        var amountMatch = snippet.match(/(?:\$|€|£|¥|USD\s+|EUR\s+|GBP\s+|CAD\s+|AUD\s+)(\d+(?:\.\d+)?)/i);
        var inferredPrice = amountMatch ? normalizeNumber(amountMatch[1]) : null;
        if (inferredPrice != null && inferredPrice <= 0) {
          inferredPrice = null;
        }
        var inferredCurrency = inferCurrencyFromLabel(snippet) || "USD";

        output.push({
          market: "depop",
          id: slug,
          title: normalizeString(titleMatch && titleMatch[1], slug.replace(/-/g, " ")),
          url: "https://www.depop.com" + path,
          imageUrl: "",
          price: inferredPrice,
          currency: inferredCurrency,
          raw: {
            source: "href_fallback"
          }
        });
      }
      match = hrefRegex.exec(html);
    }

    return output;
  }

  function parseCandidates(html) {
    if (typeof html !== "string" || !html.trim()) {
      return {
        candidates: [],
        parserMismatchLikely: true
      };
    }

    var jsonCandidates = extractFromJsonLd(html);
    if (jsonCandidates.length) {
      return {
        candidates: jsonCandidates,
        parserMismatchLikely: false
      };
    }

    var nextFlightCandidates = extractFromNextFlightPayload(html);
    if (nextFlightCandidates.length) {
      return {
        candidates: nextFlightCandidates,
        parserMismatchLikely: false
      };
    }

    var nextDataCandidates = extractFromNextDataPayload(html);
    if (nextDataCandidates.length) {
      return {
        candidates: nextDataCandidates,
        parserMismatchLikely: false
      };
    }

    // Keep href-derived candidates even when price is unavailable.
    // Search fallback pages can still provide valid listing URLs.
    var hrefCandidates = extractFromHrefFallback(html);

    return {
      candidates: hrefCandidates,
      parserMismatchLikely: true
    };
  }

  function hasProductResultsMarker(html) {
    var text = normalizeString(html, "").toLowerCase();
    if (!text) {
      return false;
    }

    return (
      text.indexOf("styles_productgrid__") !== -1 ||
      text.indexOf("styles_productcardroot__") !== -1 ||
      text.indexOf("/products/") !== -1
    );
  }

  function isBlockedHtml(html) {
    var text = normalizeString(html, "").toLowerCase();
    if (!text) {
      return false;
    }

    var blockedMarkers = [
      "attention required! | cloudflare",
      "sorry, you have been blocked",
      "cloudflare ray id",
      "cf-error-details",
      "captcha"
    ];

    for (var i = 0; i < blockedMarkers.length; i += 1) {
      if (text.indexOf(blockedMarkers[i]) !== -1) {
        return true;
      }
    }

    return false;
  }

  function isLikelyLoadingShellHtml(html) {
    var text = normalizeString(html, "").toLowerCase();
    if (!text) {
      return false;
    }

    var loadingMarkers = [
      "loading results",
      "styles_shimmerstyles",
      "_outerbounce_"
    ];

    for (var i = 0; i < loadingMarkers.length; i += 1) {
      if (text.indexOf(loadingMarkers[i]) !== -1) {
        return true;
      }
    }

    return false;
  }

  function hasNoResultsMarker(html) {
    var text = normalizeString(html, "");
    if (!text) {
      return false;
    }

    // Depop Next.js flight payload often embeds backend search totals.
    return (
      text.indexOf('"total_count":0') !== -1 ||
      text.indexOf('"result_count":0') !== -1 ||
      text.indexOf('\\"total_count\\":0') !== -1 ||
      text.indexOf('\\"result_count\\":0') !== -1 ||
      text.indexOf('"NoMatchingResults"') !== -1
    );
  }

  function shouldReturnNoResults(html) {
    var text = normalizeString(html, "");
    if (!text) {
      return false;
    }

    // Depop can show a local no-results banner while still rendering
    // valid cross-border listings in the product grid.
    if (hasProductResultsMarker(text)) {
      return false;
    }

    // Some Next.js search shells include loading placeholders while also
    // embedding definitive dehydrated empty search state.
    var hasEmbeddedEmptySearch =
      text.indexOf("product_search") !== -1 &&
      (text.indexOf('"products":[]') !== -1 || text.indexOf('\\"products\\":[]') !== -1);

    if (hasEmbeddedEmptySearch && hasNoResultsMarker(text)) {
      return true;
    }

    // Next.js flight payloads can carry transient zero-count markers while
    // the page is still in a loading shell state.
    return hasNoResultsMarker(text) && !isLikelyLoadingShellHtml(text);
  }

  function dedupeById(candidates) {
    var seen = Object.create(null);
    return candidates.filter(function (candidate) {
      var id = normalizeString(candidate && candidate.id, "");
      if (!id || seen[id]) {
        return false;
      }
      seen[id] = true;
      return true;
    });
  }

  function hasMeaningfulPrice(candidate) {
    var price = normalizeNumber(candidate && candidate.price);
    return price != null && price > 0;
  }

  function hasAnyUsableCandidate(candidates) {
    return Array.isArray(candidates) && candidates.some(function (candidate) {
      return Boolean(candidate && normalizeString(candidate.id, "") && normalizeString(candidate.url, ""));
    });
  }

  function buildBroadFallbackQuery(query) {
    var text = normalizeString(query, "").toLowerCase();
    if (!text) {
      return "";
    }

    var tokens = text
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(function (token) {
        return token && token.length > 1;
      });

    if (!tokens.length) {
      return "";
    }

    return tokens.slice(0, 2).join(" ");
  }

  function resolveRuntimeSendMessage() {
    if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.sendMessage === "function") {
      return function (payload) {
        return new Promise(function (resolve) {
          try {
            chrome.runtime.sendMessage(payload, function (response) {
              resolve(response || null);
            });
          } catch (_) {
            resolve(null);
          }
        });
      };
    }

    if (typeof browser !== "undefined" && browser.runtime && typeof browser.runtime.sendMessage === "function") {
      return function (payload) {
        return Promise.resolve(browser.runtime.sendMessage(payload)).catch(function () {
          return null;
        });
      };
    }

    return null;
  }

  function buildApiSearchUrl(query, payload) {
    var input = payload && typeof payload === "object" ? payload : {};
    var params = new URLSearchParams();
    params.set("what", normalizeString(query, ""));

    var country = normalizeString(input.country, "");
    if (country) {
      params.set("country", country.toLowerCase());
    }

    var currency = normalizeCurrencyCode(input.currency || "") || "USD";
    params.set("currency", currency);

    var searchFrom = normalizeString(input.from, "");
    if (searchFrom) {
      params.set("from", searchFrom);
    }

    var gender = normalizeString(input.gender, "");
    if (gender) {
      params.set("gender", gender);
    }

    var group = normalizeString(input.group, "");
    if (group) {
      params.set("groups", group);
    }

    var productTypes = Array.isArray(input.productTypes) ? input.productTypes.filter(Boolean) : [];
    if (productTypes.length) {
      params.set("product_types", productTypes.join(","));
    }

    var isKids = normalizeBoolean(input.isKids);
    if (isKids != null) {
      params.set("is_kids", String(isKids));
    }

    return "https://www.depop.com/api/v3/search/products/?" + params.toString();
  }

  async function fetchSearchPage(url, fetchImpl, runtimeSendMessage, acceptHeader) {
    var accept = normalizeString(acceptHeader, "") || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

    if (typeof runtimeSendMessage === "function") {
      var runtimeResponse = await runtimeSendMessage({
        type: RUNTIME_FETCH_MESSAGE_TYPE,
        url: url,
        accept: accept
      });

      if (runtimeResponse && typeof runtimeResponse === "object") {
        return {
          ok: Boolean(runtimeResponse.ok),
          status: Number(runtimeResponse.status) || 0,
          text: normalizeString(runtimeResponse.text, ""),
          source: "runtime"
        };
      }
    }

    if (typeof fetchImpl !== "function") {
      return {
        ok: false,
        status: 0,
        text: "",
        source: "none"
      };
    }

    try {
      var response = await fetchImpl(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: accept
        }
      });
      var text = "";
      try {
        text = await response.text();
      } catch (_) {
        text = "";
      }

      return {
        ok: Boolean(response && response.ok),
        status: response ? Number(response.status) : 0,
        text: text,
        source: "fetch"
      };
    } catch (_) {
      return {
        ok: false,
        status: 0,
        text: "",
        source: "fetch"
      };
    }
  }

  async function tryApiSearch(query, payload, fetchImpl, runtimeSendMessage) {
    var apiUrl = buildApiSearchUrl(query, payload);
    var fetched = await fetchSearchPage(
      apiUrl,
      fetchImpl,
      runtimeSendMessage,
      "application/json,text/plain,*/*"
    );

    if (!fetched.ok) {
      if (fetched.status === 0) {
        return {
          ok: false,
          requestCount: 1,
          errorCode: "NETWORK_ERROR",
          retryAfterMs: 1500
        };
      }

      var mappedError = mapHttpError(fetched.status);
      return {
        ok: false,
        requestCount: 1,
        errorCode: mappedError.errorCode,
        retryAfterMs: mappedError.retryAfterMs
      };
    }

    var text = normalizeString(fetched.text, "");
    if (!text) {
      return {
        ok: false,
        requestCount: 1,
        errorCode: "PARSE_ERROR",
        retryAfterMs: 0
      };
    }

    var parsed = tryParseJsonLenient(text);
    if (!parsed) {
      // Some edge responses are HTML/challenge content even on API routes.
      // Reuse HTML parser before treating it as a hard parse failure.
      var htmlParsed = parseCandidates(text);
      var htmlCandidates = dedupeById(htmlParsed.candidates || [])
        .map(normalizeProductCandidate)
        .filter(Boolean);

      if (htmlCandidates.length) {
        return {
          ok: true,
          requestCount: 1,
          candidates: htmlCandidates
        };
      }

      return {
        ok: false,
        requestCount: 1,
        errorCode: "PARSE_ERROR",
        retryAfterMs: 0
      };
    }

    var candidates = dedupeById(parseCandidatesFromApiPayload(parsed) || [])
      .map(normalizeProductCandidate)
      .filter(Boolean);

    if (candidates.length) {
      return {
        ok: true,
        requestCount: 1,
        candidates: candidates
      };
    }

    if (hasNoResultsInApiPayload(parsed)) {
      return {
        ok: false,
        requestCount: 1,
        errorCode: "NO_RESULTS",
        retryAfterMs: 0
      };
    }

    return {
      ok: false,
      requestCount: 1,
      errorCode: "PARSE_ERROR",
      retryAfterMs: 0
    };
  }

  async function enrichHrefFallbackCandidates(candidates, fetchImpl, runtimeSendMessage, maxFetches) {
    var list = Array.isArray(candidates) ? candidates : [];
    var fetchBudget = Math.max(0, Number(maxFetches) || 0);
    if (!list.length || fetchBudget < 1) {
      return {
        candidates: [],
        requestCount: 0
      };
    }

    var output = [];
    var seenIds = Object.create(null);
    var requestCount = 0;

    for (var i = 0; i < list.length && requestCount < fetchBudget; i += 1) {
      var candidate = list[i];
      var url = normalizeString(candidate && candidate.url, "");
      if (!url) {
        continue;
      }

      var fetched = await fetchSearchPage(url, fetchImpl, runtimeSendMessage);
      requestCount += 1;
      if (!fetched.ok || !fetched.text) {
        continue;
      }

      var parsed = parseCandidates(fetched.text);
      var normalized = dedupeById(parsed.candidates || [])
        .map(normalizeProductCandidate)
        .filter(Boolean)
        .filter(hasMeaningfulPrice);

      if (!normalized.length) {
        continue;
      }

      var best = normalized[0];
      var id = normalizeString(best && best.id, "");
      if (!id || seenIds[id]) {
        continue;
      }

      seenIds[id] = true;
      output.push(best);
    }

    return {
      candidates: output,
      requestCount: requestCount
    };
  }

  async function trySingleQueryFallback(fetchImpl, runtimeSendMessage, query, cooldownMs) {
    var fallbackQuery = normalizeString(query, "");
    if (!fallbackQuery) {
      return {
        ok: false,
        candidates: [],
        requestCount: 0,
        errorCode: "FORBIDDEN_OR_BLOCKED",
        retryAfterMs: 120000,
        partial: true
      };
    }

    await sleep(withJitter(Math.max(cooldownMs, 1200) * 1.5));

    var fallbackUrl = "https://www.depop.com/search/?q=" + encodeURIComponent(fallbackQuery);
    var fetched = await fetchSearchPage(fallbackUrl, fetchImpl, runtimeSendMessage);

    if (!fetched.ok && fetched.status === 0) {
      return {
        ok: false,
        candidates: [],
        requestCount: 0,
        errorCode: "NETWORK_ERROR",
        retryAfterMs: 2000,
        partial: true
      };
    }

    if (!fetched.ok) {
      var mapped = mapHttpError(fetched.status);
      return {
        ok: false,
        candidates: [],
        requestCount: 1,
        errorCode: mapped.errorCode,
        retryAfterMs: mapped.retryAfterMs,
        partial: true
      };
    }

    var html = fetched.text;
    if (!html) {
      return {
        ok: false,
        candidates: [],
        requestCount: 1,
        errorCode: "PARSE_ERROR",
        retryAfterMs: 0,
        partial: true
      };
    }

    var parsed = parseCandidates(html);
    var normalized = dedupeById(parsed.candidates || [])
      .map(normalizeProductCandidate)
      .filter(Boolean);
    var normalizedWithPrice = normalized.filter(hasMeaningfulPrice);

    var latestHtml = html;
    if (!normalizedWithPrice.length && isLikelyLoadingShellHtml(latestHtml)) {
      var loadingAttempts = 0;
      var maxLoadingRetries = 2;

      while (!normalizedWithPrice.length && loadingAttempts < maxLoadingRetries) {
        await sleep(withJitter(Math.max(cooldownMs, 1200) * (loadingAttempts + 1)));
        var retryFetched = await fetchSearchPage(fallbackUrl, fetchImpl, runtimeSendMessage);
        if (!retryFetched.ok || !retryFetched.text) {
          break;
        }

        latestHtml = retryFetched.text;
        var retryParsed = parseCandidates(latestHtml);
        normalized = dedupeById(retryParsed.candidates || [])
          .map(normalizeProductCandidate)
          .filter(Boolean);
        normalizedWithPrice = normalized.filter(hasMeaningfulPrice);

        if (!isLikelyLoadingShellHtml(latestHtml)) {
          break;
        }

        loadingAttempts += 1;
      }
    }

    if (!normalizedWithPrice.length) {
      if (shouldReturnNoResults(latestHtml)) {
        return {
          ok: false,
          candidates: [],
          requestCount: 1,
          errorCode: "NO_RESULTS",
          retryAfterMs: 0,
          partial: true
        };
      }

      return {
        ok: false,
        candidates: [],
        requestCount: 1,
        errorCode: "PARSE_ERROR",
        retryAfterMs: 0,
        partial: true
      };
    }

    return {
      ok: true,
      candidates: normalizedWithPrice,
      requestCount: 1,
      partial: true
    };
  }

  function createDepopProvider(options) {
    var config = options && typeof options === "object" ? options : {};
    var fetchImpl = typeof config.fetchImpl === "function" ? config.fetchImpl : (typeof fetch === "function" ? fetch : null);
    var runtimeSendMessage =
      typeof config.runtimeSendMessage === "function"
        ? config.runtimeSendMessage
        : resolveRuntimeSendMessage();
    var maxRequests = Number.isFinite(Number(config.maxRequests)) ? Number(config.maxRequests) : 3;
    var cooldownMs = Number.isFinite(Number(config.cooldownMs)) ? Number(config.cooldownMs) : 1200;

    return {
      market: "depop",
      search: async function (input) {
        if (!fetchImpl && !runtimeSendMessage) {
          return {
            ok: false,
            candidates: [],
            fetchedAt: Date.now(),
            partial: false,
            sourceType: "html",
            parserVersion: PARSER_VERSION,
            errorCode: "NETWORK_ERROR",
            retryAfterMs: 1500
          };
        }

        var payload = input && typeof input === "object" ? input : {};
        var queries = Array.isArray(payload.queries) ? payload.queries.filter(Boolean) : [];
        var limit = Number.isFinite(Number(payload.limit)) ? Number(payload.limit) : 12;
        var requestTotal = 0;
        var partial = false;
        var merged = [];
        var blockedFallbackAttempted = false;
        var sourceType = "html";
        var sawNoResults = false;

        if (!queries.length) {
          return {
            ok: false,
            candidates: [],
            fetchedAt: Date.now(),
            partial: false,
            sourceType: "html",
            parserVersion: PARSER_VERSION,
            errorCode: "MISSING_LISTING_DATA",
            retryAfterMs: 0
          };
        }

        for (var i = 0; i < queries.length && requestTotal < maxRequests; i += 1) {
          var query = queries[i];
          var url = "https://www.depop.com/search/?q=" + encodeURIComponent(query);

          var fetched = await fetchSearchPage(url, fetchImpl, runtimeSendMessage);
          if (!fetched.ok && fetched.status === 0) {
            partial = true;
            continue;
          }

          requestTotal += 1;

          if (!fetched.ok) {
            if (requestTotal < maxRequests) {
              var apiOnHttpError = await tryApiSearch(query, payload, fetchImpl, runtimeSendMessage);
              requestTotal += apiOnHttpError.requestCount || 0;

              if (apiOnHttpError.ok) {
                merged = merged.concat(apiOnHttpError.candidates || []);
                partial = true;
                sourceType = "json";
                continue;
              }

              if (apiOnHttpError.errorCode === "NO_RESULTS") {
                sawNoResults = true;
                continue;
              }
            }

            var mapped = mapHttpError(fetched.status);
            if (mapped.errorCode === "FORBIDDEN_OR_BLOCKED" && !blockedFallbackAttempted) {
              blockedFallbackAttempted = true;
              var fallbackAttempt = await trySingleQueryFallback(
                fetchImpl,
                runtimeSendMessage,
                queries[0],
                cooldownMs
              );
              requestTotal += fallbackAttempt.requestCount || 0;

              if (fallbackAttempt.ok) {
                merged = merged.concat(fallbackAttempt.candidates || []);
                partial = true;
                break;
              }

              return {
                ok: false,
                candidates: [],
                fetchedAt: Date.now(),
                partial: true,
                sourceType: "html",
                parserVersion: PARSER_VERSION,
                errorCode: fallbackAttempt.errorCode || mapped.errorCode,
                retryAfterMs: normalizeNumber(fallbackAttempt.retryAfterMs) || mapped.retryAfterMs
              };
            }

            if (mapped.errorCode === "FORBIDDEN_OR_BLOCKED" || mapped.errorCode === "RATE_LIMITED") {
              return {
                ok: false,
                candidates: [],
                fetchedAt: Date.now(),
                partial: partial,
                sourceType: "html",
                parserVersion: PARSER_VERSION,
                errorCode: mapped.errorCode,
                retryAfterMs: mapped.retryAfterMs
              };
            }
            partial = true;
            continue;
          }

          var html = fetched.text;
          if (!html) {
            partial = true;
            continue;
          }

          var latestHtml = html;

          var parsed = parseCandidates(html);
          if (isBlockedHtml(html)) {
            return {
              ok: false,
              candidates: [],
              fetchedAt: Date.now(),
              partial: partial,
              sourceType: "html",
              parserVersion: PARSER_VERSION,
              errorCode: "FORBIDDEN_OR_BLOCKED",
              retryAfterMs: 120000
            };
          }

          var parsedCandidates = dedupeById(parsed.candidates || [])
            .map(normalizeProductCandidate)
            .filter(Boolean);
          var pricedParsedCandidates = parsedCandidates.filter(hasMeaningfulPrice);

          if (
            !pricedParsedCandidates.length &&
            isLikelyLoadingShellHtml(latestHtml) &&
            requestTotal + 1 < maxRequests
          ) {
            var loadingAttempts = 0;
            var maxLoadingRetries = 2;

            while (
              !pricedParsedCandidates.length &&
              loadingAttempts < maxLoadingRetries &&
              requestTotal + 1 < maxRequests
            ) {
              await sleep(withJitter(Math.max(cooldownMs, 1200) * (loadingAttempts + 1)));
              var retryFetched = await fetchSearchPage(url, fetchImpl, runtimeSendMessage);
              requestTotal += 1;

              if (!retryFetched.ok || !retryFetched.text) {
                partial = true;
                break;
              }

              latestHtml = retryFetched.text;
              if (isBlockedHtml(latestHtml)) {
                return {
                  ok: false,
                  candidates: [],
                  fetchedAt: Date.now(),
                  partial: partial,
                  sourceType: "html",
                  parserVersion: PARSER_VERSION,
                  errorCode: "FORBIDDEN_OR_BLOCKED",
                  retryAfterMs: 120000
                };
              }

              var retryParsed = parseCandidates(latestHtml);
              parsedCandidates = dedupeById(retryParsed.candidates || [])
                .map(normalizeProductCandidate)
                .filter(Boolean);
              pricedParsedCandidates = parsedCandidates.filter(hasMeaningfulPrice);

              if (!isLikelyLoadingShellHtml(latestHtml)) {
                break;
              }

              loadingAttempts += 1;
            }
          }

          if (!pricedParsedCandidates.length && requestTotal < maxRequests) {
            var apiFallback = await tryApiSearch(query, payload, fetchImpl, runtimeSendMessage);
            requestTotal += apiFallback.requestCount || 0;

            if (apiFallback.ok) {
              parsedCandidates = dedupeById(apiFallback.candidates || [])
                .map(normalizeProductCandidate)
                .filter(Boolean);
              pricedParsedCandidates = parsedCandidates.filter(hasMeaningfulPrice);
              sourceType = sourceType === "html" ? "hybrid" : sourceType;
            } else if (apiFallback.errorCode === "NO_RESULTS") {
              sawNoResults = true;
              continue;
            }
          }

          if (!pricedParsedCandidates.length && parsedCandidates.length && requestTotal < maxRequests) {
            var remainingBudget = Math.max(0, maxRequests - requestTotal);
            var enriched = await enrichHrefFallbackCandidates(
              parsedCandidates,
              fetchImpl,
              runtimeSendMessage,
              remainingBudget
            );

            requestTotal += enriched.requestCount || 0;
            pricedParsedCandidates = dedupeById(enriched.candidates || [])
              .map(normalizeProductCandidate)
              .filter(Boolean)
              .filter(hasMeaningfulPrice);
          }

          if (!pricedParsedCandidates.length && !hasAnyUsableCandidate(parsedCandidates) && shouldReturnNoResults(latestHtml)) {
            sawNoResults = true;
            continue;
          }

          if (!pricedParsedCandidates.length && hasAnyUsableCandidate(parsedCandidates)) {
            // Prefer priced candidates when available, but keep unpriced matches as a
            // better fallback than a false NO_RESULTS state.
            pricedParsedCandidates = parsedCandidates.filter(function (candidate) {
              var price = normalizeNumber(candidate && candidate.price);
              return price == null || price > 0;
            });
          }

          merged = merged.concat(pricedParsedCandidates);

          if (requestTotal < maxRequests && i < queries.length - 1) {
            await sleep(withJitter(cooldownMs));
          }
        }

        var normalized = dedupeById(merged)
          .slice(0, Math.max(1, limit));

        if (!normalized.length) {
          if (sawNoResults && queries.length) {
            var broadQuery = buildBroadFallbackQuery(queries[0]);
            if (broadQuery && broadQuery !== normalizeString(queries[0], "").toLowerCase()) {
              var broadUrl = "https://www.depop.com/search/?q=" + encodeURIComponent(broadQuery);
              var broadFetched = await fetchSearchPage(broadUrl, fetchImpl, runtimeSendMessage);
              requestTotal += 1;

              if (broadFetched.ok && broadFetched.text) {
                var broadParsed = parseCandidates(broadFetched.text);
                var broadCandidates = dedupeById(broadParsed.candidates || [])
                  .map(normalizeProductCandidate)
                  .filter(Boolean)
                  .filter(function (candidate) {
                    var price = normalizeNumber(candidate && candidate.price);
                    return price == null || price > 0;
                  });

                if (broadCandidates.length) {
                  return {
                    ok: true,
                    candidates: broadCandidates.slice(0, Math.max(1, limit)),
                    fetchedAt: Date.now(),
                    partial: true,
                    sourceType: sourceType,
                    parserVersion: PARSER_VERSION,
                    requestCount: requestTotal
                  };
                }
              }
            }
          }

          if (sawNoResults) {
            return {
              ok: false,
              candidates: [],
              fetchedAt: Date.now(),
              partial: partial,
              sourceType: "html",
              parserVersion: PARSER_VERSION,
              errorCode: "NO_RESULTS",
              retryAfterMs: 0
            };
          }

          return {
            ok: false,
            candidates: [],
            fetchedAt: Date.now(),
            partial: partial,
            sourceType: "html",
            parserVersion: PARSER_VERSION,
            errorCode: "PARSE_ERROR",
            retryAfterMs: 0
          };
        }

        return {
          ok: true,
          candidates: normalized,
          fetchedAt: Date.now(),
          partial: partial,
          sourceType: sourceType,
          parserVersion: PARSER_VERSION,
          requestCount: requestTotal
        };
      }
    };
  }

  return {
    PARSER_VERSION: PARSER_VERSION,
    parseCandidates: parseCandidates,
    createDepopProvider: createDepopProvider,
    mapHttpError: mapHttpError
  };
});
