import type { IsoDateTime } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";

const USAGE_LIMIT_MESSAGE =
  /(?:usage|rate) limit|quota (?:has been )?(?:exceeded|reached|exhausted)|too many requests|\b429\b|resource[_ ]exhausted|insufficient[_ ]quota/i;
const ABSOLUTE_RETRY_KEYS = new Set([
  "resetat",
  "resetsat",
  "reset_at",
  "resets_at",
  "retryat",
  "retry_at",
]);
const HTTP_STATUS_KEYS = new Set(["code", "status", "statuscode", "status_code"]);

export interface ProviderUsageLimit {
  readonly retryAt?: IsoDateTime;
}

function isoFromAbsoluteTime(value: unknown): IsoDateTime | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const epochMillis = value < 10_000_000_000 ? value * 1_000 : value;
    return DateTime.formatIso(DateTime.makeUnsafe(epochMillis)) as IsoDateTime;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  return Option.match(DateTime.make(value), {
    onNone: () => undefined,
    onSome: (dateTime) => DateTime.formatIso(dateTime) as IsoDateTime,
  });
}

function retryAtFromDetail(value: unknown, depth = 0): IsoDateTime | undefined {
  if (depth > 6 || !Predicate.isObject(value)) {
    return undefined;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (ABSOLUTE_RETRY_KEYS.has(key.toLowerCase())) {
      const retryAt = isoFromAbsoluteTime(entry);
      if (retryAt !== undefined) {
        return retryAt;
      }
    }
  }
  for (const entry of Object.values(value)) {
    const retryAt = retryAtFromDetail(entry, depth + 1);
    if (retryAt !== undefined) {
      return retryAt;
    }
  }
  return undefined;
}

function detailContainsUsageLimit(value: unknown, depth = 0): boolean {
  if (depth > 6) {
    return false;
  }
  if (typeof value === "string") {
    return USAGE_LIMIT_MESSAGE.test(value);
  }
  if (!Predicate.isObject(value)) {
    return false;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (
      HTTP_STATUS_KEYS.has(key.toLowerCase()) &&
      (entry === 429 || (typeof entry === "string" && entry.trim() === "429"))
    ) {
      return true;
    }
    if (detailContainsUsageLimit(entry, depth + 1)) {
      return true;
    }
  }
  return false;
}

export function providerUsageLimitFromError(input: {
  readonly message: string;
  readonly detail?: unknown;
  readonly retryAt?: IsoDateTime;
}): ProviderUsageLimit | null {
  if (!USAGE_LIMIT_MESSAGE.test(input.message) && !detailContainsUsageLimit(input.detail)) {
    return null;
  }
  const retryAt = input.retryAt ?? retryAtFromDetail(input.detail);
  return retryAt === undefined ? {} : { retryAt };
}

export function retryAtFromEpochSeconds(value: number | undefined): IsoDateTime | undefined {
  return value === undefined ? undefined : isoFromAbsoluteTime(value);
}

export function nextUsageLimitRetryAt(input: {
  readonly now: IsoDateTime;
  readonly attempt: number;
  readonly providerRetryAt?: IsoDateTime;
}): IsoDateTime {
  const now = DateTime.makeUnsafe(input.now);
  const providerRetryAt =
    input.providerRetryAt === undefined
      ? undefined
      : Option.getOrUndefined(DateTime.make(input.providerRetryAt));
  if (
    providerRetryAt !== undefined &&
    DateTime.toEpochMillis(providerRetryAt) > DateTime.toEpochMillis(now)
  ) {
    return DateTime.formatIso(DateTime.add(providerRetryAt, { seconds: 2 })) as IsoDateTime;
  }
  const retryMinutes = [5, 15, 30, 60][Math.min(Math.max(input.attempt, 0), 3)] ?? 60;
  return DateTime.formatIso(DateTime.add(now, { minutes: retryMinutes })) as IsoDateTime;
}
