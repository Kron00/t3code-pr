import { describe, expect, it } from "vite-plus/test";

import {
  nextUsageLimitRetryAt,
  providerUsageLimitFromError,
  retryAtFromEpochSeconds,
} from "./usageLimits.ts";

describe("provider usage limits", () => {
  it("classifies common subscription and API limit errors", () => {
    for (const message of [
      "Usage limit reached",
      "rate limit exceeded",
      "HTTP 429 Too Many Requests",
      "RESOURCE_EXHAUSTED",
      "insufficient_quota",
      "You've hit your Cursor usage limit.",
      "Grok usage limit reached. Try again later.",
      "OpenCode request failed with HTTP 429.",
    ]) {
      expect(providerUsageLimitFromError({ message })).not.toBeNull();
    }
    expect(providerUsageLimitFromError({ message: "Context window exceeded" })).toBeNull();
  });

  it("extracts nested absolute reset timestamps", () => {
    expect(
      providerUsageLimitFromError({
        message: "rate limit exceeded",
        detail: { error: { rate_limit: { resetsAt: 1_787_944_200 } } },
      }),
    ).toEqual({ retryAt: "2026-08-28T19:10:00.000Z" });
    expect(retryAtFromEpochSeconds(1_787_944_200)).toBe("2026-08-28T19:10:00.000Z");
  });

  it("classifies structured quota details when the outer message is generic", () => {
    expect(
      providerUsageLimitFromError({
        message: "Provider request failed.",
        detail: { error: { statusCode: 429 } },
      }),
    ).toEqual({});
    expect(
      providerUsageLimitFromError({
        message: "Provider request failed.",
        detail: { error: { code: "insufficient_quota" } },
      }),
    ).toEqual({});
  });

  it("uses the provider reset when available and paced fallback retries otherwise", () => {
    expect(
      nextUsageLimitRetryAt({
        now: "2026-08-28T18:00:00.000Z",
        attempt: 0,
        providerRetryAt: "2026-08-28T18:30:00.000Z",
      }),
    ).toBe("2026-08-28T18:30:02.000Z");
    expect(nextUsageLimitRetryAt({ now: "2026-08-28T18:00:00.000Z", attempt: 0 })).toBe(
      "2026-08-28T18:05:00.000Z",
    );
    expect(nextUsageLimitRetryAt({ now: "2026-08-28T18:00:00.000Z", attempt: 3 })).toBe(
      "2026-08-28T19:00:00.000Z",
    );
  });
});
