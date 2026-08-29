/**
 * src/lib/rate-limit.ts unit tests
 *
 * R2 follow-up round — Milestone 2 (QA)
 *
 * 範圍：
 * - 既有 14 個 in-memory path 行為測試（已加 await 因為 checkRateLimit 改 async）
 * - 新增 4 個 Redis path mock-based 測試：
 *   1. Redis happy path：mock limit() 回 success → ok=true
 *   2. Redis over limit：mock 回 success=false → ok=false
 *   3. Redis down fallback：mock limit() throw → console.warn + 走 in-memory + 不 throw
 *   4. Redis init failure：mock new Ratelimit() throw → 標記 failed + 永久走 in-memory
 *
 * Mock pattern：
 * - vi.mock("@upstash/redis") + vi.mock("@upstash/ratelimit") 在 module 層級
 * - In-memory path 測試：env 不設 → 走 in-memory fallback（mock 不觸發）
 * - Redis path 測試：用 vi.resetModules() + 動態 import 讓 module-level 常數
 *   (UPSTASH_URL/UPSTASH_TOKEN) 重新讀取 stubEnv 後的值
 *
 * 不打時鐘 → 用 vi.useFakeTimers + vi.advanceTimersByTime 控制時間。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ============================================================
// Module-level mocks — MUST be before rate-limit import
// ============================================================
// 這些 mock 會被 vitest hoisted 到檔案頂端，確保在 rate-limit import 之前生效。
// 即使 production code 沒走 Redis path（如果 env 沒設），mock 仍然無害。

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    // 預設 stub：@upstash/ratelimit 只把 instance 存起來不呼叫方法
  })),
}));

vi.mock("@upstash/ratelimit", () => {
  const Ratelimit = vi.fn();
  // 預設 slidingWindow 回傳 algorithm descriptor（給 Ratelimit constructor 用）
  // cast to any 因為 vi.fn() 預設 type 沒有 slidingWindow 屬性
  (Ratelimit as any).slidingWindow = vi.fn(
    (limit: number, window: string) => ({
      limit,
      window,
    }),
  );
  return { Ratelimit };
});

// ============================================================
// Import under test — 在 mock declarations 之後
// ============================================================
import {
  checkRateLimit,
  getClientIp,
  _resetRateLimitForTests,
  DEFAULT_LIMIT,
  DEFAULT_WINDOW_MS,
  isRedisConfigured,
} from "./rate-limit";
import { Ratelimit } from "@upstash/ratelimit";

// ============================================================
// 共用 helper：setup mock Redis limit() 回傳值
// ============================================================
function mockRedisLimitResult(
  result: { success: boolean; remaining: number; reset: number },
) {
  vi.mocked(Ratelimit).mockImplementation(
    () =>
      ({
        limit: vi.fn().mockResolvedValue(result),
      }) as any,
  );
}

// ============================================================
// 既有 14 個 in-memory path 測試（加 await）
// ============================================================

describe("checkRateLimit — 預設參數（5 / 60s）", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
    // 不設 UPSTASH env → 走 in-memory path（mock 不會被觸發）
  });

  it("同一 IP 連發 5 次都 ok，第 6 次 ok=false", async () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit(ip);
      expect(r.ok).toBe(true);
    }
    const sixth = await checkRateLimit(ip);
    expect(sixth.ok).toBe(false);
    expect(sixth.remaining).toBe(0);
  });

  it("remaining 隨請求遞減", async () => {
    const ip = "1.2.3.4";
    expect((await checkRateLimit(ip)).remaining).toBe(4);
    expect((await checkRateLimit(ip)).remaining).toBe(3);
    expect((await checkRateLimit(ip)).remaining).toBe(2);
    expect((await checkRateLimit(ip)).remaining).toBe(1);
    expect((await checkRateLimit(ip)).remaining).toBe(0);
    // 第 6 次：超限，remaining 仍為 0
    expect((await checkRateLimit(ip)).remaining).toBe(0);
  });
});

describe("checkRateLimit — per-IP 隔離", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it("不同 IP 互不干擾", async () => {
    const a = "10.0.0.1";
    const b = "10.0.0.2";
    // A 打滿
    for (let i = 0; i < 5; i++) await checkRateLimit(a);
    expect((await checkRateLimit(a)).ok).toBe(false);
    // B 仍可打
    const bRes = await checkRateLimit(b);
    expect(bRes.ok).toBe(true);
    expect(bRes.remaining).toBe(4);
  });

  it("'anonymous' fallback bucket 獨立於真實 IP", async () => {
    for (let i = 0; i < 5; i++) await checkRateLimit("anonymous");
    expect((await checkRateLimit("anonymous")).ok).toBe(false);
    expect((await checkRateLimit("1.1.1.1")).ok).toBe(true);
  });
});

describe("checkRateLimit — window reset", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("window 過了 → 自動 reset", async () => {
    const ip = "5.5.5.5";
    for (let i = 0; i < 5; i++) await checkRateLimit(ip);
    expect((await checkRateLimit(ip)).ok).toBe(false);
    // 推到 window 之後
    vi.advanceTimersByTime(DEFAULT_WINDOW_MS + 1);
    const res = await checkRateLimit(ip);
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(DEFAULT_LIMIT - 1);
    expect(res.resetMs).toBe(DEFAULT_WINDOW_MS);
  });

  it("resetMs 在 window 內遞減", async () => {
    const ip = "6.6.6.6";
    const r1 = await checkRateLimit(ip);
    expect(r1.resetMs).toBe(DEFAULT_WINDOW_MS);
    vi.advanceTimersByTime(30_000);
    const r2 = await checkRateLimit(ip);
    // 還在 window 內 → resetMs 反映剩餘時間
    expect(r2.resetMs).toBeLessThanOrEqual(30_000);
    expect(r2.resetMs).toBeGreaterThan(0);
  });
});

describe("checkRateLimit — 自訂參數", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it("limit=2 / windowMs=1000 → 第 3 次擋", async () => {
    const ip = "7.7.7.7";
    expect((await checkRateLimit(ip, 2, 1000)).ok).toBe(true);
    expect((await checkRateLimit(ip, 2, 1000)).ok).toBe(true);
    expect((await checkRateLimit(ip, 2, 1000)).ok).toBe(false);
  });

  it("limit=1 → 第一次 ok，第二次擋", async () => {
    const ip = "8.8.8.8";
    expect((await checkRateLimit(ip, 1, 60_000)).ok).toBe(true);
    expect((await checkRateLimit(ip, 1, 60_000)).ok).toBe(false);
  });
});

describe("getClientIp", () => {
  it("從 x-forwarded-for 取第一段", () => {
    const h = new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.1, 10.0.0.2" });
    expect(getClientIp(h)).toBe("1.1.1.1");
  });

  it("x-forwarded-for 單段也支援", () => {
    const h = new Headers({ "x-forwarded-for": "1.1.1.1" });
    expect(getClientIp(h)).toBe("1.1.1.1");
  });

  it("無 x-forwarded-for → fallback x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "2.2.2.2" });
    expect(getClientIp(h)).toBe("2.2.2.2");
  });

  it("兩個都沒有 → 'anonymous'", () => {
    const h = new Headers({});
    expect(getClientIp(h)).toBe("anonymous");
  });

  it("x-forwarded-for 是空字串 → fallback x-real-ip", () => {
    const h = new Headers({
      "x-forwarded-for": "",
      "x-real-ip": "3.3.3.3",
    });
    expect(getClientIp(h)).toBe("3.3.3.3");
  });
});

describe("_resetRateLimitForTests", () => {
  it("清空後 IP 重新計算", async () => {
    const ip = "9.9.9.9";
    for (let i = 0; i < 5; i++) await checkRateLimit(ip);
    expect((await checkRateLimit(ip)).ok).toBe(false);
    _resetRateLimitForTests();
    expect((await checkRateLimit(ip)).ok).toBe(true);
  });
});

// ============================================================
// R2 新增：Upstash Redis path mock-based 測試
//
// 注意：rate-limit.ts 的 UPSTASH_URL/UPSTASH_TOKEN 是 module-level 常數
// （在 import 時讀 env），vi.stubEnv 在 import 後改 env 不會影響已經載入的常數。
// 解法：每個 Redis test 用 vi.resetModules() 清 module cache，
// stubEnv 後動態 import，rate-limit.ts 重新載入時讀到 stubbed env。
// ============================================================

describe("R2 — Upstash Redis path (mock-based)", () => {
  beforeEach(() => {
    // 清 module cache + 設 env + 動態 import 讓 module-level 常數重新讀 env
    vi.resetModules();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("Redis happy path：mock limit() 回 success → checkRateLimit 回 ok=true, remaining 正確", async () => {
    // Arrange: 動態 import 在 stubEnv 之後，rate-limit.ts 重新載入時讀到 env
    const rl = await import("./rate-limit");
    const now = Date.now();
    mockRedisLimitResult({
      success: true,
      remaining: 4,
      reset: now + 60_000,
    });
    expect(rl.isRedisConfigured()).toBe(true);

    // Act
    const result = await rl.checkRateLimit("1.2.3.4");

    // Assert
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetMs).toBeGreaterThan(0);
    expect(result.resetMs).toBeLessThanOrEqual(60_000);
    // 確認 Ratelimit constructor 被呼叫（mock 被觸發）
    expect(vi.mocked(Ratelimit)).toHaveBeenCalled();
  });

  it("Redis over limit：mock 回 success=false → ok=false, remaining=0", async () => {
    // Arrange
    const rl = await import("./rate-limit");
    const now = Date.now();
    mockRedisLimitResult({
      success: false,
      remaining: 0,
      reset: now + 30_000,
    });
    expect(rl.isRedisConfigured()).toBe(true);

    // Act
    const result = await rl.checkRateLimit("1.2.3.4");

    // Assert
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetMs).toBeGreaterThan(0);
    expect(result.resetMs).toBeLessThanOrEqual(30_000);
  });

  it("Redis down fallback：mock limit() throw → console.warn + 走 in-memory + 不 throw", async () => {
    // Arrange: 動態 import + mock limit() reject
    const rl = await import("./rate-limit");
    vi.mocked(Ratelimit).mockImplementation(
      () =>
        ({
          limit: vi.fn().mockRejectedValue(new Error("Redis connection refused")),
        }) as any,
    );
    expect(rl.isRedisConfigured()).toBe(true);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Act
    const result = await rl.checkRateLimit("1.2.3.4");

    // Assert
    // 1. 不 throw（即使 Redis 失敗）
    expect(result).toBeDefined();
    // 2. fallback 到 in-memory，第一個 request 應該 ok
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
    // 3. console.warn 有被呼叫（log Redis 失敗）
    expect(warnSpy).toHaveBeenCalled();
    // 4. warn message 含 "Redis" 或 "fallback"（讓 debug log 可讀）
    const warnMessages = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(
      warnMessages.some((m) => /Redis|fallback/i.test(m)),
    ).toBe(true);

    warnSpy.mockRestore();
  });

  it("Redis init failure：mock new Ratelimit() throw → 標記 failed + 永久走 in-memory", async () => {
    // Arrange: mock Ratelimit constructor throw
    // 第一次 throw → 標記 redisLimiterInitFailed = true
    // 後續 call 也 throw 也不會重試（避免每次請求都炸）
    const rl = await import("./rate-limit");
    vi.mocked(Ratelimit).mockImplementation(() => {
      throw new Error("Redis init failed");
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Act
    const r1 = await rl.checkRateLimit("1.2.3.4");
    const r2 = await rl.checkRateLimit("1.2.3.4");

    // Assert
    // 1. 不 throw
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    // 2. 都走 in-memory，第一個 ok，第二個 ok（不同 bucket 計算）
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(4);
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(3);
    // 3. console.warn 有記錄 init failure
    expect(warnSpy).toHaveBeenCalled();
    const warnMessages = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(
      warnMessages.some((m) => /init|fallback/i.test(m)),
    ).toBe(true);

    warnSpy.mockRestore();
  });
});