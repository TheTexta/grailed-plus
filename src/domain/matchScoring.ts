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
  imageUnavailableReason: string;
  components: {
    imageScore: number | null;
    titleScore: number;
    brandScore: number;
    sizeScore: number;
    conditionScore: number;
  };
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  raw: unknown;
}

interface MSModule {
  rankCandidates: (listing: MSListingInput, candidates: unknown, options: unknown) => MSScoredCandidate[];
  scoreCandidate: (listing: MSListingInput, candidate: MSCandidateInput, options: unknown) => MSScoredCandidate;
  overlapScore: (leftValue: unknown, rightValue: unknown) => number;
  convertBetweenCurrencies: (
    amount: unknown,
    fromCurrency: unknown,
    toCurrency: unknown,
    ratesByUsd: Record<string, unknown> | null | undefined
  ) => number | null;
}

interface MSGlobalRoot {
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

    function normalizeString(value: unknown, fallback: string): string {
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed || fallback;
      }
      return fallback;
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
      if (typeof value !== "string") {
        return fallback;
      }

      const upper = value.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(upper)) {
        return fallback;
      }
      return upper;
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

    function overlapScore(leftValue: unknown, rightValue: unknown): number {
      const leftTokens = tokenize(leftValue);
      const rightTokens = tokenize(rightValue);
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
    ): { score: number | null; usedImage: boolean; reason: string } {
      const left = normalizeString(listingImageUrl, "");
      const right = normalizeString(candidateImageUrl, "");

      if (!left || !right) {
        return {
          score: null,
          usedImage: false,
          reason: "missing_url"
        };
      }

      const score = overlapScore(left, right);
      return {
        score: Math.max(0, Math.min(100, Math.round(score))),
        usedImage: true,
        reason: "ok"
      };
    }

    function scoreBrand(listing: MSListingInput, candidate: MSCandidateInput): number {
      const left = normalizeString(
        listing && (listing.brand || (listing.rawListing && listing.rawListing.brand)),
        ""
      ).toLowerCase();
      const right = normalizeString(candidate && candidate.brand, "").toLowerCase();

      if (!left || !right) {
        return 0;
      }

      return left === right ? 100 : 0;
    }

    function scoreSize(listing: MSListingInput, candidate: MSCandidateInput): number {
      const left = normalizeString(
        listing && (listing.size || (listing.rawListing && listing.rawListing.size)),
        ""
      ).toLowerCase();
      const right = normalizeString(candidate && candidate.size, "").toLowerCase();

      if (!left || !right) {
        return 0;
      }

      return left === right ? 100 : 0;
    }

    function scoreCondition(listing: MSListingInput, candidate: MSCandidateInput): number {
      const left = normalizeString(listing && listing.rawListing && listing.rawListing.condition, "").toLowerCase();
      const right = normalizeString(candidate && candidate.condition, "").toLowerCase();

      if (!left || !right) {
        return 0;
      }

      return left === right ? 100 : overlapScore(left, right);
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

    function scoreCandidate(
      listing: MSListingInput,
      candidate: MSCandidateInput,
      options: unknown
    ): MSScoredCandidate {
      const config = options && typeof options === "object" ? (options as MSOptions) : {};
      const listingTitle = normalizeString(listing && listing.title, "");
      const candidateTitle = normalizeString(candidate && candidate.title, "");
      const candidateTitleHint = getUrlTitleHint(candidate && candidate.url);
      const candidateTitleForScore = [candidateTitle, candidateTitleHint].filter(Boolean).join(" ");
      const listingImageUrl =
        normalizeString(listing && listing.imageUrl, "") ||
        normalizeString(listing && listing.rawListing && listing.rawListing.coverPhoto && listing.rawListing.coverPhoto.url, "") ||
        normalizeString(listing && listing.rawListing && listing.rawListing.photo && listing.rawListing.photo.url, "");

      const imageResult = imageHeuristicScore(listingImageUrl, candidate && candidate.imageUrl);
      const imageScore = imageResult.score;
      const titleScore = Math.max(
        overlapScore(listingTitle, candidateTitle),
        overlapScore(listingTitle, candidateTitleForScore)
      );
      const brandScore = scoreBrand(listing, candidate);
      const sizeScore = scoreSize(listing, candidate);
      const conditionScore = scoreCondition(listing, candidate);

      let weightedScore: number;
      if (imageScore == null) {
        weightedScore = titleScore * 0.45 + brandScore * 0.28 + sizeScore * 0.18 + conditionScore * 0.09;
        weightedScore = weightedScore * 0.95;
      } else {
        weightedScore =
          imageScore * 0.45 +
          titleScore * 0.25 +
          brandScore * 0.15 +
          sizeScore * 0.1 +
          conditionScore * 0.05;
      }

      const finalScore = Math.max(0, Math.min(100, Math.round(weightedScore)));

      const listingPriceUsd = normalizeNumber(config.listingPriceUsd);
      const candidateAmount = normalizeNumber(candidate && candidate.price);
      const candidateCurrency = normalizeCurrencyCode(candidate && candidate.currency, "USD");
      const selectedCurrency = normalizeCurrencyCode(config.selectedCurrency, "USD");
      const rate = normalizeNumber(config.rate);
      const ratesByUsd =
        config && config.ratesByUsd && typeof config.ratesByUsd === "object"
          ? (config.ratesByUsd as Record<string, unknown>)
          : null;

      const listingComparable = convertUsdPrice(listingPriceUsd, selectedCurrency, rate);
      let candidateComparable = convertBetweenCurrencies(
        candidateAmount,
        candidateCurrency,
        selectedCurrency,
        ratesByUsd
      );

      if (candidateComparable == null) {
        candidateComparable = convertUsdPrice(candidateAmount, selectedCurrency, rate);
      }

      let deltaAbsolute: number | null = null;
      let deltaPercent: number | null = null;
      if (listingComparable != null && candidateComparable != null && listingComparable !== 0) {
        deltaAbsolute = candidateComparable - listingComparable;
        deltaPercent = (deltaAbsolute / listingComparable) * 100;
      }

      return {
        id: candidate.id,
        title: candidate.title,
        url: candidate.url,
        imageUrl: normalizeString(candidate.imageUrl, ""),
        market: normalizeString(candidate.market, "depop"),
        currency: selectedCurrency,
        price: candidateComparable != null ? candidateComparable : candidateAmount,
        originalCurrency: candidateCurrency,
        originalPrice: candidateAmount,
        score: finalScore,
        usedImage: imageResult.usedImage,
        imageUnavailableReason: imageResult.usedImage ? "" : imageResult.reason,
        components: {
          imageScore: imageScore,
          titleScore: Math.round(titleScore),
          brandScore: Math.round(brandScore),
          sizeScore: Math.round(sizeScore),
          conditionScore: Math.round(conditionScore)
        },
        deltaAbsolute: deltaAbsolute,
        deltaPercent: deltaPercent,
        raw: candidate.raw || null
      };
    }

    function rankCandidates(listing: MSListingInput, candidates: unknown, options: unknown): MSScoredCandidate[] {
      const list = Array.isArray(candidates) ? (candidates as MSCandidateInput[]) : [];
      const config = options && typeof options === "object" ? (options as MSOptions) : {};
      const minScore = Number.isFinite(Number(config.minScore)) ? Number(config.minScore) : 40;

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

    return {
      rankCandidates: rankCandidates,
      scoreCandidate: scoreCandidate,
      overlapScore: overlapScore,
      convertBetweenCurrencies: convertBetweenCurrencies
    };
  }
);