type ISImageSignalType = "ml_embedding" | "thumbnail_fingerprint" | "";

interface ISCompareOptions {
  mlEnabled?: unknown;
  coldStartBudgetMs?: unknown;
}

interface ISCompareResult {
  score: number | null;
  usedImage: boolean;
  reason: string;
  signalType: ISImageSignalType;
}

interface ISDecodedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface ISModelInput {
  data: Float32Array;
  dims: [number, number, number, number];
}

interface ISOrtSessionLike {
  inputNames?: string[];
  outputNames?: string[];
  run?: (feeds: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface ISServiceOptions {
  cacheMaxEntries?: unknown;
  coldStartBudgetMs?: unknown;
  modelAssetPath?: unknown;
  wasmAssetPath?: unknown;
  loadGrayscaleGrid?: (url: string, width: number, height: number) => Promise<number[] | null>;
  loadDecodedImage?: (url: string) => Promise<ISDecodedImage | null>;
  createInferenceSession?: (
    modelUrl: string,
    sessionOptions: Record<string, unknown>
  ) => Promise<ISOrtSessionLike | null>;
  createInputTensor?: (data: Float32Array, dims: [number, number, number, number]) => unknown;
  resolveAssetUrl?: (assetPath: string) => string;
}

interface ISService {
  compareImageUrls: (leftUrl: unknown, rightUrl: unknown, options?: unknown) => Promise<ISCompareResult>;
  preloadModel: () => Promise<void>;
}

interface ISModule {
  createImageSimilarityService: (options?: unknown) => ISService;
  compareImageUrls: (leftUrl: unknown, rightUrl: unknown, options?: unknown) => Promise<ISCompareResult>;
  preloadModel: () => Promise<void>;
  computeDifferenceHash: (grid: unknown, width: unknown, height: unknown) => string;
  compareHashes: (leftHash: unknown, rightHash: unknown) => number | null;
  buildModelInputTensor: (data: unknown, width: unknown, height: unknown) => ISModelInput | null;
  l2NormalizeVector: (value: unknown) => Float32Array | null;
  cosineSimilarity: (left: unknown, right: unknown) => number | null;
}

interface ISRuntimeLike {
  sendMessage?: (...args: unknown[]) => unknown;
  getURL?: (path: string) => string;
}

interface ISOrtLike {
  env?: {
    wasm?: Record<string, unknown>;
    logLevel?: unknown;
  };
  Tensor?: new (
    type: string,
    data: Float32Array,
    dims: [number, number, number, number]
  ) => unknown;
  InferenceSession?: {
    create?: (
      modelPath: string,
      options?: Record<string, unknown>
    ) => Promise<ISOrtSessionLike>;
  };
}

interface ISGlobalRoot {
  chrome?: {
    runtime?: ISRuntimeLike;
  };
  browser?: {
    runtime?: ISRuntimeLike;
  };
  ort?: ISOrtLike;
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
    const MODEL_IMAGE_SIZE = 256;
    const DEFAULT_CACHE_MAX_ENTRIES = 128;
    const DEFAULT_COLD_START_BUDGET_MS = 40;
    const MODEL_ASSET_PATH = "vendor/mobileclip-s1/vision_model_uint8.onnx";
    const WASM_ASSET_PATH = "vendor/onnxruntime/ort-wasm-simd-threaded.wasm";

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

    function normalizeDurationMs(value: unknown, fallback: number): number {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
      }

      return Math.max(0, Math.floor(parsed));
    }

    function isPromiseLike(value: unknown): value is Promise<unknown> {
      return Boolean(value) && typeof (value as Promise<unknown>).then === "function";
    }

    function isObjectRecord(value: unknown): value is Record<string, unknown> {
      return Boolean(value) && typeof value === "object";
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
        (globalThis as unknown as ISGlobalRoot).chrome?.runtime
      ) {
        return (globalThis as unknown as ISGlobalRoot).chrome?.runtime || null;
      }

      if (
        typeof globalThis !== "undefined" &&
        (globalThis as unknown as ISGlobalRoot).browser &&
        (globalThis as unknown as ISGlobalRoot).browser?.runtime
      ) {
        return (globalThis as unknown as ISGlobalRoot).browser?.runtime || null;
      }

      return null;
    }

    function getOrt(): ISOrtLike | null {
      if (
        typeof globalThis !== "undefined" &&
        (globalThis as unknown as ISGlobalRoot).ort &&
        typeof (globalThis as unknown as ISGlobalRoot).ort === "object"
      ) {
        return (globalThis as unknown as ISGlobalRoot).ort || null;
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

    async function drawBlobToImageWithBitmap(blob: Blob): Promise<ISDecodedImage | null> {
      if (!hasBitmapDecodeSupport()) {
        return null;
      }

      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(blob);
        const width = normalizePositiveInteger(bitmap.width, 0);
        const height = normalizePositiveInteger(bitmap.height, 0);
        if (!width || !height) {
          return null;
        }

        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext("2d", {
          willReadFrequently: true
        } as CanvasRenderingContext2DSettings);
        if (!context) {
          return null;
        }

        context.drawImage(bitmap, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);
        return {
          data: imageData.data,
          width: width,
          height: height
        };
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

    async function drawBlobToImageWithDomCanvas(blob: Blob): Promise<ISDecodedImage | null> {
      if (!hasDomCanvasSupport()) {
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

        const width = normalizePositiveInteger(image.naturalWidth || image.width, 0);
        const height = normalizePositiveInteger(image.naturalHeight || image.height, 0);
        if (!width || !height) {
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

        context.drawImage(image, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);
        return {
          data: imageData.data,
          width: width,
          height: height
        };
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

    async function defaultLoadDecodedImage(url: string): Promise<ISDecodedImage | null> {
      const blob = await fetchImageBlob(url);
      if (!blob) {
        return null;
      }

      const decodedWithBitmap = await drawBlobToImageWithBitmap(blob);
      if (decodedWithBitmap) {
        return decodedWithBitmap;
      }

      return drawBlobToImageWithDomCanvas(blob);
    }

    function resizeRgbaBilinear(
      source: Uint8ClampedArray,
      sourceWidth: number,
      sourceHeight: number,
      targetWidth: number,
      targetHeight: number
    ): Uint8ClampedArray {
      const output = new Uint8ClampedArray(targetWidth * targetHeight * 4);
      const xRatio = sourceWidth / targetWidth;
      const yRatio = sourceHeight / targetHeight;

      for (let y = 0; y < targetHeight; y += 1) {
        const srcY = Math.max(0, Math.min(sourceHeight - 1, (y + 0.5) * yRatio - 0.5));
        const y0 = Math.floor(srcY);
        const y1 = Math.min(sourceHeight - 1, y0 + 1);
        const yWeight = srcY - y0;

        for (let x = 0; x < targetWidth; x += 1) {
          const srcX = Math.max(0, Math.min(sourceWidth - 1, (x + 0.5) * xRatio - 0.5));
          const x0 = Math.floor(srcX);
          const x1 = Math.min(sourceWidth - 1, x0 + 1);
          const xWeight = srcX - x0;

          const topLeft = (y0 * sourceWidth + x0) * 4;
          const topRight = (y0 * sourceWidth + x1) * 4;
          const bottomLeft = (y1 * sourceWidth + x0) * 4;
          const bottomRight = (y1 * sourceWidth + x1) * 4;
          const outIndex = (y * targetWidth + x) * 4;

          for (let channel = 0; channel < 4; channel += 1) {
            const top =
              Number(source[topLeft + channel] || 0) * (1 - xWeight) +
              Number(source[topRight + channel] || 0) * xWeight;
            const bottom =
              Number(source[bottomLeft + channel] || 0) * (1 - xWeight) +
              Number(source[bottomRight + channel] || 0) * xWeight;
            output[outIndex + channel] = Math.round(top * (1 - yWeight) + bottom * yWeight);
          }
        }
      }

      return output;
    }

    function cropRgba(
      source: Uint8ClampedArray,
      sourceWidth: number,
      sourceHeight: number,
      startX: number,
      startY: number,
      cropWidth: number,
      cropHeight: number
    ): Uint8ClampedArray {
      const output = new Uint8ClampedArray(cropWidth * cropHeight * 4);
      for (let y = 0; y < cropHeight; y += 1) {
        const sourceY = Math.max(0, Math.min(sourceHeight - 1, startY + y));
        for (let x = 0; x < cropWidth; x += 1) {
          const sourceX = Math.max(0, Math.min(sourceWidth - 1, startX + x));
          const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
          const outputIndex = (y * cropWidth + x) * 4;
          output[outputIndex] = source[sourceIndex];
          output[outputIndex + 1] = source[sourceIndex + 1];
          output[outputIndex + 2] = source[sourceIndex + 2];
          output[outputIndex + 3] = source[sourceIndex + 3];
        }
      }

      return output;
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

    function buildModelInputTensor(data: unknown, width: unknown, height: unknown): ISModelInput | null {
      const pixels = data instanceof Uint8ClampedArray ? data : null;
      const sourceWidth = normalizePositiveInteger(width, 0);
      const sourceHeight = normalizePositiveInteger(height, 0);
      if (!pixels || !sourceWidth || !sourceHeight || pixels.length < sourceWidth * sourceHeight * 4) {
        return null;
      }

      const scale = MODEL_IMAGE_SIZE / Math.min(sourceWidth, sourceHeight);
      const resizedWidth = Math.max(1, Math.round(sourceWidth * scale));
      const resizedHeight = Math.max(1, Math.round(sourceHeight * scale));
      const resized = resizeRgbaBilinear(pixels, sourceWidth, sourceHeight, resizedWidth, resizedHeight);
      const cropX = Math.max(0, Math.floor((resizedWidth - MODEL_IMAGE_SIZE) / 2));
      const cropY = Math.max(0, Math.floor((resizedHeight - MODEL_IMAGE_SIZE) / 2));
      const cropped = cropRgba(
        resized,
        resizedWidth,
        resizedHeight,
        cropX,
        cropY,
        MODEL_IMAGE_SIZE,
        MODEL_IMAGE_SIZE
      );

      const planeSize = MODEL_IMAGE_SIZE * MODEL_IMAGE_SIZE;
      const tensor = new Float32Array(planeSize * 3);
      for (let index = 0; index < planeSize; index += 1) {
        const pixelOffset = index * 4;
        tensor[index] = Number(cropped[pixelOffset] || 0) / 255;
        tensor[planeSize + index] = Number(cropped[pixelOffset + 1] || 0) / 255;
        tensor[planeSize * 2 + index] = Number(cropped[pixelOffset + 2] || 0) / 255;
      }

      return {
        data: tensor,
        dims: [1, 3, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE]
      };
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

    function l2NormalizeVector(value: unknown): Float32Array | null {
      let input: Float32Array | null = null;
      if (value instanceof Float32Array) {
        input = value;
      } else if (Array.isArray(value)) {
        input = new Float32Array(value.map(function (entry) {
          return Number(entry) || 0;
        }));
      } else if (ArrayBuffer.isView(value)) {
        input = new Float32Array(Array.from(value as unknown as ArrayLike<number>, function (entry) {
          return Number(entry) || 0;
        }));
      }

      if (!input || !input.length) {
        return null;
      }

      let sumSquares = 0;
      for (let index = 0; index < input.length; index += 1) {
        const current = Number(input[index] || 0);
        sumSquares += current * current;
      }

      if (!Number.isFinite(sumSquares) || sumSquares <= 0) {
        return null;
      }

      const norm = Math.sqrt(sumSquares);
      if (!Number.isFinite(norm) || norm <= 0) {
        return null;
      }

      const normalized = new Float32Array(input.length);
      for (let index = 0; index < input.length; index += 1) {
        normalized[index] = Number(input[index] || 0) / norm;
      }

      return normalized;
    }

    function cosineSimilarity(left: unknown, right: unknown): number | null {
      const normalizedLeft = l2NormalizeVector(left);
      const normalizedRight = l2NormalizeVector(right);
      if (!normalizedLeft || !normalizedRight || normalizedLeft.length !== normalizedRight.length) {
        return null;
      }

      let dot = 0;
      for (let index = 0; index < normalizedLeft.length; index += 1) {
        dot += normalizedLeft[index] * normalizedRight[index];
      }

      if (!Number.isFinite(dot)) {
        return null;
      }

      return Math.max(-1, Math.min(1, dot));
    }

    function createImageSimilarityService(options?: unknown): ISService {
      const config = options && typeof options === "object" ? (options as ISServiceOptions) : {};
      const cacheMaxEntries = normalizePositiveInteger(config.cacheMaxEntries, DEFAULT_CACHE_MAX_ENTRIES);
      const serviceColdStartBudgetMs = normalizeDurationMs(
        config.coldStartBudgetMs,
        DEFAULT_COLD_START_BUDGET_MS
      );
      const loadGrayscaleGrid =
        typeof config.loadGrayscaleGrid === "function" ? config.loadGrayscaleGrid : null;
      const loadDecodedImage =
        typeof config.loadDecodedImage === "function" ? config.loadDecodedImage : defaultLoadDecodedImage;
      const resolveAssetUrl =
        typeof config.resolveAssetUrl === "function"
          ? config.resolveAssetUrl
          : function (assetPath: string): string {
              const runtime = getRuntime();
              if (runtime && typeof runtime.getURL === "function") {
                try {
                  return runtime.getURL(assetPath);
                } catch (_) {
                  return assetPath;
                }
              }

              return assetPath;
            };

      const createInputTensor =
        typeof config.createInputTensor === "function"
          ? config.createInputTensor
          : function (data: Float32Array, dims: [number, number, number, number]): unknown {
              const ort = getOrt();
              if (!ort || typeof ort.Tensor !== "function") {
                return null;
              }

              return new ort.Tensor("float32", data, dims);
            };

      const createInferenceSession =
        typeof config.createInferenceSession === "function"
          ? config.createInferenceSession
          : function (
              modelUrl: string,
              sessionOptions: Record<string, unknown>
            ): Promise<ISOrtSessionLike | null> {
              const ort = getOrt();
              if (
                !ort ||
                !ort.env ||
                !ort.env.wasm ||
                !ort.InferenceSession ||
                typeof ort.InferenceSession.create !== "function"
              ) {
                return Promise.resolve(null);
              }

              ort.env.wasm.proxy = false;
              ort.env.wasm.numThreads = 1;
              ort.env.wasm.wasmPaths = {
                "ort-wasm-simd-threaded.wasm": resolveAssetUrl(
                  normalizeString(config.wasmAssetPath, WASM_ASSET_PATH)
                )
              };

              return ort.InferenceSession.create(modelUrl, sessionOptions).catch(function () {
                return null;
              });
            };

      const decodedImagePromiseByUrl = new Map<string, Promise<ISDecodedImage | null>>();
      const hashPromiseByUrl = new Map<string, Promise<string | null>>();
      const embeddingPromiseByUrl = new Map<string, Promise<Float32Array | null>>();
      let sessionPromise: Promise<ISOrtSessionLike | null> | null = null;

      function touchCacheEntry<T>(cache: Map<string, Promise<T>>, key: string, value: Promise<T>): void {
        cache.delete(key);
        cache.set(key, value);
        while (cache.size > cacheMaxEntries) {
          const firstKey = cache.keys().next();
          if (firstKey && !firstKey.done) {
            cache.delete(firstKey.value);
          } else {
            break;
          }
        }
      }

      function getDecodedImage(url: string): Promise<ISDecodedImage | null> {
        const normalizedUrl = normalizeString(url, "");
        if (!normalizedUrl) {
          return Promise.resolve(null);
        }

        const cached = decodedImagePromiseByUrl.get(normalizedUrl);
        if (cached) {
          touchCacheEntry(decodedImagePromiseByUrl, normalizedUrl, cached);
          return cached;
        }

        const promise = Promise.resolve(loadDecodedImage(normalizedUrl)).catch(function () {
          return null;
        });
        touchCacheEntry(decodedImagePromiseByUrl, normalizedUrl, promise);
        return promise;
      }

      function getFingerprintHash(url: string): Promise<string | null> {
        const normalizedUrl = normalizeString(url, "");
        if (!normalizedUrl) {
          return Promise.resolve(null);
        }

        const cached = hashPromiseByUrl.get(normalizedUrl);
        if (cached) {
          touchCacheEntry(hashPromiseByUrl, normalizedUrl, cached);
          return cached;
        }

        const promise = (loadGrayscaleGrid
          ? Promise.resolve(loadGrayscaleGrid(normalizedUrl, HASH_GRID_WIDTH, HASH_GRID_HEIGHT))
          : getDecodedImage(normalizedUrl).then(function (decoded) {
              if (!decoded) {
                return null;
              }

              const resized = resizeRgbaBilinear(
                decoded.data,
                decoded.width,
                decoded.height,
                HASH_GRID_WIDTH,
                HASH_GRID_HEIGHT
              );
              return toLumaGrid(resized, HASH_GRID_WIDTH, HASH_GRID_HEIGHT);
            }))
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

        touchCacheEntry(hashPromiseByUrl, normalizedUrl, promise);
        return promise;
      }

      function getSession(): Promise<ISOrtSessionLike | null> {
        if (sessionPromise) {
          return sessionPromise;
        }

        const modelUrl = resolveAssetUrl(normalizeString(config.modelAssetPath, MODEL_ASSET_PATH));
        sessionPromise = Promise.resolve(
          createInferenceSession(modelUrl, {
            executionProviders: ["wasm"]
          })
        ).catch(function () {
          return null;
        });

        return sessionPromise;
      }

      function waitForWarmSession(coldStartBudgetMs: number): Promise<ISOrtSessionLike | null> {
        const session = getSession();
        if (coldStartBudgetMs <= 0) {
          return Promise.resolve(null);
        }

        return Promise.race([
          session,
          new Promise<ISOrtSessionLike | null>(function (resolve) {
            if (typeof setTimeout !== "function") {
              resolve(null);
              return;
            }

            setTimeout(function () {
              resolve(null);
            }, coldStartBudgetMs);
          })
        ]);
      }

      function extractEmbeddingVector(value: unknown): Float32Array | null {
        if (!isObjectRecord(value)) {
          return null;
        }

        const data = value.data;
        return l2NormalizeVector(data);
      }

      async function getEmbedding(url: string, session: ISOrtSessionLike): Promise<Float32Array | null> {
        const normalizedUrl = normalizeString(url, "");
        if (!normalizedUrl || !session || typeof session.run !== "function") {
          return null;
        }
        const runSession = session.run.bind(session);

        const cached = embeddingPromiseByUrl.get(normalizedUrl);
        if (cached) {
          touchCacheEntry(embeddingPromiseByUrl, normalizedUrl, cached);
          return cached;
        }

        const promise = getDecodedImage(normalizedUrl)
          .then(async function (decoded) {
            if (!decoded) {
              return null;
            }

            const modelInput = buildModelInputTensor(decoded.data, decoded.width, decoded.height);
            if (!modelInput) {
              return null;
            }

            const inputTensor = createInputTensor(modelInput.data, modelInput.dims);
            if (!inputTensor) {
              return null;
            }

            const inputName =
              Array.isArray(session.inputNames) && session.inputNames.length
                ? normalizeString(session.inputNames[0], "pixel_values")
                : "pixel_values";
            const outputs = await runSession({
              [inputName]: inputTensor
            });
            if (!isObjectRecord(outputs)) {
              return null;
            }

            const outputName =
              Array.isArray(session.outputNames) && session.outputNames.length
                ? normalizeString(session.outputNames[0], "")
                : "";
            const firstValue =
              (outputName && outputs[outputName]) ||
              outputs[Object.keys(outputs)[0] || ""] ||
              null;
            return extractEmbeddingVector(firstValue);
          })
          .catch(function () {
            return null;
          });

        touchCacheEntry(embeddingPromiseByUrl, normalizedUrl, promise);
        return promise;
      }

      async function preloadModel(): Promise<void> {
        await getSession();
      }

      async function compareImageUrls(
        leftUrl: unknown,
        rightUrl: unknown,
        options?: unknown
      ): Promise<ISCompareResult> {
        const compareOptions =
          options && typeof options === "object" ? (options as ISCompareOptions) : {};
        const left = normalizeString(leftUrl, "");
        const right = normalizeString(rightUrl, "");
        if (!left || !right) {
          return {
            score: null,
            usedImage: false,
            reason: "missing_url",
            signalType: ""
          };
        }

        const mlEnabled = compareOptions.mlEnabled !== false;
        const coldStartBudgetMs = normalizeDurationMs(
          compareOptions.coldStartBudgetMs,
          serviceColdStartBudgetMs
        );

        if (mlEnabled) {
          const session = await waitForWarmSession(coldStartBudgetMs);
          if (session) {
            const [leftEmbedding, rightEmbedding] = await Promise.all([
              getEmbedding(left, session),
              getEmbedding(right, session)
            ]);
            const cosine = cosineSimilarity(leftEmbedding, rightEmbedding);
            if (cosine != null) {
              return {
                score: Math.max(0, Math.min(100, Math.round(Math.max(0, cosine) * 100))),
                usedImage: true,
                reason: "ok",
                signalType: "ml_embedding"
              };
            }
          }
        } else {
          void getSession();
        }

        if (!loadGrayscaleGrid && !hasBitmapDecodeSupport() && !hasDomCanvasSupport() && typeof config.loadDecodedImage !== "function") {
          return {
            score: null,
            usedImage: false,
            reason: "unsupported_environment",
            signalType: ""
          };
        }

        const [leftHash, rightHash] = await Promise.all([getFingerprintHash(left), getFingerprintHash(right)]);
        const hashScore = compareHashes(leftHash, rightHash);
        if (hashScore != null) {
          return {
            score: hashScore,
            usedImage: true,
            reason: "ok",
            signalType: "thumbnail_fingerprint"
          };
        }

        return {
          score: null,
          usedImage: false,
          reason: "visual_unavailable",
          signalType: ""
        };
      }

      return {
        compareImageUrls: compareImageUrls,
        preloadModel: preloadModel
      };
    }

    const defaultService = createImageSimilarityService();

    return {
      createImageSimilarityService: createImageSimilarityService,
      compareImageUrls: defaultService.compareImageUrls,
      preloadModel: defaultService.preloadModel,
      computeDifferenceHash: computeDifferenceHash,
      compareHashes: compareHashes,
      buildModelInputTensor: buildModelInputTensor,
      l2NormalizeVector: l2NormalizeVector,
      cosineSimilarity: cosineSimilarity
    };
  }
);
