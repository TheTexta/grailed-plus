interface MSCandidateInput {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  imageUrl?: unknown;
  market?: unknown;
  currency?: unknown;
  price?: unknown;
  brand?: unknown;
  size?: unknown;
  condition?: unknown;
  raw?: unknown;
}

interface MSListingRaw {
  brand?: unknown;
  size?: unknown;
  condition?: unknown;
  coverPhoto?: { url?: unknown };
  photo?: { url?: unknown };
}

interface MSListingInput {
  title?: unknown;
  brand?: unknown;
  size?: unknown;
  imageUrl?: unknown;
  rawListing?: MSListingRaw;
}

interface MSOptions {
  listingPriceUsd?: unknown;
  selectedCurrency?: unknown;
  rate?: unknown;
  ratesByUsd?: Record<string, unknown> | null;
  minScore?: unknown;
  rankingFormula?: unknown;
  mlSimilarityEnabled?: unknown;
}

interface MSScoredCandidate {
  id: unknown;
  title: unknown;
  url: unknown;
  imageUrl: string;
  market: string;
  currency: string;
  price: number | null;
  originalCurrency: string;
  originalPrice: number | null;
  score: number;
  usedImage: boolean;
  imageSignalType: string;
  imageUnavailableReason: string;
  components: {
    imageSimilarityScore: number | null;
    titleScore: number;
    brandScore: number | null;
    sizeScore: number | null;
    conditionScore: number | null;
    priceScore: number | null;
  };
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  raw: unknown;
}

type MSRankingFormula = "balanced" | "visual" | "metadata" | "variant";
type MSSignalKey = "imageHeuristic" | "title" | "brand" | "size" | "condition" | "price";

interface MSModule {
  rankCandidates: (listing: MSListingInput, candidates: unknown, options: unknown) => MSScoredCandidate[];
  rankCandidatesAsync: (
    listing: MSListingInput,
    candidates: unknown,
    options: unknown
  ) => Promise<MSScoredCandidate[]>;
  scoreCandidate: (listing: MSListingInput, candidate: MSCandidateInput, options: unknown) => MSScoredCandidate;
  scoreCandidateAsync: (
    listing: MSListingInput,
    candidate: MSCandidateInput,
    options: unknown
  ) => Promise<MSScoredCandidate>;
  overlapScore: (leftValue: unknown, rightValue: unknown) => number;
  convertBetweenCurrencies: (
    amount: unknown,
    fromCurrency: unknown,
    toCurrency: unknown,
    ratesByUsd: Record<string, unknown> | null | undefined
  ) => number | null;
}

interface MSGlobalRoot {
  GrailedPlusNormalize?: {
    normalizeTrimmedString?: (value: unknown, fallback: string) => string;
    normalizeThreeLetterCurrencyCode?: (value: unknown) => string | null;
  };
  GrailedPlusImageSimilarity?: {
    compareImageUrls?: (
      leftUrl: unknown,
      rightUrl: unknown,
      options?: unknown
    ) => Promise<{ score: number | null; usedImage: boolean; reason: string; signalType?: string }>;
    preloadModel?: () => Promise<void>;
  };
  GrailedPlusMatchScoring?: MSModule;
}

(function (root: MSGlobalRoot, factory: () => MSModule) {
  if (typeof module === "object" && module && module.exports) {
    module.exports = factory();
  } else {
    root.GrailedPlusMatchScoring = factory();
  }
})(
  typeof globalThis !== "undefined" ? (globalThis as unknown as MSGlobalRoot) : {},
  function () {
    "use strict";

    const IMAGE_HEURISTIC_STOPWORDS: Record<string, boolean> = {
      asset: true,
      assets: true,
      cache: true,
      cached: true,
      cdn: true,
      crop: true,
      default: true,
      delivery: true,
      file: true,
      files: true,
      fill: true,
      fit: true,
      format: true,
      image: true,
      images: true,
      img: true,
      media: true,
      original: true,
      photo: true,
      photos: true,
      picture: true,
      pictures: true,
      preview: true,
      previews: true,
      product: true,
      products: true,
      public: true,
      quality: true,
      static: true,
      thumb: true,
      thumbs: true,
      thumbnail: true,
      thumbnails: true,
      upload: true,
      uploads: true
    };
    const GENERIC_BRAND_VALUES: Record<string, boolean> = {
      "n a": true,
      "na": true,
      "no brand": true,
      none: true,
      other: true,
      "other brand": true,
      "not specified": true,
      unbranded: true,
      unknown: true,
      vintage: true
    };
    const RANKING_FORMULA_WEIGHTS: Record<MSRankingFormula, Record<MSSignalKey, number>> = {
      balanced: {
        imageHeuristic: 0.22,
        title: 0.34,
        brand: 0.06,
        size: 0.16,
        condition: 0.08,
        price: 0.14
      },
      visual: {
        imageHeuristic: 0.5,
        title: 0.2,
        brand: 0.08,
        size: 0.1,
        condition: 0.05,
        price: 0.07
      },
      metadata: {
        imageHeuristic: 0.08,
        title: 0.58,
        brand: 0.08,
        size: 0.1,
        condition: 0.06,
        price: 0.1
      },
      variant: {
        imageHeuristic: 0.06,
        title: 0.22,
        brand: 0.16,
        size: 0.3,
        condition: 0.18,
        price: 0.08
      }
    };

    let Normalize: MSGlobalRoot["GrailedPlusNormalize"] | null = null;
    let ImageSimilarity: MSGlobalRoot["GrailedPlusImageSimilarity"] | null = null;
    if (typeof globalThis !== "undefined" && (globalThis as unknown as MSGlobalRoot).GrailedPlusNormalize) {
      Normalize = (globalThis as unknown as MSGlobalRoot).GrailedPlusNormalize || null;
    }
    if (!Normalize && typeof require === "function") {
      try {
        Normalize = require("./normalize");
      } catch (_) {
        Normalize = null;
      }
    }
    if (typeof globalThis !== "undefined" && (globalThis as unknown as MSGlobalRoot).GrailedPlusImageSimilarity) {
      ImageSimilarity = (globalThis as unknown as MSGlobalRoot).GrailedPlusImageSimilarity || null;
    }
    if (!ImageSimilarity && typeof require === "function") {
      try {
        ImageSimilarity = require("./imageSimilarity");
      } catch (_) {
        ImageSimilarity = null;
      }
    }

    function normalizeString(value: unknown, fallback: string): string {
      if (Normalize && typeof Normalize.normalizeTrimmedString === "function") {
        return Normalize.normalizeTrimmedString(value, fallback);
      }

      if (typeof value !== "string") {
        return fallback;
      }

      const trimmed = value.trim();
      return trimmed || fallback;
    }

    function normalizeNumber(value: unknown): number | null {
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
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizeCurrencyCode(value: unknown, fallback: string): string {
      if (Normalize && typeof Normalize.normalizeThreeLetterCurrencyCode === "function") {
        return Normalize.normalizeThreeLetterCurrencyCode(value) || fallback;
      }

      if (typeof value !== "string") {
        return fallback;
      }

      const upper = value.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(upper)) {
        return fallback;
      }
      return upper;
    }

    function normalizeRankingFormula(value: unknown): MSRankingFormula {
      const normalized = normalizeString(value, "").toLowerCase();
      if (
        normalized === "visual" ||
        normalized === "metadata" ||
        normalized === "variant"
      ) {
        return normalized;
      }
      return "balanced";
    }

    function tokenize(value: unknown): string[] {
      const normalized = normalizeString(value, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!normalized) {
        return [];
      }

      return normalized.split(" ").filter(Boolean);
    }

    function uniqueTokens(tokens: string[]): string[] {
      const seen: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
      const result: string[] = [];
      tokens.forEach(function (token) {
        if (!token || seen[token]) {
          return;
        }
        seen[token] = true;
        result.push(token);
      });
      return result;
    }

    function overlapScore(leftValue: unknown, rightValue: unknown): number {
      const leftTokens = uniqueTokens(tokenize(leftValue));
      const rightTokens = uniqueTokens(tokenize(rightValue));
      if (!leftTokens.length || !rightTokens.length) {
        return 0;
      }

      const rightSet: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
      rightTokens.forEach(function (token) {
        rightSet[token] = true;
      });

      let overlap = 0;
      leftTokens.forEach(function (token) {
        if (rightSet[token]) {
          overlap += 1;
        }
      });

      const denom = Math.max(leftTokens.length, rightTokens.length);
      if (!denom) {
        return 0;
      }

      return (overlap / denom) * 100;
    }

    function normalizeComparableText(value: unknown): string {
      return normalizeString(value, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function safeDecodeURIComponent(value: string): string {
      try {
        return decodeURIComponent(value);
      } catch (_) {
        return value;
      }
    }

    function extractUrlPath(value: unknown): string {
      const raw = normalizeString(value, "");
      if (!raw) {
        return "";
      }

      try {
        return new URL(raw, "https://grailed.plus.invalid").pathname || "";
      } catch (_) {
        const withoutHash = raw.split("#")[0] || "";
        return withoutHash.split("?")[0] || "";
      }
    }

    function isHashLikeToken(token: string): boolean {
      if (!token || token.length < 10) {
        return false;
      }

      if (/^[a-f0-9]{10,}$/i.test(token)) {
        return true;
      }

      return token.length >= 12 && /[a-z]/i.test(token) && /\d/.test(token);
    }

    function shouldSkipImageToken(token: string): boolean {
      if (!token) {
        return true;
      }

      if (IMAGE_HEURISTIC_STOPWORDS[token]) {
        return true;
      }

      if (token.length <= 1) {
        return true;
      }

      if (
        /^\d+$/.test(token) ||
        /^\d+x\d+$/.test(token) ||
        /^[wh]\d+$/i.test(token) ||
        /^q\d+$/i.test(token) ||
        /^v\d+$/i.test(token) ||
        /^p\d+$/i.test(token) ||
        /^size\d+$/i.test(token)
      ) {
        return true;
      }

      return isHashLikeToken(token);
    }

    function extractImagePathSignal(url: unknown): {
      fileStem: string;
      pathStem: string;
      combinedStem: string;
    } {
      const pathname = extractUrlPath(url);
      if (!pathname) {
        return {
          fileStem: "",
          pathStem: "",
          combinedStem: ""
        };
      }

      const segments = pathname
        .split("/")
        .filter(Boolean)
        .slice(-3)
        .map(function (segment, index, all) {
          const decoded = safeDecodeURIComponent(segment).toLowerCase();
          const withoutExtension =
            index === all.length - 1 ? decoded.replace(/\.[a-z0-9]{2,5}$/i, "") : decoded;
          return uniqueTokens(
            withoutExtension
              .replace(/[_+]+/g, "-")
              .split(/[^a-z0-9]+/g)
              .filter(Boolean)
              .filter(function (token) {
                return !shouldSkipImageToken(token);
              })
          );
        });

      const fileTokens = segments.length ? segments[segments.length - 1] : [];
      const pathTokens = uniqueTokens(
        segments.slice(0, Math.max(0, segments.length - 1)).reduce(function (all, entry) {
          return all.concat(entry);
        }, [] as string[])
      );
      const combinedTokens = uniqueTokens(pathTokens.concat(fileTokens));

      return {
        fileStem: fileTokens.join(" "),
        pathStem: pathTokens.join(" "),
        combinedStem: combinedTokens.join(" ")
      };
    }

    function getUrlTitleHint(url: unknown): string {
      const raw = normalizeString(url, "");
      if (!raw) {
        return "";
      }

      const withoutHash = raw.split("#")[0] || "";
      const withoutQuery = withoutHash.split("?")[0] || "";
      const segments = withoutQuery.split("/").filter(Boolean);
      if (!segments.length) {
        return "";
      }

      const last = segments[segments.length - 1] || "";
      const prev = segments.length > 1 ? segments[segments.length - 2] : "";
      let slug = last.toLowerCase() === "products" ? "" : last;

      if (!slug && prev.toLowerCase() !== "products") {
        slug = prev;
      }

      return String(slug)
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function imageHeuristicScore(
      listingImageUrl: unknown,
      candidateImageUrl: unknown
    ): { score: number | null; usedImage: boolean; reason: string; signalType: string } {
      const left = normalizeString(listingImageUrl, "");
      const right = normalizeString(candidateImageUrl, "");

      if (!left || !right) {
        return {
          score: null,
          usedImage: false,
          reason: "missing_url",
          signalType: ""
        };
      }

      const leftSignal = extractImagePathSignal(left);
      const rightSignal = extractImagePathSignal(right);
      if (!leftSignal.combinedStem || !rightSignal.combinedStem) {
        return {
          score: null,
          usedImage: false,
          reason: "no_usable_signal",
          signalType: ""
        };
      }

      let score = overlapScore(leftSignal.combinedStem, rightSignal.combinedStem);
      if (
        leftSignal.fileStem &&
        rightSignal.fileStem &&
        leftSignal.fileStem === rightSignal.fileStem
      ) {
        score = 100;
      } else if (leftSignal.fileStem && rightSignal.fileStem) {
        score = Math.max(score, overlapScore(leftSignal.fileStem, rightSignal.fileStem));
      }

      return {
        score: Math.max(0, Math.min(100, Math.round(score))),
        usedImage: true,
        reason: "ok",
        signalType: "url_heuristic"
      };
    }

    function buildListingImageUrl(listing: MSListingInput): string {
      return (
        normalizeString(listing && listing.imageUrl, "") ||
        normalizeString(listing && listing.rawListing && listing.rawListing.coverPhoto && listing.rawListing.coverPhoto.url, "") ||
        normalizeString(listing && listing.rawListing && listing.rawListing.photo && listing.rawListing.photo.url, "")
      );
    }

    function scoreBrand(listing: MSListingInput, candidate: MSCandidateInput): number | null {
      const left = normalizeComparableText(
        listing && (listing.brand || (listing.rawListing && listing.rawListing.brand)),
      );
      const right = normalizeComparableText(candidate && candidate.brand);

      if (!left || !right || GENERIC_BRAND_VALUES[left] || GENERIC_BRAND_VALUES[right]) {
        return null;
      }

      return left === right ? 100 : 0;
    }

    function scoreSize(listing: MSListingInput, candidate: MSCandidateInput): number | null {
      const left = normalizeComparableText(
        listing && (listing.size || (listing.rawListing && listing.rawListing.size)),
      );
      const right = normalizeComparableText(candidate && candidate.size);

      if (!left || !right) {
        return null;
      }

      return left === right ? 100 : 0;
    }

    function scoreCondition(listing: MSListingInput, candidate: MSCandidateInput): number | null {
      const left = normalizeComparableText(listing && listing.rawListing && listing.rawListing.condition);
      const right = normalizeComparableText(candidate && candidate.condition);

      if (!left || !right) {
        return null;
      }

      return left === right ? 100 : overlapScore(left, right);
    }

    function scorePriceDelta(
      listingComparable: number | null,
      candidateComparable: number | null
    ): number | null {
      if (
        listingComparable == null ||
        candidateComparable == null ||
        !Number.isFinite(listingComparable) ||
        !Number.isFinite(candidateComparable) ||
        listingComparable <= 0
      ) {
        return null;
      }

      const deltaPercent = Math.abs(((candidateComparable - listingComparable) / listingComparable) * 100);
      return Math.max(0, Math.min(100, 100 - deltaPercent));
    }

    function getRateForCurrency(
      currencyCode: string,
      ratesByUsd: Record<string, unknown> | null | undefined
    ): number | null {
      if (!ratesByUsd || typeof ratesByUsd !== "object") {
        return null;
      }

      if (currencyCode === "USD") {
        return 1;
      }

      const value = normalizeNumber(ratesByUsd[currencyCode]);
      return value != null && value > 0 ? value : null;
    }

    function convertBetweenCurrencies(
      amount: unknown,
      fromCurrency: unknown,
      toCurrency: unknown,
      ratesByUsd: Record<string, unknown> | null | undefined
    ): number | null {
      const amountValue = normalizeNumber(amount);
      if (amountValue == null) {
        return null;
      }

      const from = normalizeCurrencyCode(fromCurrency, "USD");
      const to = normalizeCurrencyCode(toCurrency, "USD");

      if (from === to) {
        return amountValue;
      }

      const fromRate = getRateForCurrency(from, ratesByUsd);
      const toRate = getRateForCurrency(to, ratesByUsd);
      if (fromRate == null || toRate == null || fromRate <= 0 || toRate <= 0) {
        return null;
      }

      const amountUsd = from === "USD" ? amountValue : amountValue / fromRate;
      if (!Number.isFinite(amountUsd)) {
        return null;
      }

      return to === "USD" ? amountUsd : amountUsd * toRate;
    }

    function convertUsdPrice(amountUsd: unknown, selectedCurrency: unknown, rate: unknown): number | null {
      const amount = normalizeNumber(amountUsd);
      if (amount == null) {
        return null;
      }

      const currency = normalizeCurrencyCode(selectedCurrency, "USD");
      if (currency === "USD") {
        return amount;
      }

      const normalizedRate = normalizeNumber(rate);
      if (normalizedRate == null || normalizedRate <= 0) {
        return amount;
      }

      return amount * normalizedRate;
    }

    function convertComparablePrice(
      amount: unknown,
      fromCurrency: unknown,
      selectedCurrency: unknown,
      rate: unknown,
      ratesByUsd: Record<string, unknown> | null | undefined
    ): number | null {
      const comparable = convertBetweenCurrencies(amount, fromCurrency, selectedCurrency, ratesByUsd);
      if (comparable != null) {
        return comparable;
      }

      const from = normalizeCurrencyCode(fromCurrency, "USD");
      if (from !== "USD") {
        return null;
      }

      return convertUsdPrice(amount, selectedCurrency, rate);
    }

    function computeWeightedScore(
      rankingFormula: MSRankingFormula,
      imageHeuristicScore: number | null,
      titleScore: number,
      brandScore: number | null,
      sizeScore: number | null,
      conditionScore: number | null,
      priceScore: number | null
    ): number {
      const signalScores: Record<MSSignalKey, number | null> = {
        imageHeuristic: imageHeuristicScore,
        title: titleScore,
        brand: brandScore,
        size: sizeScore,
        condition: conditionScore,
        price: priceScore
      };
      const weights = RANKING_FORMULA_WEIGHTS[rankingFormula];
      let totalWeight = 0;
      let weightedSum = 0;

      (Object.keys(weights) as MSSignalKey[]).forEach(function (key) {
        const score = signalScores[key];
        if (score == null || !Number.isFinite(score)) {
          return;
        }

        totalWeight += weights[key];
        weightedSum += weights[key] * Math.max(0, Math.min(100, score));
      });

      if (totalWeight <= 0) {
        return 0;
      }

      return weightedSum / totalWeight;
    }

    function scoreCandidate(
      listing: MSListingInput,
      candidate: MSCandidateInput,
      options: unknown
    ): MSScoredCandidate {
      const config = options && typeof options === "object" ? (options as MSOptions) : {};
      const imageResult = imageHeuristicScore(buildListingImageUrl(listing), candidate && candidate.imageUrl);
      return scoreCandidateFromImageResult(listing, candidate, config, imageResult);
    }

    async function resolveVisualImageScore(
      listingImageUrl: string,
      candidateImageUrl: unknown,
      config: MSOptions
    ): Promise<{ score: number | null; usedImage: boolean; reason: string; signalType: string }> {
      if (
        ImageSimilarity &&
        typeof ImageSimilarity.compareImageUrls === "function"
      ) {
        try {
          const result = await ImageSimilarity.compareImageUrls(listingImageUrl, candidateImageUrl, {
            mlEnabled: config.mlSimilarityEnabled !== false
          });
          if (result && result.reason !== "unsupported_environment") {
            return {
              score: result.score,
              usedImage: result.usedImage,
              reason: result.reason,
              signalType: normalizeString(result.signalType, result.usedImage ? "thumbnail_fingerprint" : "")
            };
          }
        } catch (_) {
          return {
            score: null,
            usedImage: false,
            reason: "visual_unavailable",
            signalType: ""
          };
        }
      }

      return imageHeuristicScore(listingImageUrl, candidateImageUrl);
    }

    function scoreCandidateFromImageResult(
      listing: MSListingInput,
      candidate: MSCandidateInput,
      config: MSOptions,
      imageResult: { score: number | null; usedImage: boolean; reason: string; signalType: string }
    ): MSScoredCandidate {
      const rankingFormula = normalizeRankingFormula(config.rankingFormula);
      const listingTitle = normalizeString(listing && listing.title, "");
      const candidateTitle = normalizeString(candidate && candidate.title, "");
      const candidateTitleHint = getUrlTitleHint(candidate && candidate.url);
      const candidateTitleForScore = [candidateTitle, candidateTitleHint].filter(Boolean).join(" ");
      const imageSimilarityScoreValue = imageResult.score;
      const titleScore = Math.max(
        overlapScore(listingTitle, candidateTitle),
        overlapScore(listingTitle, candidateTitleForScore)
      );
      const brandScore = scoreBrand(listing, candidate);
      const sizeScore = scoreSize(listing, candidate);
      const conditionScore = scoreCondition(listing, candidate);

      const listingPriceUsd = normalizeNumber(config.listingPriceUsd);
      const candidateAmount = normalizeNumber(candidate && candidate.price);
      const candidateCurrency = normalizeCurrencyCode(candidate && candidate.currency, "USD");
      const selectedCurrency = normalizeCurrencyCode(config.selectedCurrency, "USD");
      const rate = normalizeNumber(config.rate);
      const ratesByUsd =
        config && config.ratesByUsd && typeof config.ratesByUsd === "object"
          ? (config.ratesByUsd as Record<string, unknown>)
          : null;

      const listingComparable = convertComparablePrice(
        listingPriceUsd,
        "USD",
        selectedCurrency,
        rate,
        ratesByUsd
      );
      const candidateComparable = convertComparablePrice(
        candidateAmount,
        candidateCurrency,
        selectedCurrency,
        rate,
        ratesByUsd
      );

      let deltaAbsolute: number | null = null;
      let deltaPercent: number | null = null;
      if (listingComparable != null && candidateComparable != null && listingComparable > 0) {
        deltaAbsolute = candidateComparable - listingComparable;
        deltaPercent = (deltaAbsolute / listingComparable) * 100;
      }

      const priceScore = scorePriceDelta(listingComparable, candidateComparable);
      const weightedScore = computeWeightedScore(
        rankingFormula,
        imageSimilarityScoreValue,
        titleScore,
        brandScore,
        sizeScore,
        conditionScore,
        priceScore
      );
      const finalScore = Math.max(0, Math.min(100, Math.round(weightedScore)));
      const displayPrice = candidateComparable != null ? candidateComparable : candidateAmount;
      const displayCurrency = candidateComparable != null ? selectedCurrency : candidateCurrency;

      return {
        id: candidate.id,
        title: candidate.title,
        url: candidate.url,
        imageUrl: normalizeString(candidate.imageUrl, ""),
        market: normalizeString(candidate.market, "depop"),
        currency: displayCurrency,
        price: displayPrice,
        originalCurrency: candidateCurrency,
        originalPrice: candidateAmount,
        score: finalScore,
        usedImage: imageResult.usedImage,
        imageSignalType: imageResult.usedImage ? normalizeString(imageResult.signalType, "") : "",
        imageUnavailableReason: imageResult.usedImage ? "" : imageResult.reason,
        components: {
          imageSimilarityScore: imageSimilarityScoreValue,
          titleScore: Math.round(titleScore),
          brandScore: brandScore == null ? null : Math.round(brandScore),
          sizeScore: sizeScore == null ? null : Math.round(sizeScore),
          conditionScore: conditionScore == null ? null : Math.round(conditionScore),
          priceScore: priceScore == null ? null : Math.round(priceScore)
        },
        deltaAbsolute: deltaAbsolute,
        deltaPercent: deltaPercent,
        raw: candidate.raw || null
      };
    }

    async function scoreCandidateAsync(
      listing: MSListingInput,
      candidate: MSCandidateInput,
      options: unknown
    ): Promise<MSScoredCandidate> {
      const config = options && typeof options === "object" ? (options as MSOptions) : {};
      const imageResult = await resolveVisualImageScore(
        buildListingImageUrl(listing),
        candidate && candidate.imageUrl,
        config
      );
      return scoreCandidateFromImageResult(listing, candidate, config, imageResult);
    }

    function rankCandidates(listing: MSListingInput, candidates: unknown, options: unknown): MSScoredCandidate[] {
      const list = Array.isArray(candidates) ? (candidates as MSCandidateInput[]) : [];
      const config = options && typeof options === "object" ? (options as MSOptions) : {};
      const minScore = Number.isFinite(Number(config.minScore)) ? Number(config.minScore) : 0;

      const scored = list
        .map(function (candidate) {
          return scoreCandidate(listing, candidate, config);
        })
        .filter(function (entry) {
          return Number.isFinite(entry.score) && entry.score >= minScore;
        })
        .sort(function (a, b) {
          if (b.score !== a.score) {
            return b.score - a.score;
          }

          if (Number.isFinite(a.price) && Number.isFinite(b.price) && a.price !== b.price) {
            return (a.price as number) - (b.price as number);
          }

          return String(a.id).localeCompare(String(b.id));
        });

      return scored;
    }

    async function rankCandidatesAsync(
      listing: MSListingInput,
      candidates: unknown,
      options: unknown
    ): Promise<MSScoredCandidate[]> {
      const list = Array.isArray(candidates) ? (candidates as MSCandidateInput[]) : [];
      const config = options && typeof options === "object" ? (options as MSOptions) : {};
      const minScore = Number.isFinite(Number(config.minScore)) ? Number(config.minScore) : 0;
      const scored = await Promise.all(
        list.map(function (candidate) {
          return scoreCandidateAsync(listing, candidate, config);
        })
      );

      return scored
        .filter(function (entry) {
          return Number.isFinite(entry.score) && entry.score >= minScore;
        })
        .sort(function (a, b) {
          if (b.score !== a.score) {
            return b.score - a.score;
          }

          if (Number.isFinite(a.price) && Number.isFinite(b.price) && a.price !== b.price) {
            return (a.price as number) - (b.price as number);
          }

          return String(a.id).localeCompare(String(b.id));
        });
    }

    return {
      rankCandidates: rankCandidates,
      rankCandidatesAsync: rankCandidatesAsync,
      scoreCandidate: scoreCandidate,
      scoreCandidateAsync: scoreCandidateAsync,
      overlapScore: overlapScore,
      convertBetweenCurrencies: convertBetweenCurrencies
    };
  }
);
