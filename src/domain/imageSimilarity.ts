interface ISCompareResult {
  score: number | null;
  usedImage: boolean;
  reason: string;
}

interface ISServiceOptions {
  cacheMaxEntries?: unknown;
  loadGrayscaleGrid?: (url: string, width: number, height: number) => Promise<number[] | null>;
}

interface ISService {
  compareImageUrls: (leftUrl: unknown, rightUrl: unknown) => Promise<ISCompareResult>;
}

interface ISModule {
  createImageSimilarityService: (options?: unknown) => ISService;
  compareImageUrls: (leftUrl: unknown, rightUrl: unknown) => Promise<ISCompareResult>;
  computeDifferenceHash: (grid: unknown, width: unknown, height: unknown) => string;
  compareHashes: (leftHash: unknown, rightHash: unknown) => number | null;
}

interface ISRuntimeLike {
  sendMessage?: (...args: unknown[]) => unknown;
}

interface ISGlobalRoot {
  chrome?: {
    runtime?: ISRuntimeLike;
  };
  browser?: {
    runtime?: ISRuntimeLike;
  };
  GrailedPlusImageSimilarity?: ISModule;
}

(function (root: ISGlobalRoot, factory: () => ISModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusImageSimilarity = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as ISGlobalRoot) : {},
  function () {
    "use strict";

    const IMAGE_FETCH_MESSAGE_TYPE = "grailed-plus:image-fetch";
    const IMAGE_FETCH_MESSAGE_VERSION = 1;
    const HASH_GRID_WIDTH = 9;
    const HASH_GRID_HEIGHT = 8;

    function normalizeString(value: unknown, fallback: string): string {
      if (typeof value !== "string") {
        return fallback;
      }

      const trimmed = value.trim();
      return trimmed || fallback;
    }

    function normalizePositiveInteger(value: unknown, fallback: number): number {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
      }

      return Math.max(1, Math.floor(parsed));
    }

    function isPromiseLike(value: unknown): value is Promise<unknown> {
      return Boolean(value) && typeof (value as Promise<unknown>).then === "function";
    }

    function hasBitmapDecodeSupport(): boolean {
      return typeof createImageBitmap === "function" && typeof OffscreenCanvas === "function";
    }

    function hasDomCanvasSupport(): boolean {
      return (
        typeof document !== "undefined" &&
        Boolean(document) &&
        typeof document.createElement === "function" &&
        typeof Image === "function" &&
        typeof URL !== "undefined" &&
        typeof URL.createObjectURL === "function"
      );
    }

    function getRuntime(): ISRuntimeLike | null {
      if (
        typeof globalThis !== "undefined" &&
        (globalThis as unknown as ISGlobalRoot).chrome &&
        (globalThis as unknown as ISGlobalRoot).chrome?.runtime &&
        typeof (globalThis as unknown as ISGlobalRoot).chrome?.runtime?.sendMessage === "function"
      ) {
        return (globalThis as unknown as ISGlobalRoot).chrome?.runtime || null;
      }

      if (
        typeof globalThis !== "undefined" &&
        (globalThis as unknown as ISGlobalRoot).browser &&
        (globalThis as unknown as ISGlobalRoot).browser?.runtime &&
        typeof (globalThis as unknown as ISGlobalRoot).browser?.runtime?.sendMessage === "function"
      ) {
        return (globalThis as unknown as ISGlobalRoot).browser?.runtime || null;
      }

      return null;
    }

    function sendRuntimeMessage(message: Record<string, unknown>): Promise<Record<string, unknown> | null> {
      const runtime = getRuntime();
      const sendMessage = runtime && typeof runtime.sendMessage === "function" ? runtime.sendMessage : null;
      if (!sendMessage) {
        return Promise.resolve(null);
      }

      return new Promise(function (resolve) {
        let settled = false;
        const timeoutId =
          typeof setTimeout === "function"
            ? setTimeout(function () {
                settle(null);
              }, 1000)
            : null;

        function settle(value: Record<string, unknown> | null): void {
          if (settled) {
            return;
          }
          settled = true;
          if (timeoutId != null && typeof clearTimeout === "function") {
            clearTimeout(timeoutId);
          }
          resolve(value);
        }

        try {
          const maybePromise = sendMessage(message, function (response: unknown) {
            settle(response && typeof response === "object" ? (response as Record<string, unknown>) : null);
          });

          if (isPromiseLike(maybePromise)) {
            maybePromise
              .then(function (response) {
                settle(response && typeof response === "object" ? (response as Record<string, unknown>) : null);
              })
              .catch(function () {
                settle(null);
              });
          }
        } catch (_) {
          settle(null);
        }
      });
    }

    async function fetchImageBlobViaRuntime(url: string): Promise<Blob | null> {
      if (!/^https:\/\//i.test(url)) {
        return null;
      }

      const response = await sendRuntimeMessage({
        type: IMAGE_FETCH_MESSAGE_TYPE,
        url: url,
        v: IMAGE_FETCH_MESSAGE_VERSION
      });

      if (!response || response.ok !== true || !(response.bytes instanceof ArrayBuffer)) {
        return null;
      }

      const contentType = normalizeString(response.contentType, "image/jpeg");
      try {
        return new Blob([response.bytes], {
          type: contentType || "image/jpeg"
        });
      } catch (_) {
        return null;
      }
    }

    async function fetchImageBlobDirect(url: string): Promise<Blob | null> {
      if (typeof fetch !== "function") {
        return null;
      }

      try {
        const response = await fetch(url, {
          method: "GET",
          cache: "force-cache",
          credentials: "omit"
        });

        if (!response || !response.ok) {
          return null;
        }

        return await response.blob();
      } catch (_) {
        return null;
      }
    }

    async function fetchImageBlob(url: string): Promise<Blob | null> {
      const viaRuntime = await fetchImageBlobViaRuntime(url);
      if (viaRuntime) {
        return viaRuntime;
      }

      return fetchImageBlobDirect(url);
    }

    function toLumaGrid(data: Uint8ClampedArray, width: number, height: number): number[] {
      const grid: number[] = [];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const red = Number(data[index] || 0);
          const green = Number(data[index + 1] || 0);
          const blue = Number(data[index + 2] || 0);
          grid.push(Math.round(red * 0.299 + green * 0.587 + blue * 0.114));
        }
      }
      return grid;
    }

    async function drawBlobToGridWithBitmap(blob: Blob, width: number, height: number): Promise<number[] | null> {
      if (!hasBitmapDecodeSupport()) {
        return null;
      }

      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext("2d", {
          willReadFrequently: true
        } as CanvasRenderingContext2DSettings);
        if (!context) {
          return null;
        }

        context.drawImage(bitmap, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);
        return toLumaGrid(imageData.data, width, height);
      } catch (_) {
        return null;
      } finally {
        if (bitmap && typeof bitmap.close === "function") {
          try {
            bitmap.close();
          } catch (_) {
            // Ignore cleanup failures.
          }
        }
      }
    }

    async function drawBlobToGridWithDomCanvas(blob: Blob, width: number, height: number): Promise<number[] | null> {
      if (!hasDomCanvasSupport()) {
        return null;
      }

      const canvas = document.createElement("canvas");
      if (!canvas || typeof canvas.getContext !== "function") {
        return null;
      }

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", {
        willReadFrequently: true
      } as CanvasRenderingContext2DSettings);
      if (!context) {
        return null;
      }

      const objectUrl = URL.createObjectURL(blob);
      try {
        const image = await new Promise<HTMLImageElement | null>(function (resolve) {
          const nextImage = new Image();
          nextImage.onload = function () {
            resolve(nextImage);
          };
          nextImage.onerror = function () {
            resolve(null);
          };
          nextImage.src = objectUrl;
        });

        if (!image) {
          return null;
        }

        context.drawImage(image, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);
        return toLumaGrid(imageData.data, width, height);
      } catch (_) {
        return null;
      } finally {
        if (typeof URL.revokeObjectURL === "function") {
          try {
            URL.revokeObjectURL(objectUrl);
          } catch (_) {
            // Ignore cleanup failures.
          }
        }
      }
    }

    async function defaultLoadGrayscaleGrid(url: string, width: number, height: number): Promise<number[] | null> {
      const blob = await fetchImageBlob(url);
      if (!blob) {
        return null;
      }

      const bitmapGrid = await drawBlobToGridWithBitmap(blob, width, height);
      if (bitmapGrid) {
        return bitmapGrid;
      }

      return drawBlobToGridWithDomCanvas(blob, width, height);
    }

    function computeDifferenceHash(grid: unknown, width: unknown, height: unknown): string {
      const normalizedWidth = normalizePositiveInteger(width, HASH_GRID_WIDTH);
      const normalizedHeight = normalizePositiveInteger(height, HASH_GRID_HEIGHT);
      const values = Array.isArray(grid) ? grid : [];
      if (normalizedWidth < 2 || values.length < normalizedWidth * normalizedHeight) {
        return "";
      }

      let bits = "";
      for (let y = 0; y < normalizedHeight; y += 1) {
        for (let x = 0; x < normalizedWidth - 1; x += 1) {
          const left = Number(values[y * normalizedWidth + x] || 0);
          const right = Number(values[y * normalizedWidth + x + 1] || 0);
          bits += left >= right ? "1" : "0";
        }
      }

      return bits;
    }

    function compareHashes(leftHash: unknown, rightHash: unknown): number | null {
      const left = normalizeString(leftHash, "");
      const right = normalizeString(rightHash, "");
      if (!left || !right || left.length !== right.length) {
        return null;
      }

      let distance = 0;
      for (let index = 0; index < left.length; index += 1) {
        if (left.charAt(index) !== right.charAt(index)) {
          distance += 1;
        }
      }

      return Math.max(0, Math.min(100, Math.round((1 - distance / left.length) * 100)));
    }

    function createImageSimilarityService(options?: unknown): ISService {
      const config = options && typeof options === "object" ? (options as ISServiceOptions) : {};
      const cacheMaxEntries = normalizePositiveInteger(config.cacheMaxEntries, 128);
      const hasCustomLoader = typeof config.loadGrayscaleGrid === "function";
      const loadGrayscaleGrid: (
        url: string,
        width: number,
        height: number
      ) => Promise<number[] | null> = hasCustomLoader
        ? (config.loadGrayscaleGrid as (
            url: string,
            width: number,
            height: number
          ) => Promise<number[] | null>)
        : defaultLoadGrayscaleGrid;
      const hashPromiseByUrl = new Map<string, Promise<string | null>>();

      function pruneCache(): void {
        while (hashPromiseByUrl.size > cacheMaxEntries) {
          const firstKey = hashPromiseByUrl.keys().next();
          if (firstKey && !firstKey.done) {
            hashPromiseByUrl.delete(firstKey.value);
          } else {
            break;
          }
        }
      }

      function getHash(url: string): Promise<string | null> {
        const normalizedUrl = normalizeString(url, "");
        if (!normalizedUrl) {
          return Promise.resolve(null);
        }

        if (hashPromiseByUrl.has(normalizedUrl)) {
          return hashPromiseByUrl.get(normalizedUrl) as Promise<string | null>;
        }

        const promise = Promise.resolve(loadGrayscaleGrid(normalizedUrl, HASH_GRID_WIDTH, HASH_GRID_HEIGHT))
          .then(function (grid) {
            if (!Array.isArray(grid) || grid.length !== HASH_GRID_WIDTH * HASH_GRID_HEIGHT) {
              return null;
            }

            const hash = computeDifferenceHash(grid, HASH_GRID_WIDTH, HASH_GRID_HEIGHT);
            return hash || null;
          })
          .catch(function () {
            return null;
          });

        hashPromiseByUrl.set(normalizedUrl, promise);
        pruneCache();
        return promise;
      }

      async function compareImageUrls(leftUrl: unknown, rightUrl: unknown): Promise<ISCompareResult> {
        const left = normalizeString(leftUrl, "");
        const right = normalizeString(rightUrl, "");
        if (!left || !right) {
          return {
            score: null,
            usedImage: false,
            reason: "missing_url"
          };
        }

        if (!hasCustomLoader && !hasBitmapDecodeSupport() && !hasDomCanvasSupport()) {
          return {
            score: null,
            usedImage: false,
            reason: "unsupported_environment"
          };
        }

        const [leftHash, rightHash] = await Promise.all([getHash(left), getHash(right)]);
        const score = compareHashes(leftHash, rightHash);
        if (score == null) {
          return {
            score: null,
            usedImage: false,
            reason: "visual_unavailable"
          };
        }

        return {
          score: score,
          usedImage: true,
          reason: "ok"
        };
      }

      return {
        compareImageUrls: compareImageUrls
      };
    }

    const defaultService = createImageSimilarityService();

    return {
      createImageSimilarityService: createImageSimilarityService,
      compareImageUrls: defaultService.compareImageUrls,
      computeDifferenceHash: computeDifferenceHash,
      compareHashes: compareHashes
    };
  }
);
