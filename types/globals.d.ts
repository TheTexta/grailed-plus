declare global {
  var chrome:
    | {
        storage?: {
          local?: {
            get?: (...args: unknown[]) => unknown;
            set?: (...args: unknown[]) => unknown;
          };
        };
        runtime?: {
          lastError?: unknown;
        };
      }
    | undefined;

  var browser:
    | {
        storage?: {
          local?: {
            get?: (...args: unknown[]) => unknown;
            set?: (...args: unknown[]) => unknown;
          };
        };
        runtime?: {
          lastError?: unknown;
        };
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
