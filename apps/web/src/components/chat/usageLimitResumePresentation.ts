export function resolveUsageLimitResumePresentation(input: {
  readonly threadError: string | null;
  readonly visibleThreadError: string | null;
  readonly threadErrorIsUsageLimit: boolean;
  readonly canUseUsageLimitResume: boolean;
  readonly hasScheduledResume: boolean;
}): {
  readonly errorBannerError: string | null;
  readonly showStatusBanner: boolean;
} {
  if (!input.hasScheduledResume || !input.canUseUsageLimitResume) {
    return {
      errorBannerError: input.visibleThreadError,
      showStatusBanner: false,
    };
  }
  if (!input.threadErrorIsUsageLimit) {
    return {
      errorBannerError: input.visibleThreadError,
      showStatusBanner: true,
    };
  }
  return {
    errorBannerError: input.threadError,
    showStatusBanner: false,
  };
}
