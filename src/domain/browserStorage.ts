interface BSStorageLike {
  get: (...args: unknown[]) => unknown;
  set: (...args: unknown[]) => unknown;
  remove?: (...args: unknown[]) => unknown;
}

interface BSModule {
  getStorageLocal: () => BSStorageLike | null;
  storageGet: (storage: BSStorageLike | null, key: string) => Promise<Record<string, unknown>>;
  storageSet: (storage: BSStorageLike | null, payload: Record<string, unknown>) => Promise<boolean>;
  storageRemove: (storage: BSStorageLike | null, key: string | string[]) => Promise<boolean>;
}

interface BSGlobalRoot {
  GrailedPlusBrowserStorage?: BSModule;
}

(function (root: BSGlobalRoot, factory: () => BSModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusBrowserStorage = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as BSGlobalRoot) : {},
  function () {
    "use strict";

    function getStorageLocal(): BSStorageLike | null {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local &&
        typeof chrome.storage.local.get === "function" &&
        typeof chrome.storage.local.set === "function"
      ) {
        return chrome.storage.local as unknown as BSStorageLike;
      }

      if (
        typeof browser !== "undefined" &&
        browser.storage &&
        browser.storage.local &&
        typeof browser.storage.local.get === "function" &&
        typeof browser.storage.local.set === "function"
      ) {
        return browser.storage.local as unknown as BSStorageLike;
      }

      return null;
    }

    function storageGet(storage: BSStorageLike | null, key: string): Promise<Record<string, unknown>> {
      if (!storage) {
        return Promise.resolve({});
      }

      try {
        const result = storage.get(key);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          return result as Promise<Record<string, unknown>>;
        }
      } catch (_) {
        // Try callback style below.
      }

      return new Promise(function (resolve) {
        try {
          storage.get(key, function (data: unknown) {
            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
              resolve({});
              return;
            }
            resolve((data as Record<string, unknown>) || {});
          });
        } catch (_) {
          resolve({});
        }
      });
    }

    function storageSet(storage: BSStorageLike | null, payload: Record<string, unknown>): Promise<boolean> {
      if (!storage) {
        return Promise.resolve(false);
      }

      try {
        const result = storage.set(payload);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          return (result as Promise<unknown>).then(function () {
            return true;
          });
        }
      } catch (_) {
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
        } catch (_) {
          resolve(false);
        }
      });
    }

    function storageRemove(storage: BSStorageLike | null, key: string | string[]): Promise<boolean> {
      if (!storage || typeof storage.remove !== "function") {
        return Promise.resolve(false);
      }

      try {
        const result = storage.remove(key);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          return (result as Promise<unknown>).then(function () {
            return true;
          });
        }
      } catch (_) {
        // Try callback style below.
      }

      return new Promise(function (resolve) {
        try {
          storage.remove!(key, function () {
            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
              resolve(false);
              return;
            }
            resolve(true);
          });
        } catch (_) {
          resolve(false);
        }
      });
    }

    return {
      getStorageLocal,
      storageGet,
      storageSet,
      storageRemove
    };
  }
);
