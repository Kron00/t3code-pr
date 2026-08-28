import { describe, expect, it } from "vite-plus/test";

import { initialUsageLimitResumeAt } from "./usageLimitResume.ts";

describe("initialUsageLimitResumeAt", () => {
  it("uses a future provider reset timestamp", () => {
    expect(
      initialUsageLimitResumeAt("2026-08-28T19:10:00.000Z", Date.parse("2026-08-28T18:00:00Z")),
    ).toBe("2026-08-28T19:10:00.000Z");
  });

  it("falls back to five minutes when the provider has no future reset", () => {
    expect(initialUsageLimitResumeAt(undefined, Date.parse("2026-08-28T18:00:00Z"))).toBe(
      "2026-08-28T18:05:00.000Z",
    );
    expect(
      initialUsageLimitResumeAt("2026-08-28T17:00:00.000Z", Date.parse("2026-08-28T18:00:00Z")),
    ).toBe("2026-08-28T18:05:00.000Z");
  });
});
