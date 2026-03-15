"use strict";
(function (root, factory) {
    if (typeof module === "object" && module && module.exports) {
        module.exports = factory();
    }
    else {
        root.GrailedPlusBrowserStorage = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : {}, function () {
    "use strict";
    function getStorageLocal() {
        if (typeof chrome !== "undefined" &&
            chrome.storage &&
            chrome.storage.local &&
            typeof chrome.storage.local.get === "function" &&
            typeof chrome.storage.local.set === "function") {
            return chrome.storage.local;
        }
        if (typeof browser !== "undefined" &&
            browser.storage &&
            browser.storage.local &&
            typeof browser.storage.local.get === "function" &&
            typeof browser.storage.local.set === "function") {
            return browser.storage.local;
        }
        return null;
    }
    function storageGet(storage, key) {
        if (!storage) {
            return Promise.resolve({});
        }
        try {
            const result = storage.get(key);
            if (result && typeof result.then === "function") {
                return result;
            }
        }
        catch (_) {
            // Try callback style below.
        }
        return new Promise(function (resolve) {
            try {
                storage.get(key, function (data) {
                    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
                        resolve({});
                        return;
                    }
                    resolve(data || {});
                });
            }
            catch (_) {
                resolve({});
            }
        });
    }
    function storageSet(storage, payload) {
        if (!storage) {
            return Promise.resolve(false);
        }
        try {
            const result = storage.set(payload);
            if (result && typeof result.then === "function") {
                return result.then(function () {
                    return true;
                });
            }
        }
        catch (_) {
            // Try callback style below.
        }
        return new Promise(function (resolve) {
            try {
                storage.set(payload, function () {
                    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
                        resolve(false);
                        return;
                    }
                    resolve(true);
                });
            }
            catch (_) {
                resolve(false);
            }
        });
    }
    return {
        getStorageLocal,
        storageGet,
        storageSet
    };
});