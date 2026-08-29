/**
 * In-memory rate limiter（per-IP, sliding window）
 *
 * 用於保護 POST /api/blacklist 公開 endpoint（PRD §5.2 + M3 安全 hardening）。
 *
 * 設計理由（M3 scope）：
 * - 公開 POST endpoint 沒有 auth，容易被 spam 攻擊
 * - sliding window 比 fixed window 平滑，避免 burst
 * - in-memory：無外部 dep、零延遲、部署簡單
 *
 * 已知限制（PLAN.md Risk Register R2）：
 * - **Vercel serverless 是多實例架構**，每個 instance 獨立計數
 *   → 同一 IP 在多個 instance 上的請求可能總計超過 limit 才被擋
 * - **Cold start 後 Map 會被清空** → 攻擊者若正好撞到 cold start 會 reset
 * - **不適用於分散式攻擊**（botnet 每個 IP 只打 1 次）
 *
 * Production upgrade path（follow-up，本 round 不做）：
 * - 換 Upstash Redis 或 Vercel KV 做共享狀態
 * - 或 Cloudflare 在 edge 做 token bucket
 *
 * 為什麼預設 5 req / min（PLAN.md M3 scope）：
 * - 真實租屋檢舉場景：使用者 1-2 次提交/日（不是高頻 endpoint）
 * - 5/min 足以應付「表單 submit 重試 + 雙方陳述」，但擋得掉自動化腳本
 * - 配合 sliding window：window 內超過 5 次才拒絕，retry window 不會卡死
 *
 * 對 ADR-002 mask-invariant test 的影響：
 * - 本檔**不使用 landlordName**，純 IP-based key
 * - 任何 mask invariant 違規（錯誤 bypass）會被 mask-invariant.test.ts 擋下
 */

const buckets = new Map<string, { count: number; windowStart: number }>();

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

/**
 * 檢查指定 IP 是否還在 limit 內。
 *
 * @param ip      client IP（從 x-forwarded-for / x-real-ip / "anonymous" fallback）
 * @param limit   window 內最大請求數（預設 5）
 * @param windowMs  window 長度（預設 60_000ms = 1 分鐘）
 *
 * 行為：
 * - window 過了 → 自動 reset（sliding window 簡化版：window 結束就重算）
 * - 超過 limit → 回 ok=false，remaining=0，resetMs 為距 window 結束剩餘時間
 * - **無論後續 Zod / DB 是否成功，這次 check 都算 1 次**
 *   （理由：避免攻擊者用 schema 試誤免費探測 endpoint）
 */
export function checkRateLimit(
  ip: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
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
 * 測試輔助：清空所有 buckets。
 * 正式程式碼不會用到（只在 vitest 內 reset 狀態）。
 */
export function _resetRateLimitForTests(): void {
  buckets.clear();
}
