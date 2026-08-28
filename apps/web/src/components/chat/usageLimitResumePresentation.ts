export function resolveUsageLimitResumePresentation(input: {
  readonly threadError: string | null;
  readonly visibleThreadError: string | null;
  readonly hasScheduledResume: boolean;
}): {
  readonly errorBannerError: string | null;
  readonly showStatusBanner: boolean;
} {
  if (!input.hasScheduledResume) {
    return {
      errorBannerError: input.visibleThreadError,
      showStatusBanner: false,
    };
  }
  return {
    errorBannerError: input.threadError,
    showStatusBanner: input.threadError === null,
  };
}
