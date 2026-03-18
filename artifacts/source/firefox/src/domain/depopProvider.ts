(function (root: any, factory: any) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusDepopProvider = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PARSER_VERSION = "depop-hybrid-v2";

  var KNOWN_CURRENCY_CODES: Record<string, boolean> = {
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

  var CURRENCY_SYMBOL_MAP: Record<string, string> = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "A$": "AUD",
    "C$": "CAD"
  };
  var RUNTIME_FETCH_MESSAGE_TYPE = "grailed-plus:depop-search-fetch";
  var RUNTIME_FETCH_MESSAGE_VERSION = 1;
  var DEFAULT_FETCH_TIMEOUT_MS = 20000;

  function isObjectRecord(value: any): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object";
  }

  function normalizeString(value: any, fallback: any) {
    if (typeof value === "string") {
      var trimmed = value.trim();
      return trimmed || fallback;
    }
    return fallback;
  }

  function normalizeUrlString(value: any) {
    var raw = normalizeString(value, "");
    if (!raw) {
      return "";
    }

    if (raw.indexOf("//") === 0) {
      return "https:" + raw;
    }

    if (raw.indexOf("/") === 0) {
      return "https://www.depop.com" + raw;
    }

    return raw;
  }

  function normalizeNumber(value: any) {
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

  function normalizeCurrencyCode(value: any) {
    if (typeof value !== "string") {
      return null;
    }

    var upper = value.trim().toUpperCase();
    if (!upper || !KNOWN_CURRENCY_CODES[upper]) {
      return null;
    }
    return upper;
  }

  function inferCurrencyFromLabel(label: any) {
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

  function parseAmountFromLabel(label: any) {
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

  function tryParseJsonLenient(text: any) {
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

  function sleep(ms: any) {
    return new Promise(function (resolve) {
      setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  function normalizeBoolean(value: any) {
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

  function withJitter(ms: any) {
    var base = Math.max(0, Number(ms) || 0);
    var variance = base * 0.1;
    var delta = (Math.random() * variance * 2) - variance;
    return Math.max(0, Math.round(base + delta));
  }

  function mapHttpError(status: any) {
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

  type DepopAttemptFailure = {
    ok: false;
    requestCount: number;
    errorCode: any;
    retryAfterMs: any;
  };

  type DepopAttemptSuccess = {
    ok: true;
    requestCount: number;
    candidates: any;
  };

  type DepopAttemptResult = DepopAttemptFailure | DepopAttemptSuccess;
  type DepopDebugLogger = (stage: string, payload?: Record<string, unknown>) => void;

  function summarizeDepopCandidate(candidate: any) {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }

    return {
      id: normalizeString(candidate.id, ""),
      title: normalizeString(candidate.title, ""),
      price: normalizeNumber(candidate.price),
      currency: normalizeCurrencyCode(candidate.currency) || "USD",
      imageUrl: normalizeUrlString(candidate.imageUrl || candidate.image)
    };
  }

  function normalizeTitleCandidate(value: any) {
    var title = normalizeString(value, "");
    if (!title) {
      return "";
    }
    return title.replace(/\s+/g, " ").trim();
  }

  function buildTitleFromDescription(description: any) {
    var text = normalizeString(description, "");
    if (!text) {
      return "";
    }

    var cleaned = text
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/[@#][\w-]+/g, " ")
      .replace(/[\"'`]/g, " ")
      .replace(/[^a-zA-Z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) {
      return "";
    }

    var tokens = cleaned.split(" ").filter(function (token: any) {
      if (!token) {
        return false;
      }
      var lowered = token.toLowerCase();
      if (lowered.length < 3 && !/^\d+$/.test(lowered)) {
        return false;
      }
      return !(
        lowered === "the" ||
        lowered === "and" ||
        lowered === "with" ||
        lowered === "for" ||
        lowered === "this" ||
        lowered === "that" ||
        lowered === "from" ||
        lowered === "like" ||
        lowered === "very" ||
        lowered === "super" ||
        lowered === "size" ||
        lowered === "brand" ||
        lowered === "item" ||
        lowered === "listing" ||
        lowered === "sale" ||
        lowered === "good" ||
        lowered === "great" ||
        lowered === "excellent" ||
        lowered === "amazing" ||
        lowered === "nice" ||
        lowered === "new" ||
        lowered === "authentic" ||
        lowered === "original" ||
        lowered === "tags" ||
        lowered === "tag" ||
        lowered === "worn" ||
        lowered === "wear" ||
        lowered === "condition"
      );
    });

    if (!tokens.length) {
      return "";
    }

    return tokens.slice(0, 8).join(" ");
  }

  function splitSlugTokens(value: any) {
    var text = normalizeSlugToken(value);
    if (!text) {
      return [];
    }

    return text.split("-").filter(Boolean);
  }

  function inferUsernameTokensFromSlug(slug: any) {
    var rawSlug = normalizeString(slug, "");
    if (!rawSlug) {
      return [];
    }

    var firstSegment = rawSlug.split("-")[0] || "";
    if (firstSegment.indexOf("_") !== -1) {
      return splitSlugTokens(firstSegment);
    }

    var slugTokens = splitSlugTokens(rawSlug);
    if (slugTokens.length >= 4) {
      return [slugTokens[0]];
    }

    return [];
  }

  function normalizeSlugToken(value: any) {
    var text = normalizeString(value, "");
    if (!text) {
      return "";
    }

    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  }

  var CANDIDATE_USERNAME_PATHS = [
    ["username"],
    ["seller", "username"],
    ["raw", "username"],
    ["raw", "seller", "username"],
    ["raw", "author", "username"],
    ["raw", "user", "username"]
  ];

  var CANDIDATE_IMAGE_URL_PATHS = [
    ["imageUrl"],
    ["image_url"],
    ["preview", "150"],
    ["preview", 150],
    ["preview", "300"],
    ["preview", 300],
    ["preview", "450"],
    ["preview", 450],
    ["preview", "600"],
    ["preview", 600],
    ["previewUrl"],
    ["preview_url"],
    ["image", "url"],
    ["images", 0, "url"],
    ["images", 0, "image_url"],
    ["pictures", 0, "url"],
    ["pictures", 0, "image_url"],
    ["pictures_data", 0, "sizes", "P0", "url"],
    ["pictures_data", 0, "sizes", "P1", "url"],
    ["photo", "url"],
    ["photos", 0, "url"],
    ["primary_photo", "url"],
    ["thumbnail", "url"],
    ["cover_photo", "url"]
  ];

  var RAW_DESCRIPTION_PATHS = [["raw", "description"], ["raw", "caption"]];
  var FLIGHT_SLUG_PATHS = [["slug"], ["seo", "slug"]];
  var FLIGHT_URL_PATHS = [["url"], ["path"], ["route"]];
  var FLIGHT_ID_PATHS = [["id"], ["productId"], ["product_id"], ["slug"]];
  var FLIGHT_AMOUNT_PATHS = [
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
  ];
  var FLIGHT_CENTS_PATHS = [
    ["priceCents"],
    ["price_cents"],
    ["price", "amountCents"],
    ["price", "amount_cents"],
    ["pricing", "price", "amount_cents"],
    ["pricing", "discounted_price", "amount_cents"],
    ["pricing", "discountedPrice", "amount_cents"]
  ];
  var FLIGHT_TITLE_PATHS = [["title"], ["name"], ["description"]];
  var FLIGHT_DESCRIPTION_PATHS = [["description"], ["caption"], ["item_description"], ["attributes", "description"]];
  var FLIGHT_CURRENCY_PATHS = [
    ["currency"],
    ["price", "currency"],
    ["priceInfo", "currency"],
    ["pricing", "currency"],
    ["pricing", "currency_name"],
    ["pricing", "price", "currency"],
    ["pricing", "discounted_price", "currency"],
    ["pricing", "discountedPrice", "currency"]
  ];
  var API_CANDIDATE_ID_PATHS = [["id"], ["product_id"], ["productId"], ["slug"]];
  var API_CANDIDATE_URL_PATHS = [["url"], ["path"], ["permalink"], ["route"]];
  var API_CANDIDATE_PRICE_PATHS = [["price"], ["price_amount"], ["priceAmount"], ["price", "amount"]];

  function extractCandidateUsername(input: any) {
    return pickStringValue(input, CANDIDATE_USERNAME_PATHS, "");
  }

  function buildTitleFromUrl(url: any, username: any) {
    var normalizedUrl = normalizeUrlString(url);
    if (!normalizedUrl) {
      return "";
    }

    var slug = normalizedUrl
      .split("/")
      .filter(Boolean)
      .pop();

    if (!slug) {
      return "";
    }

    var slugTokens = splitSlugTokens(slug);
    var usernameTokens = splitSlugTokens(username);
    if (!usernameTokens.length) {
      usernameTokens = inferUsernameTokensFromSlug(slug);
    }

    var consumed = 0;
    while (
      consumed < usernameTokens.length &&
      consumed < slugTokens.length &&
      normalizeSlugToken(slugTokens[consumed]) === normalizeSlugToken(usernameTokens[consumed])
    ) {
      consumed += 1;
    }

    if (consumed > 0 && slugTokens.length - consumed >= 2) {
      slugTokens = slugTokens.slice(consumed);
    }

    if (!slugTokens.length) {
      return "";
    }

    return slugTokens.join(" ").trim();
  }

  function stripUsernameFromTitlePrefix(title: any, url: any, input: any) {
    var normalizedTitle = normalizeTitleCandidate(title);
    if (!normalizedTitle) {
      return "";
    }

    var rawTitleTokens = normalizedTitle.split(/\s+/).filter(Boolean);
    if (rawTitleTokens.length >= 3) {
      var firstToken = rawTitleTokens[0].replace(/^@+/, "");
      if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(firstToken)) {
        return rawTitleTokens.slice(1).join(" ");
      }
    }

    var titleTokens = normalizedTitle
      .replace(/[_-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (titleTokens.length < 2) {
      return normalizedTitle;
    }

    var usernameTokens = splitSlugTokens(extractCandidateUsername(input));
    if (!usernameTokens.length) {
      var normalizedUrl = normalizeUrlString(url);
      var slug = normalizedUrl
        .split("/")
        .filter(Boolean)
        .pop();
      usernameTokens = inferUsernameTokensFromSlug(slug);
    }

    if (!usernameTokens.length) {
      return normalizedTitle;
    }

    var consumed = 0;
    while (
      consumed < usernameTokens.length &&
      consumed < titleTokens.length &&
      normalizeSlugToken(titleTokens[consumed]) === normalizeSlugToken(usernameTokens[consumed])
    ) {
      consumed += 1;
    }

    if (consumed === 0 || titleTokens.length - consumed < 2) {
      return normalizedTitle;
    }

    return titleTokens.slice(consumed).join(" ");
  }

  function pickCandidateImageUrl(input: any) {
    return pickUrlValue(input, CANDIDATE_IMAGE_URL_PATHS);
  }

  function resolveCandidateTitle(input: any, url: any) {
    var explicitTitle = normalizeTitleCandidate(input && input.title);
    if (explicitTitle && explicitTitle.toLowerCase() !== "untitled") {
      return stripUsernameFromTitlePrefix(explicitTitle, url, input);
    }

    var descriptionTitle = buildTitleFromDescription(
      normalizeString(input && input.description, "") ||
      pickStringValue(input, RAW_DESCRIPTION_PATHS, "")
    );
    if (descriptionTitle) {
      return descriptionTitle;
    }

    var urlTitle = buildTitleFromUrl(url, extractCandidateUsername(input));
    if (urlTitle) {
      return urlTitle;
    }

    return "Untitled";
  }

  function normalizeProductCandidate(candidate: any) {
    var input = candidate && typeof candidate === "object" ? candidate : {};
    var isHrefFallback = Boolean(input && input.raw && input.raw.source === "href_fallback");
    var id = normalizeString(input.id, null);
    var url = normalizeUrlString(input.url);
    var title = resolveCandidateTitle(input, url);
    var imageUrl = normalizeUrlString(input.imageUrl);
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

  function extractFromJsonLd(html: any) {
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
              description: normalizeString(node.description, ""),
              url: normalizeUrlString(node.url),
              imageUrl: normalizeUrlString(Array.isArray(node.image) ? normalizeString(node.image[0], "") : normalizeString(node.image, "")),
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

  function getNestedValue(source: any, paths: any) {
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

  function pickStringValue(source: any, paths: any, fallback: any) {
    return normalizeString(getNestedValue(source, paths), fallback);
  }

  function pickUrlValue(source: any, paths: any) {
    return normalizeUrlString(getNestedValue(source, paths));
  }

  function pickNumberValue(source: any, paths: any) {
    return normalizeNumber(getNestedValue(source, paths));
  }

  function readBalancedJsonArray(text: any, startIndex: any) {
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

  function normalizeFlightText(raw: any) {
    if (!raw) {
      return "";
    }
    return raw
      .replace(/\\\"/g, '"')
      .replace(/\\n/g, " ")
      .replace(/\\t/g, " ");
  }

  function pickPricingAmount(input: any) {
    var pricing = getNestedValue(input, [["pricing"]]);
    if (!pricing || typeof pricing !== "object") {
      return null;
    }

    var finalPriceKey = normalizeString(getNestedValue(pricing, [["final_price_key"]]), "");
    var finalPriceKeyAmountPaths = finalPriceKey
      ? [
          ["pricing", finalPriceKey, "total_price"],
          ["pricing", finalPriceKey, "price_breakdown", "price", "amount"],
          ["pricing", finalPriceKey, "amount"]
        ]
      : [];

    return normalizeNumber(
      getNestedValue(input, finalPriceKeyAmountPaths.concat([
        ["pricing", "discounted_price", "total_price"],
        ["pricing", "discounted_price", "price_breakdown", "price", "amount"],
        ["pricing", "original_price", "total_price"],
        ["pricing", "original_price", "price_breakdown", "price", "amount"]
      ]))
    );
  }

  function mapFlightProduct(product: any) {
    var input = product && typeof product === "object" ? product : {};
    var slug = pickStringValue(input, FLIGHT_SLUG_PATHS, "");
    var url = pickUrlValue(input, FLIGHT_URL_PATHS) || pickUrlValue(input, [["permalink"]]);

    if (!url && slug) {
      url = "https://www.depop.com/products/" + slug + "/";
    }

    var id =
      pickStringValue(input, FLIGHT_ID_PATHS, null) ||
      (url ? normalizeString(url.split("/").filter(Boolean).pop(), null) : null);

    var imageUrl = pickCandidateImageUrl(input) || "";

    var amount = normalizeNumber(input.price);
    if (amount == null) {
      amount = pickNumberValue(input, FLIGHT_AMOUNT_PATHS);
    }

    if (amount == null) {
      amount = pickPricingAmount(input);
    }

    var cents = pickNumberValue(input, FLIGHT_CENTS_PATHS);

    if (amount == null && cents != null) {
      amount = cents / 100;
    }

    return normalizeProductCandidate({
      id: id,
      title: pickStringValue(input, FLIGHT_TITLE_PATHS, "Untitled"),
      description: pickStringValue(input, FLIGHT_DESCRIPTION_PATHS, ""),
      url: url,
      imageUrl: imageUrl,
      price: amount,
      currency: pickStringValue(input, FLIGHT_CURRENCY_PATHS, "USD"),
      raw: input
    });
  }

  function walkJsonTree(node: any, visitor: any) {
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

  function parseCandidatesFromApiPayload(payload: any) {
    var candidates: any[] = [];
    var seen = Object.create(null);

    walkJsonTree(payload, function (node: any) {
      if (!node || typeof node !== "object" || Array.isArray(node)) {
        return;
      }

      var maybeId = getNestedValue(node, API_CANDIDATE_ID_PATHS);
      var maybeUrl = getNestedValue(node, API_CANDIDATE_URL_PATHS);
      var maybePrice = getNestedValue(node, API_CANDIDATE_PRICE_PATHS);

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

  function hasNoResultsInApiPayload(payload: any) {
    var foundZero = false;

    walkJsonTree(payload, function (node: any) {
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

  function extractFromNextFlightPayload(html: any) {
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

    var candidates: any[] = [];
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

  function extractFromNextDataPayload(html: any) {
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

  function extractFromHrefFallback(html: any) {
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

  function getCandidateExtractionStrategies() {
    return [
      {
        extract: extractFromJsonLd,
        parserMismatchLikely: false
      },
      {
        extract: extractFromNextFlightPayload,
        parserMismatchLikely: false
      },
      {
        extract: extractFromNextDataPayload,
        parserMismatchLikely: false
      },
      {
        extract: extractFromHrefFallback,
        parserMismatchLikely: true
      }
    ];
  }

  function parseCandidates(html: any) {
    if (typeof html !== "string" || !html.trim()) {
      return {
        candidates: [],
        parserMismatchLikely: true
      };
    }

    var strategies = getCandidateExtractionStrategies();
    for (var i = 0; i < strategies.length; i += 1) {
      var strategy = strategies[i];
      var candidates = strategy.extract(html);
      if (candidates.length) {
        return {
          candidates: candidates,
          parserMismatchLikely: strategy.parserMismatchLikely
        };
      }
    }

    return {
      candidates: [],
      parserMismatchLikely: true
    };
  }

  function hasProductResultsMarker(html: any) {
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

  function isBlockedHtml(html: any) {
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

  function isLikelyLoadingShellHtml(html: any) {
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

  function hasNoResultsMarker(html: any) {
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

  function shouldReturnNoResults(html: any) {
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

  function dedupeById(candidates: any) {
    function mergeDuplicateCandidate(existingCandidate: any, incomingCandidate: any) {
      var existing = existingCandidate && typeof existingCandidate === "object" ? existingCandidate : {};
      var incoming = incomingCandidate && typeof incomingCandidate === "object" ? incomingCandidate : {};
      var merged = Object.assign({}, existing);

      var existingImageUrl = normalizeUrlString(existing.imageUrl);
      var incomingImageUrl = normalizeUrlString(incoming.imageUrl);
      if (!existingImageUrl && incomingImageUrl) {
        merged.imageUrl = incomingImageUrl;
      }

      var existingUrl = normalizeUrlString(existing.url);
      var incomingUrl = normalizeUrlString(incoming.url);
      if (!existingUrl && incomingUrl) {
        merged.url = incomingUrl;
      }

      var existingTitle = normalizeString(existing.title, "");
      var incomingTitle = normalizeString(incoming.title, "");
      if ((!existingTitle || existingTitle.toLowerCase() === "untitled") && incomingTitle) {
        merged.title = incomingTitle;
      }

      var existingPrice = normalizeNumber(existing.price);
      var incomingPrice = normalizeNumber(incoming.price);
      if ((existingPrice == null || existingPrice <= 0) && incomingPrice != null && incomingPrice > 0) {
        merged.price = incomingPrice;
      }

      if (!normalizeString(existing.currency, "") && normalizeString(incoming.currency, "")) {
        merged.currency = incoming.currency;
      }

      if (!merged.raw && incoming.raw) {
        merged.raw = incoming.raw;
      }

      return merged;
    }

    var indexById = Object.create(null);
    var output: any[] = [];

    (Array.isArray(candidates) ? candidates : []).forEach(function (candidate: any) {
      var id = normalizeString(candidate && candidate.id, "");
      if (!id) {
        return;
      }

      if (typeof indexById[id] === "number") {
        var existingIndex = indexById[id];
        output[existingIndex] = mergeDuplicateCandidate(output[existingIndex], candidate);
        return;
      }

      indexById[id] = output.length;
      output.push(candidate);
    });

    return output;
  }

  function hasMeaningfulPrice(candidate: any) {
    var price = normalizeNumber(candidate && candidate.price);
    return price != null && price > 0;
  }

  function hasAnyUsableCandidate(candidates: any) {
    return Array.isArray(candidates) && candidates.some(function (candidate) {
      return Boolean(candidate && normalizeString(candidate.id, "") && normalizeString(candidate.url, ""));
    });
  }

  function buildBroadFallbackQuery(query: any) {
    var text = normalizeString(query, "").toLowerCase();
    if (!text) {
      return "";
    }

    var tokens = text
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(function (token: any) {
        return token && token.length > 1;
      });

    if (!tokens.length) {
      return "";
    }

    return tokens.slice(0, 2).join(" ");
  }

  function resolveRuntimeSendMessage() {
    var chromeRuntime =
      typeof chrome !== "undefined" && chrome && chrome.runtime ? (chrome.runtime as any) : null;
    if (chromeRuntime && typeof chromeRuntime.sendMessage === "function") {
      return function (payload: any) {
        return new Promise(function (resolve) {
          try {
            chromeRuntime.sendMessage(payload, function (response: any) {
              resolve(response || null);
            });
          } catch (_) {
            resolve(null);
          }
        });
      };
    }

    var browserRuntime =
      typeof browser !== "undefined" && browser && browser.runtime ? (browser.runtime as any) : null;
    if (browserRuntime && typeof browserRuntime.sendMessage === "function") {
      return function (payload: any) {
        return Promise.resolve(browserRuntime.sendMessage(payload)).catch(function () {
          return null;
        });
      };
    }

    return null;
  }

  function isValidRuntimeFetchResponse(value: any) {
    if (!isObjectRecord(value)) {
      return false;
    }

    if (typeof value.ok !== "boolean") {
      return false;
    }

    if (!Number.isFinite(Number(value.status))) {
      return false;
    }

    if (typeof value.text !== "string") {
      return false;
    }

    if (value.error != null && typeof value.error !== "string") {
      return false;
    }

    return true;
  }

  function buildApiSearchUrl(query: any, payload: any) {
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

  async function fetchSearchPage(url: any, fetchImpl: any, runtimeSendMessage: any, acceptHeader: any = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", timeoutMs: any = DEFAULT_FETCH_TIMEOUT_MS) {
    var accept = normalizeString(acceptHeader, "") || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
    var timeout = Math.max(100, Number(timeoutMs) || DEFAULT_FETCH_TIMEOUT_MS);

    if (typeof runtimeSendMessage === "function") {
      var runtimeResult = await Promise.race([
        Promise.resolve(runtimeSendMessage({
          type: RUNTIME_FETCH_MESSAGE_TYPE,
          v: RUNTIME_FETCH_MESSAGE_VERSION,
          url: url,
          accept: accept
        }))
          .then(function (value) {
            return {
              timedOut: false,
              value: value
            };
          })
          .catch(function () {
            return {
              timedOut: false,
              value: null
            };
          }),
        sleep(timeout).then(function () {
          return {
            timedOut: true,
            value: null
          };
        })
      ]);

      if (runtimeResult && runtimeResult.timedOut) {
        return {
          ok: false,
          status: 0,
          text: "",
          source: "runtime"
        };
      }

      if (isValidRuntimeFetchResponse(runtimeResult && runtimeResult.value)) {
        return {
          ok: Boolean(runtimeResult.value.ok),
          status: Number(runtimeResult.value.status) || 0,
          text: normalizeString(runtimeResult.value.text, ""),
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
      var abortController = typeof AbortController === "function" ? new AbortController() : null;
      var timeoutId =
        abortController && typeof setTimeout === "function"
          ? setTimeout(function () {
              var controller = abortController;
              try {
                if (controller) {
                  controller.abort();
                }
              } catch (_) {
                // Ignore abort failures.
              }
            }, timeout)
          : null;

      var response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: accept
          },
          signal: abortController ? abortController.signal : undefined
        });
      } finally {
        if (timeoutId != null && typeof clearTimeout === "function") {
          clearTimeout(timeoutId);
        }
      }

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
    } catch (error: any) {
      if (error && error.name === "AbortError") {
        return {
          ok: false,
          status: 0,
          text: "",
          source: "fetch"
        };
      }

      return {
        ok: false,
        status: 0,
        text: "",
        source: "fetch"
      };
    }
  }

  async function tryApiSearch(
    query: any,
    payload: any,
    fetchImpl: any,
    runtimeSendMessage: any,
    timeoutMs: any,
    debugLogger?: DepopDebugLogger | null
  ) {
    var debugLog = typeof debugLogger === "function" ? debugLogger : function () {};
    function buildAttemptFailure(errorCode: any, retryAfterMs: any): DepopAttemptFailure {
      return {
        ok: false,
        requestCount: 1,
        errorCode: errorCode,
        retryAfterMs: retryAfterMs
      };
    }

    function buildAttemptSuccess(candidates: any): DepopAttemptSuccess {
      return {
        ok: true,
        requestCount: 1,
        candidates: candidates
      };
    }

    var apiUrl = buildApiSearchUrl(query, payload);
    debugLog("provider.api_search_start", {
      query: normalizeString(query, ""),
      url: apiUrl
    });
    var fetched = await fetchSearchPage(
      apiUrl,
      fetchImpl,
      runtimeSendMessage,
      "application/json,text/plain,*/*",
      timeoutMs
    );
    debugLog("provider.api_search_result", {
      query: normalizeString(query, ""),
      url: apiUrl,
      ok: Boolean(fetched && fetched.ok),
      status: Number(fetched && fetched.status) || 0,
      transport: normalizeString(fetched && fetched.source, ""),
      textLength: normalizeString(fetched && fetched.text, "").length
    });

    if (!fetched.ok) {
      if (fetched.status === 0) {
        debugLog("provider.api_search_failure", {
          query: normalizeString(query, ""),
          errorCode: "NETWORK_ERROR"
        });
        return buildAttemptFailure("NETWORK_ERROR", 1500);
      }

      var mappedError = mapHttpError(fetched.status);
      debugLog("provider.api_search_failure", {
        query: normalizeString(query, ""),
        errorCode: mappedError.errorCode,
        retryAfterMs: mappedError.retryAfterMs
      });
      return buildAttemptFailure(mappedError.errorCode, mappedError.retryAfterMs);
    }

    var text = normalizeString(fetched.text, "");
    if (!text) {
      return buildAttemptFailure("PARSE_ERROR", 0);
    }

    var parsed = tryParseJsonLenient(text);
    if (!parsed) {
      // Some edge responses are HTML/challenge content even on API routes.
      // Reuse HTML parser before treating it as a hard parse failure.
      var htmlCandidates = parseHtmlCandidateState(text, null).candidates;

      if (htmlCandidates.length) {
        debugLog("provider.api_search_html_fallback", {
          query: normalizeString(query, ""),
          candidateCount: htmlCandidates.length,
          topCandidate: summarizeDepopCandidate(htmlCandidates[0] || null)
        });
        return buildAttemptSuccess(htmlCandidates);
      }

      debugLog("provider.api_search_failure", {
        query: normalizeString(query, ""),
        errorCode: "PARSE_ERROR"
      });
      return buildAttemptFailure("PARSE_ERROR", 0);
    }

    var candidates = normalizeParsedCandidates(parseCandidatesFromApiPayload(parsed) || []);

    if (candidates.length) {
      debugLog("provider.api_search_success", {
        query: normalizeString(query, ""),
        candidateCount: candidates.length,
        topCandidate: summarizeDepopCandidate(candidates[0] || null)
      });
      return buildAttemptSuccess(candidates);
    }

    if (hasNoResultsInApiPayload(parsed)) {
      debugLog("provider.api_search_failure", {
        query: normalizeString(query, ""),
        errorCode: "NO_RESULTS"
      });
      return buildAttemptFailure("NO_RESULTS", 0);
    }

    debugLog("provider.api_search_failure", {
      query: normalizeString(query, ""),
      errorCode: "PARSE_ERROR"
    });
    return buildAttemptFailure("PARSE_ERROR", 0);
  }

  function normalizeParsedCandidates(candidates: any) {
    return dedupeById(candidates || [])
      .map(normalizeProductCandidate)
      .filter(Boolean);
  }

  function parseHtmlCandidateState(html: any, normalizeCandidates: any) {
    var parsed = parseCandidates(html);
    var candidates = typeof normalizeCandidates === "function"
      ? normalizeCandidates(parsed.candidates || [])
      : normalizeParsedCandidates(parsed.candidates || []);

    return {
      parsed: parsed,
      candidates: candidates,
      candidatesWithPrice: candidates.filter(hasMeaningfulPrice)
    };
  }

  async function retryLoadingShellCandidates(options: any) {
    var input = options && typeof options === "object" ? options : {};
    var url = normalizeString(input.url, "");
    var latestHtml = normalizeString(input.html, "");
    var fetchImpl = input.fetchImpl;
    var runtimeSendMessage = input.runtimeSendMessage;
    var normalizeCandidates = input.normalizeCandidates;
    var timeoutMs = input.timeoutMs;
    var maxRetries = Math.max(0, Number(input.maxRetries) || 0);
    var maxAdditionalRequests = Math.max(0, Number(input.maxAdditionalRequests) || 0);
    var cooldownBaseMs = Math.max(Number(input.cooldownMs) || 0, 1200);
    var debugLog = typeof input.debugLogger === "function" ? input.debugLogger : function () {};
    var requestCount = 0;
    var loadingAttempts = 0;
    var sawNetworkError = false;
    var blocked = isBlockedHtml(latestHtml);
    var candidateState = parseHtmlCandidateState(latestHtml, normalizeCandidates);

    while (
      !blocked &&
      !candidateState.candidatesWithPrice.length &&
      isLikelyLoadingShellHtml(latestHtml) &&
      loadingAttempts < maxRetries &&
      requestCount < maxAdditionalRequests
    ) {
      debugLog("provider.loading_shell_retry_wait", {
        url: url,
        attempt: loadingAttempts + 1
      });
      await sleep(withJitter(cooldownBaseMs * (loadingAttempts + 1)));
      var retryFetched = await fetchSearchPage(url, fetchImpl, runtimeSendMessage, undefined, timeoutMs);
      requestCount += 1;
      debugLog("provider.loading_shell_retry_result", {
        url: url,
        attempt: loadingAttempts + 1,
        ok: Boolean(retryFetched && retryFetched.ok),
        status: Number(retryFetched && retryFetched.status) || 0,
        transport: normalizeString(retryFetched && retryFetched.source, ""),
        textLength: normalizeString(retryFetched && retryFetched.text, "").length
      });

      if (!retryFetched.ok || !retryFetched.text) {
        if (!retryFetched.ok && retryFetched.status === 0) {
          sawNetworkError = true;
        }
        break;
      }

      latestHtml = retryFetched.text;
      blocked = isBlockedHtml(latestHtml);
      if (blocked) {
        break;
      }

      candidateState = parseHtmlCandidateState(latestHtml, normalizeCandidates);
      loadingAttempts += 1;
    }

    return {
      latestHtml: latestHtml,
      candidateState: candidateState,
      requestCount: requestCount,
      sawNetworkError: sawNetworkError,
      blocked: blocked
    };
  }

  async function enrichHrefFallbackCandidates(
    candidates: any,
    fetchImpl: any,
    runtimeSendMessage: any,
    maxFetches: any,
    timeoutMs: any,
    normalizeCandidates: any,
    debugLogger?: DepopDebugLogger | null
  ) {
    var list = Array.isArray(candidates) ? candidates : [];
    var fetchBudget = Math.max(0, Number(maxFetches) || 0);
    var debugLog = typeof debugLogger === "function" ? debugLogger : function () {};
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

      debugLog("provider.href_enrichment_fetch_start", {
        url: url,
        attempt: requestCount + 1
      });
      var fetched = await fetchSearchPage(url, fetchImpl, runtimeSendMessage, undefined, timeoutMs);
      requestCount += 1;
      debugLog("provider.href_enrichment_fetch_result", {
        url: url,
        ok: Boolean(fetched && fetched.ok),
        status: Number(fetched && fetched.status) || 0,
        transport: normalizeString(fetched && fetched.source, ""),
        textLength: normalizeString(fetched && fetched.text, "").length
      });
      if (!fetched.ok || !fetched.text) {
        continue;
      }

      var candidateState = parseHtmlCandidateState(fetched.text, normalizeCandidates);
      var normalized = candidateState.candidatesWithPrice;

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
      debugLog("provider.href_enrichment_candidate_added", {
        url: url,
        candidate: summarizeDepopCandidate(best)
      });
    }

    return {
      candidates: output,
      requestCount: requestCount
    };
  }

  async function trySingleQueryFallback(
    fetchImpl: any,
    runtimeSendMessage: any,
    query: any,
    cooldownMs: any,
    timeoutMs: any,
    debugLogger?: DepopDebugLogger | null
  ) {
    var debugLog = typeof debugLogger === "function" ? debugLogger : function () {};
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
    debugLog("provider.single_query_fallback_start", {
      query: fallbackQuery,
      url: fallbackUrl
    });
    var fetched = await fetchSearchPage(fallbackUrl, fetchImpl, runtimeSendMessage, undefined, timeoutMs);
    debugLog("provider.single_query_fallback_result", {
      query: fallbackQuery,
      url: fallbackUrl,
      ok: Boolean(fetched && fetched.ok),
      status: Number(fetched && fetched.status) || 0,
      transport: normalizeString(fetched && fetched.source, ""),
      textLength: normalizeString(fetched && fetched.text, "").length
    });

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

    var latestHtml = html;
    var candidateState = parseHtmlCandidateState(html, null);
    if (!candidateState.candidatesWithPrice.length && isLikelyLoadingShellHtml(latestHtml)) {
      var retried = await retryLoadingShellCandidates({
        url: fallbackUrl,
        html: latestHtml,
        fetchImpl: fetchImpl,
        runtimeSendMessage: runtimeSendMessage,
        normalizeCandidates: null,
        cooldownMs: cooldownMs,
        timeoutMs: timeoutMs,
        maxRetries: 2,
        maxAdditionalRequests: 2,
        debugLogger: debugLog
      });

      latestHtml = retried.latestHtml;
      candidateState = retried.candidateState;
    }

    if (!candidateState.candidatesWithPrice.length) {
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
      candidates: candidateState.candidatesWithPrice,
      requestCount: 1,
      partial: true
    };
  }

  function createDepopProvider(options: any) {
    var config = options && typeof options === "object" ? options : {};
    var fetchImpl = typeof config.fetchImpl === "function" ? config.fetchImpl : (typeof fetch === "function" ? fetch : null);
    var runtimeSendMessage =
      typeof config.runtimeSendMessage === "function"
        ? config.runtimeSendMessage
        : resolveRuntimeSendMessage();
    var maxRequests = Number.isFinite(Number(config.maxRequests)) ? Number(config.maxRequests) : 3;
    var cooldownMs = Number.isFinite(Number(config.cooldownMs)) ? Number(config.cooldownMs) : 1200;
    var fetchTimeoutMs =
      Number.isFinite(Number(config.fetchTimeoutMs)) && Number(config.fetchTimeoutMs) > 0
        ? Math.max(100, Number(config.fetchTimeoutMs))
        : DEFAULT_FETCH_TIMEOUT_MS;
    var debugLog = typeof config.debugLogger === "function" ? config.debugLogger : function () {};
    var imageUrlCache: Record<string, string> = Object.create(null);

    function getCandidateCacheKeys(candidate: any) {
      var keys = [];
      var id = normalizeString(candidate && candidate.id, "");
      if (id) {
        keys.push("id:" + id.toLowerCase());
      }

      var normalizedUrl = normalizeUrlString(candidate && candidate.url);
      if (normalizedUrl) {
        keys.push("url:" + normalizedUrl.toLowerCase());
        var slug = normalizedUrl
          .split("/")
          .filter(Boolean)
          .pop();
        var normalizedSlug = normalizeSlugToken(slug);
        if (normalizedSlug) {
          keys.push("slug:" + normalizedSlug);
        }
      }

      return keys;
    }

    function applyImageUrlCache(candidate: any) {
      if (!candidate || typeof candidate !== "object") {
        return candidate;
      }

      var keys = getCandidateCacheKeys(candidate);
      if (!keys.length) {
        return candidate;
      }

      var imageUrl = normalizeUrlString(candidate.imageUrl);
      if (imageUrl) {
        for (var i = 0; i < keys.length; i += 1) {
          imageUrlCache[keys[i]] = imageUrl;
        }
        candidate.imageUrl = imageUrl;
        return candidate;
      }

      for (var j = 0; j < keys.length; j += 1) {
        if (imageUrlCache[keys[j]]) {
          candidate.imageUrl = imageUrlCache[keys[j]];
          break;
        }
      }

      return candidate;
    }

    function normalizeAndHydrateCandidates(candidates: any) {
      return dedupeById(candidates || [])
        .map(normalizeProductCandidate)
        .filter(Boolean)
        .map(applyImageUrlCache);
    }

    function summarizeCandidateList(candidates: any) {
      var list = Array.isArray(candidates) ? candidates : [];
      return {
        candidateCount: list.length,
        pricedCandidateCount: list.filter(hasMeaningfulPrice).length,
        topCandidate: summarizeDepopCandidate(list[0] || null)
      };
    }

    function buildSearchFailure(errorCode: any, retryAfterMs: any, partial: any, sourceType: any) {
      return {
        ok: false,
        candidates: [],
        fetchedAt: Date.now(),
        partial: Boolean(partial),
        sourceType: normalizeString(sourceType, "") || "html",
        parserVersion: PARSER_VERSION,
        errorCode: errorCode,
        retryAfterMs: retryAfterMs
      };
    }

    function buildSearchSuccess(candidates: any, partial: any, sourceType: any, requestCount: any) {
      return {
        ok: true,
        candidates: candidates,
        fetchedAt: Date.now(),
        partial: Boolean(partial),
        sourceType: normalizeString(sourceType, "") || "html",
        parserVersion: PARSER_VERSION,
        requestCount: requestCount
      };
    }

    function keepUsableCandidates(candidates: any) {
      return (Array.isArray(candidates) ? candidates : []).filter(function (candidate: any) {
        var price = normalizeNumber(candidate && candidate.price);
        return price == null || price > 0;
      });
    }

    async function tryBroadFallbackSearch(query: any, requestTotal: any, limit: any, sourceType: any) {
      var broadQuery = buildBroadFallbackQuery(query);
      if (!broadQuery || broadQuery === normalizeString(query, "").toLowerCase()) {
        return {
          requestTotal: requestTotal,
          candidates: [],
          sawNetworkError: false
        };
      }

      var broadUrl = "https://www.depop.com/search/?q=" + encodeURIComponent(broadQuery);
      debugLog("provider.broad_fallback_start", {
        originalQuery: normalizeString(query, ""),
        broadQuery: broadQuery,
        url: broadUrl,
        sourceType: normalizeString(sourceType, "html")
      });
      var broadFetched = await fetchSearchPage(broadUrl, fetchImpl, runtimeSendMessage, undefined, fetchTimeoutMs);
      var nextRequestTotal = requestTotal + 1;
      var sawNetworkError = !broadFetched.ok && broadFetched.status === 0;
      debugLog("provider.broad_fallback_result", {
        broadQuery: broadQuery,
        ok: Boolean(broadFetched && broadFetched.ok),
        status: Number(broadFetched && broadFetched.status) || 0,
        transport: normalizeString(broadFetched && broadFetched.source, ""),
        textLength: normalizeString(broadFetched && broadFetched.text, "").length
      });

      if (!broadFetched.ok || !broadFetched.text) {
        return {
          requestTotal: nextRequestTotal,
          candidates: [],
          sawNetworkError: sawNetworkError
        };
      }

      var broadParsed = parseCandidates(broadFetched.text);
      var broadCandidates = keepUsableCandidates(normalizeAndHydrateCandidates(broadParsed.candidates || []));
      if (limit != null) {
        broadCandidates = broadCandidates.slice(0, limit);
      }

      debugLog("provider.broad_fallback_candidates", Object.assign({
        broadQuery: broadQuery
      }, summarizeCandidateList(broadCandidates)));

      return {
        requestTotal: nextRequestTotal,
        candidates: broadCandidates,
        sawNetworkError: sawNetworkError
      };
    }

    async function executeQuerySearch(query: any, payload: any, state: any) {
      var nextState: {
        requestTotal: number;
        partial: boolean;
        sourceType: string;
        blockedFallbackAttempted: boolean;
        sawNoResults: boolean;
        sawNetworkError: boolean;
        candidates: any[];
        stopProcessing: boolean;
        response: ReturnType<typeof buildSearchFailure> | null;
      } = {
        requestTotal: normalizeNumber(state && state.requestTotal) || 0,
        partial: Boolean(state && state.partial),
        sourceType: normalizeString(state && state.sourceType, "") || "html",
        blockedFallbackAttempted: Boolean(state && state.blockedFallbackAttempted),
        sawNoResults: false,
        sawNetworkError: false,
        candidates: [],
        stopProcessing: false,
        response: null
      };
      var fallbackQuery = normalizeString(state && state.fallbackQuery, "");
      var url = "https://www.depop.com/search/?q=" + encodeURIComponent(query);
      debugLog("provider.query_start", {
        query: normalizeString(query, ""),
        url: url,
        requestTotal: nextState.requestTotal,
        maxRequests: maxRequests
      });

      var fetched = await fetchSearchPage(url, fetchImpl, runtimeSendMessage, undefined, fetchTimeoutMs);
      debugLog("provider.html_fetch_result", {
        query: normalizeString(query, ""),
        url: url,
        ok: Boolean(fetched && fetched.ok),
        status: Number(fetched && fetched.status) || 0,
        transport: normalizeString(fetched && fetched.source, ""),
        textLength: normalizeString(fetched && fetched.text, "").length
      });
      if (!fetched.ok && fetched.status === 0) {
        nextState.sawNetworkError = true;
        nextState.partial = true;
        debugLog("provider.query_network_error", {
          query: normalizeString(query, "")
        });
        return nextState;
      }

      nextState.requestTotal += 1;

      if (!fetched.ok) {
        if (nextState.requestTotal < maxRequests) {
          var apiOnHttpError: DepopAttemptResult = await tryApiSearch(
            query,
            payload,
            fetchImpl,
            runtimeSendMessage,
            fetchTimeoutMs,
            debugLog
          );
          nextState.requestTotal += apiOnHttpError.requestCount || 0;

          if (apiOnHttpError.ok) {
            nextState.candidates = apiOnHttpError.candidates || [];
            nextState.partial = true;
            nextState.sourceType = "json";
            return nextState;
          }

          if (apiOnHttpError.errorCode === "NO_RESULTS") {
            nextState.sawNoResults = true;
            return nextState;
          }
        }

        var mapped = mapHttpError(fetched.status);
        if (mapped.errorCode === "FORBIDDEN_OR_BLOCKED" && !nextState.blockedFallbackAttempted) {
          nextState.blockedFallbackAttempted = true;
          var fallbackAttempt = await trySingleQueryFallback(
            fetchImpl,
            runtimeSendMessage,
            fallbackQuery,
            cooldownMs,
            fetchTimeoutMs,
            debugLog
          );
          nextState.requestTotal += fallbackAttempt.requestCount || 0;

          if (fallbackAttempt.ok) {
            nextState.candidates = fallbackAttempt.candidates || [];
            nextState.partial = true;
            nextState.stopProcessing = true;
            return nextState;
          }

          nextState.response = buildSearchFailure(
            fallbackAttempt.errorCode || mapped.errorCode,
            normalizeNumber(fallbackAttempt.retryAfterMs) || mapped.retryAfterMs,
            true,
            "html"
          );
          return nextState;
        }

        if (mapped.errorCode === "FORBIDDEN_OR_BLOCKED" || mapped.errorCode === "RATE_LIMITED") {
          debugLog("provider.query_terminal_http_error", {
            query: normalizeString(query, ""),
            errorCode: mapped.errorCode,
            retryAfterMs: mapped.retryAfterMs
          });
          nextState.response = buildSearchFailure(mapped.errorCode, mapped.retryAfterMs, nextState.partial, "html");
          return nextState;
        }

        nextState.partial = true;
        debugLog("provider.query_http_error_partial", {
          query: normalizeString(query, ""),
          status: Number(fetched && fetched.status) || 0
        });
        return nextState;
      }

      var html = fetched.text;
      if (!html) {
        nextState.partial = true;
        return nextState;
      }

      var latestHtml = html;
      if (isBlockedHtml(html)) {
        debugLog("provider.blocked_html_detected", {
          query: normalizeString(query, "")
        });
        nextState.response = buildSearchFailure("FORBIDDEN_OR_BLOCKED", 120000, nextState.partial, "html");
        return nextState;
      }

      var candidateState = parseHtmlCandidateState(html, normalizeAndHydrateCandidates);
      var parsedCandidates = candidateState.candidates;
      var pricedParsedCandidates = candidateState.candidatesWithPrice;

      if (
        !pricedParsedCandidates.length &&
        isLikelyLoadingShellHtml(latestHtml) &&
        nextState.requestTotal + 1 < maxRequests
      ) {
        var retriedState = await retryLoadingShellCandidates({
          url: url,
          html: latestHtml,
          fetchImpl: fetchImpl,
          runtimeSendMessage: runtimeSendMessage,
          normalizeCandidates: normalizeAndHydrateCandidates,
          cooldownMs: cooldownMs,
          timeoutMs: fetchTimeoutMs,
          maxRetries: 2,
          maxAdditionalRequests: Math.max(0, maxRequests - nextState.requestTotal - 1),
          debugLogger: debugLog
        });
        nextState.requestTotal += retriedState.requestCount;

        if (retriedState.sawNetworkError) {
          nextState.sawNetworkError = true;
        }

        if (retriedState.requestCount > 0 && !retriedState.candidateState.candidatesWithPrice.length) {
          nextState.partial = true;
        }

        if (retriedState.blocked) {
          nextState.response = buildSearchFailure("FORBIDDEN_OR_BLOCKED", 120000, nextState.partial, "html");
          return nextState;
        }

        latestHtml = retriedState.latestHtml;
        parsedCandidates = retriedState.candidateState.candidates;
        pricedParsedCandidates = retriedState.candidateState.candidatesWithPrice;
      }

      if (!pricedParsedCandidates.length && nextState.requestTotal < maxRequests) {
        var apiFallback: DepopAttemptResult = await tryApiSearch(
          query,
          payload,
          fetchImpl,
          runtimeSendMessage,
          fetchTimeoutMs,
          debugLog
        );
        nextState.requestTotal += apiFallback.requestCount || 0;

        if (apiFallback.ok) {
          parsedCandidates = normalizeAndHydrateCandidates(apiFallback.candidates || []);
          pricedParsedCandidates = parsedCandidates.filter(hasMeaningfulPrice);
          nextState.sourceType = nextState.sourceType === "html" ? "hybrid" : nextState.sourceType;
        } else if (apiFallback.errorCode === "NO_RESULTS") {
          nextState.sawNoResults = true;
          return nextState;
        }
      }

      if (!pricedParsedCandidates.length && parsedCandidates.length && nextState.requestTotal < maxRequests) {
        var remainingBudget = Math.max(0, maxRequests - nextState.requestTotal);
        debugLog("provider.href_enrichment_start", {
          query: normalizeString(query, ""),
          candidateCount: parsedCandidates.length,
          remainingBudget: remainingBudget
        });
        var enriched = await enrichHrefFallbackCandidates(
          parsedCandidates,
          fetchImpl,
          runtimeSendMessage,
          remainingBudget,
          fetchTimeoutMs,
          normalizeAndHydrateCandidates,
          debugLog
        );

        nextState.requestTotal += enriched.requestCount || 0;
        pricedParsedCandidates = normalizeAndHydrateCandidates(enriched.candidates || [])
          .filter(hasMeaningfulPrice);
      }

      if (!pricedParsedCandidates.length && !hasAnyUsableCandidate(parsedCandidates) && shouldReturnNoResults(latestHtml)) {
        nextState.sawNoResults = true;
        return nextState;
      }

      if (!pricedParsedCandidates.length && hasAnyUsableCandidate(parsedCandidates)) {
        // Prefer priced candidates when available, but keep unpriced matches as a
        // better fallback than a false NO_RESULTS state.
        pricedParsedCandidates = keepUsableCandidates(parsedCandidates);
      }

      nextState.candidates = pricedParsedCandidates;
      debugLog("provider.query_candidates_ready", Object.assign({
        query: normalizeString(query, ""),
        sourceType: nextState.sourceType
      }, summarizeCandidateList(pricedParsedCandidates)));
      return nextState;
    }

    return {
      market: "depop",
      search: async function (input: any) {
        if (!fetchImpl && !runtimeSendMessage) {
          return buildSearchFailure("NETWORK_ERROR", 1500, false, "html");
        }

        var payload = input && typeof input === "object" ? input : {};
        var queries = Array.isArray(payload.queries) ? payload.queries.filter(Boolean) : [];
        var limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Number(payload.limit)) : null;
        var requestTotal = 0;
        var partial = false;
        var merged: any[] = [];
        var blockedFallbackAttempted = false;
        var sourceType = "html";
        var sawNoResults = false;
        var sawNetworkError = false;

        debugLog("provider.search_start", {
          listingId: normalizeString(payload.listingId, ""),
          queries: queries.slice(),
          limit: limit,
          currency: normalizeCurrencyCode(payload.currency) || "USD",
          title: normalizeString(payload.title, ""),
          brand: normalizeString(payload.brand, ""),
          size: normalizeString(payload.size, ""),
          category: normalizeString(payload.category, "")
        });

        if (!queries.length) {
          debugLog("provider.search_failure", {
            errorCode: "MISSING_LISTING_DATA"
          });
          return buildSearchFailure("MISSING_LISTING_DATA", 0, false, "html");
        }

        for (var i = 0; i < queries.length && requestTotal < maxRequests; i += 1) {
          var queryResult = await executeQuerySearch(queries[i], payload, {
            requestTotal: requestTotal,
            partial: partial,
            sourceType: sourceType,
            blockedFallbackAttempted: blockedFallbackAttempted,
            fallbackQuery: queries[0]
          });

          if (queryResult.response) {
            debugLog("provider.search_failure", {
              errorCode: normalizeString(queryResult.response.errorCode, "NETWORK_ERROR"),
              requestTotal: queryResult.requestTotal
            });
            return queryResult.response;
          }

          requestTotal = queryResult.requestTotal;
          partial = queryResult.partial;
          sourceType = queryResult.sourceType;
          blockedFallbackAttempted = queryResult.blockedFallbackAttempted;
          if (queryResult.sawNoResults) {
            sawNoResults = true;
          }
          if (queryResult.sawNetworkError) {
            sawNetworkError = true;
          }
          merged = merged.concat(queryResult.candidates || []);

          if (queryResult.stopProcessing) {
            break;
          }

          if (requestTotal < maxRequests && i < queries.length - 1) {
            await sleep(withJitter(cooldownMs));
          }
        }

        var normalized = dedupeById(merged);
        if (limit != null) {
          normalized = normalized.slice(0, limit);
        }

        if (!normalized.length) {
          if (sawNoResults && queries.length && requestTotal < maxRequests) {
            var broadFallback = await tryBroadFallbackSearch(queries[0], requestTotal, limit, sourceType);
            requestTotal = broadFallback.requestTotal;
            if (broadFallback.sawNetworkError) {
              sawNetworkError = true;
            }

            if (broadFallback.candidates.length) {
              debugLog("provider.search_success", Object.assign({
                sourceType: sourceType,
                partial: true,
                requestTotal: requestTotal,
                via: "broad_fallback"
              }, summarizeCandidateList(broadFallback.candidates)));
              return buildSearchSuccess(broadFallback.candidates, true, sourceType, requestTotal);
            }
          }

          if (sawNoResults) {
            debugLog("provider.search_failure", {
              errorCode: "NO_RESULTS",
              partial: partial,
              requestTotal: requestTotal
            });
            return buildSearchFailure("NO_RESULTS", 0, partial, "html");
          }

          if (sawNetworkError) {
            debugLog("provider.search_failure", {
              errorCode: "NETWORK_ERROR",
              partial: partial,
              requestTotal: requestTotal
            });
            return buildSearchFailure("NETWORK_ERROR", 1500, partial, "html");
          }

          debugLog("provider.search_failure", {
            errorCode: "PARSE_ERROR",
            partial: partial,
            requestTotal: requestTotal
          });
          return buildSearchFailure("PARSE_ERROR", 0, partial, "html");
        }

        debugLog("provider.search_success", Object.assign({
          sourceType: sourceType,
          partial: partial,
          requestTotal: requestTotal,
          via: "primary"
        }, summarizeCandidateList(normalized)));
        return buildSearchSuccess(normalized, partial, sourceType, requestTotal);
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
