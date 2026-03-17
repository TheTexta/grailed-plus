declare global {
  interface BrowserStorageAreaLike {
    get?: (...args: unknown[]) => unknown;
    set?: (...args: unknown[]) => unknown;
  }

  interface BrowserRuntimeLike {
    lastError?: unknown;
    openOptionsPage?: () => unknown;
    sendMessage?: (...args: unknown[]) => unknown;
    onMessage?: {
      addListener?: (...args: unknown[]) => unknown;
    };
  }

  var chrome:
    | {
        storage?: {
          local?: BrowserStorageAreaLike;
        };
        runtime?: BrowserRuntimeLike;
      }
    | undefined;

  var browser:
    | {
        storage?: {
          local?: BrowserStorageAreaLike;
        };
        runtime?: BrowserRuntimeLike;
      }
    | undefined;

  interface Window {
    GrailedPlusCurrency?: unknown;
    GrailedPlusDepopProvider?: unknown;
    GrailedPlusListingExtractor?: unknown;
    GrailedPlusListingModel?: unknown;
    GrailedPlusNormalize?: unknown;
    GrailedPlusPricingInsights?: unknown;
    GrailedPlusQuerySynthesis?: unknown;
    GrailedPlusRenderInsightsPanel?: unknown;
    GrailedPlusRuntimeState?: unknown;
    GrailedPlusSettings?: unknown;
    GrailedPlusTheme?: unknown;
    GrailedPlusUrl?: unknown;
  }
}

export {};
