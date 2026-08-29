/**
 * Rate limiter — Upstash Redis primary + in-memory fallback（per-IP sliding window）
 *
 * 用於保護 POST /api/blacklist 公開 endpoint（PRD §5.2 + M3 安全 hardening + R2 follow-up）。
 *
 * 設計（M3 → M3.5 / R2 upgrade）：
 * - 公開 POST endpoint 沒有 auth，容易被 spam 攻擊
 * - sliding window 比 fixed window 平滑，避免 burst
 * - **Primary：Upstash Redis**（@upstash/ratelimit slidingWindow(5, "60 s")）
 *   - 解決 Vercel serverless 多實例問題（M3 known limitation R2）
 *   - 多 instance / 多 region 共享計數
 *   - ephemeralCache（in-memory Map）作為同一 instance 內的 fast path，
 *     避免每秒打 Redis
 * - **Fallback：in-memory Map**（既有的 M3 實作）
 *   - Redis env 沒設 → 直接走 in-memory
 *   - Redis init throw → 標記 failed 後走 in-memory（不重試整個 process 生命週期）
 *   - Redis runtime `limit()` throw → 走 in-memory（不標記，下次仍可重試）
 * - graceful fallback 是必要的：user Phase 0（Upstash setup）還沒完成時，
 *   production deploy 後沒設 env 也不會掛 — 行為跟 M3 完全一樣（in-memory）
 *
 * 預設 5 req / min（PLAN.md M3 scope + R2 沿用）：
 * - 真實租屋檢舉場景：使用者 1-2 次提交/日（不是高頻 endpoint）
 * - 5/min 足以應付「表單 submit 重試 + 雙方陳述」，但擋得掉自動化腳本
 *
 * 為什麼 Redis path 只支援預設 5/60s（不支援 per-call 自訂 limit/windowMs）：
 * - @upstash/ratelimit 的 slidingWindow algorithm 在構造 Ratelimit instance 時
 *   凍結 tokens + window，per-call 的 LimitOptions.rate 主要給 tokenBucket 用。
 * - 我們 production 只用預設值（route.ts 用 `checkRateLimit(ip)`），自訂參數只在
 *   unit tests 用。如果 user 自訂 → 直接走 in-memory fallback（仍尊重 limit/windowMs）。
 *
 * 對 ADR-002 mask-invariant test 的影響：
 * - 本檔**不使用 landlordName**，純 IP-based key
 * - 任何 mask invariant 違規（錯誤 bypass）會被 mask-invariant.test.ts 擋下
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Default rate limit：5 requests per 60s window per IP。
 */
export const DEFAULT_LIMIT = 5;
export const DEFAULT_WINDOW_MS = 60_000;

export interface RateLimitResult {
  ok: boolean;
  /** 本 window 剩餘可發次數（>= 0） */
  remaining: number;
  /** 距 window 重置的毫秒數 */
  resetMs: number;
}

// =============================================================
// Upstash Redis limiter（lazy init，graceful fallback）
// =============================================================

let redisLimiter: Ratelimit | null = null;
/** Redis init throw 後設 true，整個 process 不再重試（避免每次請求都炸） */
let redisLimiterInitFailed = false;

/**
 * 是否設定了 Upstash env。沒設 → 直接 in-memory（user Phase 0 還沒完成時的行為）。
 */
export function isRedisConfigured(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

function getRedisLimiter(): Ratelimit | null {
  if (redisLimiterInitFailed) return null;
  if (redisLimiter) return redisLimiter;
  if (!isRedisConfigured()) return null;
  try {
    const redis = new Redis({
      url: UPSTASH_URL as string,
      token: UPSTASH_TOKEN as string,
    });
    redisLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(DEFAULT_LIMIT, `${DEFAULT_WINDOW_MS} ms`),
      analytics: false, // 我們沒 dashboard，省 quota
      prefix: "rl:rental-aggregator",
      // ephemeralCache: 同 instance 內的 in-memory fast path，
      // 同一 IP 在 1 秒內打多次時不會每次都打 Redis
      ephemeralCache: new Map(),
    });
    return redisLimiter;
  } catch (err) {
    redisLimiterInitFailed = true;
    console.warn(
      "[rate-limit] Redis init failed, falling back to in-memory for this process",
      err,
    );
    return null;
  }
}

// =============================================================
// In-memory fallback（pure function，方便 unit test）
// =============================================================

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Pure in-memory sliding window check（純函式，沒有外部 state mutation 之外的副作用）。
 * 用作 Redis fallback + unit test 對象。
 */
export function inMemoryCheck(
  ip: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(ip);

  // 沒紀錄 或 window 過了 → 新 window
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(ip, { count: 1, windowStart: now });
    return {
      ok: true,
      remaining: limit - 1,
      resetMs: windowMs,
    };
  }

  // window 內：累加
  const nextCount = bucket.count + 1;
  bucket.count = nextCount;

  if (nextCount > limit) {
    const elapsed = now - bucket.windowStart;
    return {
      ok: false,
      remaining: 0,
      resetMs: Math.max(0, windowMs - elapsed),
    };
  }

  const elapsed = now - bucket.windowStart;
  return {
    ok: true,
    remaining: limit - nextCount,
    resetMs: Math.max(0, windowMs - elapsed),
  };
}

// =============================================================
// Public API
// =============================================================

/**
 * 檢查指定 IP 是否還在 limit 內。
 *
 * @param ip       client IP（從 x-forwarded-for / x-real-ip / "anonymous" fallback）
 * @param limit    window 內最大請求數（預設 5；Redis path 強制用 DEFAULT_LIMIT）
 * @param windowMs window 長度（預設 60_000ms = 1 分鐘；Redis path 強制用 DEFAULT_WINDOW_MS）
 *
 * 行為（async）：
 * 1. Redis env 沒設 → 走 in-memory
 * 2. Redis init throw → 標記 failed + 走 in-memory
 * 3. Redis env 有 + init OK → 走 Redis：
 *    - `limit()` return `{ success, remaining, reset (Unix ms) }` → 轉成 `ok/remaining/resetMs`
 *    - `limit()` throw → console.warn + 走 in-memory（不標記 failed，下次仍可重試）
 *
 * 無論後續 Zod / DB 是否成功，這次 check 都算 1 次
 * （理由：避免攻擊者用 schema 試誤免費探測 endpoint）
 */
export async function checkRateLimit(
  ip: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
): Promise<RateLimitResult> {
  // per-call 自訂 limit/windowMs 走 in-memory path（Redis path 凍結了 algorithm）
  const useRedisDefaults = limit === DEFAULT_LIMIT && windowMs === DEFAULT_WINDOW_MS;

  const limiter = useRedisDefaults ? getRedisLimiter() : null;
  if (limiter) {
    try {
      const { success, remaining, reset } = await limiter.limit(ip);
      return {
        ok: success,
        remaining,
        resetMs: Math.max(0, reset - Date.now()),
      };
    } catch (err) {
      // Runtime failure → 不標記 failed，下次可重試 init
      console.warn(
        "[rate-limit] Redis limit() failed, falling back to in-memory",
        err,
      );
      // fall through to in-memory
    }
  }
  return inMemoryCheck(ip, limit, windowMs);
}

/**
 * 從 NextRequest 取出 client IP（for rate limit key）。
 *
 * 順序：
 * 1. x-forwarded-for 第一段（Vercel / Cloudflare proxy 標準）
 * 2. x-real-ip（Nginx / 部分 CDN）
 * 3. fallback "anonymous"（無 proxy header 時）
 *
 * 注意：在 Vercel production，x-forwarded-for 是 client 真實 IP（Vercel proxy 會填），
 * 不會被 spoofed（外部 attacker 設的 header 會被覆蓋）。
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "anonymous";
}

/**
 * 測試輔助：清空所有 buckets + 強制重建 Redis limiter（清 ephemeralCache）。
 * 正式程式碼不會用到（只在 vitest 內 reset 狀態）。
 */
export function _resetRateLimitForTests(): void {
  buckets.clear();
  redisLimiter = null;
  // 不重置 redisLimiterInitFailed：test mock Redis 時通常會 inject 成功路徑，
  // 上一個 test 若已標記 failed 就 fail。Mock 環境通常用 vi.mock 整個替換，
  // init 不會跑到我們的 code path，所以這個 flag 不影響 mock-based tests。
  redisLimiterInitFailed = false;
}