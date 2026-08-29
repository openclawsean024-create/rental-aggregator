/**
 * src/lib/rate-limit.ts unit tests（M3 backend hardening）
 *
 * 範圍：
 * - 預設參數：連發 5 → ok；第 6 → ok=false
 * - 自訂 limit / windowMs
 * - 不同 IP 互不干擾
 * - window 過了 → 自動 reset
 * - remaining / resetMs 正確
 * - getClientIp 從 header 抽出 IP（fallback order）
 * - _resetRateLimitForTests 真的清空
 *
 * 不打時鐘 → 用 vi.useFakeTimers + vi.advanceTimersByTime 控制時間。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkRateLimit,
  getClientIp,
  _resetRateLimitForTests,
  DEFAULT_LIMIT,
  DEFAULT_WINDOW_MS,
} from "./rate-limit";

describe("checkRateLimit — 預設參數（5 / 60s）", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it("同一 IP 連發 5 次都 ok，第 6 次 ok=false", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(ip);
      expect(r.ok).toBe(true);
    }
    const sixth = checkRateLimit(ip);
    expect(sixth.ok).toBe(false);
    expect(sixth.remaining).toBe(0);
  });

  it("remaining 隨請求遞減", () => {
    const ip = "1.2.3.4";
    expect(checkRateLimit(ip).remaining).toBe(4);
    expect(checkRateLimit(ip).remaining).toBe(3);
    expect(checkRateLimit(ip).remaining).toBe(2);
    expect(checkRateLimit(ip).remaining).toBe(1);
    expect(checkRateLimit(ip).remaining).toBe(0);
    // 第 6 次：超限，remaining 仍為 0
    expect(checkRateLimit(ip).remaining).toBe(0);
  });
});

describe("checkRateLimit — per-IP 隔離", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it("不同 IP 互不干擾", () => {
    const a = "10.0.0.1";
    const b = "10.0.0.2";
    // A 打滿
    for (let i = 0; i < 5; i++) checkRateLimit(a);
    expect(checkRateLimit(a).ok).toBe(false);
    // B 仍可打
    const bRes = checkRateLimit(b);
    expect(bRes.ok).toBe(true);
    expect(bRes.remaining).toBe(4);
  });

  it("'anonymous' fallback bucket 獨立於真實 IP", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("anonymous");
    expect(checkRateLimit("anonymous").ok).toBe(false);
    expect(checkRateLimit("1.1.1.1").ok).toBe(true);
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

  it("window 過了 → 自動 reset", () => {
    const ip = "5.5.5.5";
    for (let i = 0; i < 5; i++) checkRateLimit(ip);
    expect(checkRateLimit(ip).ok).toBe(false);
    // 推到 window 之後
    vi.advanceTimersByTime(DEFAULT_WINDOW_MS + 1);
    const res = checkRateLimit(ip);
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(DEFAULT_LIMIT - 1);
    expect(res.resetMs).toBe(DEFAULT_WINDOW_MS);
  });

  it("resetMs 在 window 內遞減", () => {
    const ip = "6.6.6.6";
    const r1 = checkRateLimit(ip);
    expect(r1.resetMs).toBe(DEFAULT_WINDOW_MS);
    vi.advanceTimersByTime(30_000);
    const r2 = checkRateLimit(ip);
    // 還在 window 內 → resetMs 反映剩餘時間
    expect(r2.resetMs).toBeLessThanOrEqual(30_000);
    expect(r2.resetMs).toBeGreaterThan(0);
  });
});

describe("checkRateLimit — 自訂參數", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it("limit=2 / windowMs=1000 → 第 3 次擋", () => {
    const ip = "7.7.7.7";
    expect(checkRateLimit(ip, 2, 1000).ok).toBe(true);
    expect(checkRateLimit(ip, 2, 1000).ok).toBe(true);
    expect(checkRateLimit(ip, 2, 1000).ok).toBe(false);
  });

  it("limit=1 → 第一次 ok，第二次擋", () => {
    const ip = "8.8.8.8";
    expect(checkRateLimit(ip, 1, 60_000).ok).toBe(true);
    expect(checkRateLimit(ip, 1, 60_000).ok).toBe(false);
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
  it("清空後 IP 重新計算", () => {
    const ip = "9.9.9.9";
    for (let i = 0; i < 5; i++) checkRateLimit(ip);
    expect(checkRateLimit(ip).ok).toBe(false);
    _resetRateLimitForTests();
    expect(checkRateLimit(ip).ok).toBe(true);
  });
});
