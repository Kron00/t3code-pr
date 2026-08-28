import { describe, expect, it } from "vite-plus/test";

import { resolveUsageLimitResumePresentation } from "./usageLimitResumePresentation";

describe("resolveUsageLimitResumePresentation", () => {
  it("keeps a real provider failure in the error banner", () => {
    expect(
      resolveUsageLimitResumePresentation({
        threadError: "Usage limit reached",
        visibleThreadError: "Usage limit reached",
        hasScheduledResume: true,
      }),
    ).toEqual({
      errorBannerError: "Usage limit reached",
      showStatusBanner: false,
    });
  });

  it("moves an error-free scheduled resume to the status banner", () => {
    expect(
      resolveUsageLimitResumePresentation({
        threadError: null,
        visibleThreadError: null,
        hasScheduledResume: true,
      }),
    ).toEqual({
      errorBannerError: null,
      showStatusBanner: true,
    });
  });

  it("preserves normal error dismissal when no resume is scheduled", () => {
    expect(
      resolveUsageLimitResumePresentation({
        threadError: "Provider failed",
        visibleThreadError: null,
        hasScheduledResume: false,
      }),
    ).toEqual({
      errorBannerError: null,
      showStatusBanner: false,
    });
  });
});
