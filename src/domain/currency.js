"use strict";
(function (root, factory) {
    if (typeof module === "object" && module && module.exports) {
        module.exports = factory();
    }
    else {
        root.GrailedPlusCurrency = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : {}, function () {
    "use strict";
    const CACHE_KEY = "grailed_plus_exchange_rates_v1";
    const CACHE_TTL_MS = 60 * 60 * 1000;
    let BrowserStorage = null;
    if (typeof globalThis !== "undefined" && globalThis.GrailedPlusBrowserStorage) {
        BrowserStorage = globalThis.GrailedPlusBrowserStorage || null;
    }
    if (!BrowserStorage && typeof require === "function") {
        try {
            BrowserStorage = require("./browserStorage");
        }
        catch (_) {
            BrowserStorage = null;
        }
    }
    function normalizeCurrencyCode(input) {
        if (typeof input !== "string") {
            return null;
        }
        const trimmed = input.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(trimmed)) {
            return null;
        }
        return trimmed;
    }
    function getStorageLocal() {
        return BrowserStorage && typeof BrowserStorage.getStorageLocal === "function"
            ? BrowserStorage.getStorageLocal()
            : null;
    }
    function storageGet(storage, key) {
        return BrowserStorage && typeof BrowserStorage.storageGet === "function"
            ? BrowserStorage.storageGet(storage, key)
            : Promise.resolve({});
    }
    function storageSet(storage, payload) {
        return BrowserStorage && typeof BrowserStorage.storageSet === "function"
            ? BrowserStorage.storageSet(storage, payload)
            : Promise.resolve(false);
    }
    function isCacheUsable(cache, baseCurrency, nowMs) {
        if (!isCacheStaleButCompatible(cache, baseCurrency)) {
            return false;
        }
        const typedCache = cache;
        if (!Number.isFinite(typedCache.timestamp) || typedCache.timestamp <= 0) {
            return false;
        }
        return nowMs - typedCache.timestamp < CACHE_TTL_MS;
    }
    function isCacheStaleButCompatible(cache, baseCurrency) {
        if (!cache || typeof cache !== "object") {
            return false;
        }
        const typedCache = cache;
        if (typedCache.base !== baseCurrency) {
            return false;
        }
        if (!typedCache.rates || typeof typedCache.rates !== "object") {
            return false;
        }
        return true;
    }
    function buildPayload(baseCurrency, timestamp, rates) {
        return {
            base: baseCurrency,
            timestamp: timestamp,
            rates: rates
        };
    }
    function buildResponse(payload, source) {
        const safePayload = payload || buildPayload("USD", Date.now(), {});
        return {
            rates: safePayload.rates && typeof safePayload.rates === "object" ? safePayload.rates : {},
            base: safePayload.base || "USD",
            timestamp: Number.isFinite(safePayload.timestamp) ? safePayload.timestamp : Date.now(),
            source: source || "unknown"
        };
    }
    function fetchLatestRates(baseCurrency) {
        if (typeof fetch !== "function") {
            return Promise.reject(new Error("fetch unavailable"));
        }
        const endpoint = "https://api.frankfurter.app/latest?base=" + encodeURIComponent(baseCurrency);
        return fetch(endpoint)
            .then(function (res) {
            if (!res || !res.ok) {
                throw new Error("failed to fetch currency rates");
            }
            return res.json();
        })
            .then(function (json) {
            const rates = json && json.rates && typeof json.rates === "object" ? json.rates : {};
            return buildPayload(baseCurrency, Date.now(), rates);
        });
    }
    function getRates(baseCurrency) {
        const normalizedBase = normalizeCurrencyCode(baseCurrency) || "USD";
        const nowMs = Date.now();
        const storage = getStorageLocal();
        return storageGet(storage, CACHE_KEY)
            .then(function (data) {
            const cache = data && data[CACHE_KEY];
            if (isCacheUsable(cache, normalizedBase, nowMs)) {
                return buildResponse(cache, "cache_fresh");
            }
            return fetchLatestRates(normalizedBase)
                .then(function (payload) {
                const wrapper = {};
                wrapper[CACHE_KEY] = payload;
                return storageSet(storage, wrapper).then(function () {
                    return buildResponse(payload, "network");
                });
            })
                .catch(function () {
                if (isCacheStaleButCompatible(cache, normalizedBase)) {
                    return buildResponse(cache, "cache_stale");
                }
                return buildResponse(buildPayload(normalizedBase, nowMs, {}), "fallback_empty");
            });
        })
            .catch(function () {
            return fetchLatestRates(normalizedBase)
                .then(function (payload) {
                return buildResponse(payload, "network");
            })
                .catch(function () {
                return buildResponse(buildPayload(normalizedBase, nowMs, {}), "fallback_empty");
            });
        });
    }
    function hasCurrencyCode(code, rates) {
        const normalized = normalizeCurrencyCode(code);
        if (!normalized || !rates || typeof rates !== "object") {
            return false;
        }
        const typedRates = rates;
        return Number.isFinite(Number(typedRates[normalized])) && Number(typedRates[normalized]) > 0;
    }
    function convert(amount, from, to) {
        const amountNumber = Number(amount);
        const fromCurrency = normalizeCurrencyCode(from);
        const toCurrency = normalizeCurrencyCode(to);
        if (!Number.isFinite(amountNumber) || !fromCurrency || !toCurrency) {
            return Promise.resolve(null);
        }
        if (fromCurrency === toCurrency) {
            return Promise.resolve(amountNumber);
        }
        return getRates(fromCurrency).then(function (result) {
            const rates = result && result.rates ? result.rates : {};
            if (!hasCurrencyCode(toCurrency, rates)) {
                return null;
            }
            return amountNumber * Number(rates[toCurrency]);
        });
    }
    return {
        CACHE_KEY: CACHE_KEY,
        CACHE_TTL_MS: CACHE_TTL_MS,
        normalizeCurrencyCode: normalizeCurrencyCode,
        getRates: getRates,
        convert: convert,
        hasCurrencyCode: hasCurrencyCode
    };
});