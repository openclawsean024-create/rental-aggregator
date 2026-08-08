/**
 * 靜態黑名單資料 store
 *
 * 設計理由（2026-08-08）：
 * - Vercel serverless filesystem 是 read-only，SQLite file 沒法寫
 * - Vercel Postgres 需要 marketplace integration（Sean 未授權）
 * - Supabase/Neon 需要 Sean 提供 connection string（Sean 未提供）
 * - 1,000 筆只有 248 KB，直接 bundle 進 repository +
 *   build 時 import 進 serverless function 即可
 * - POST 提交：在 production 模式下暫不開放內容寫入（in-memory 寫入會在 cold start 丟失）
 *   改用「記錄到 console + 回 202 + 訊息告知管理員」做法
 *   本地 dev 模式仍走 Prisma（保持原本 DX）
 *
 * 切換邏輯（isStaticMode）：
 * 1. 環境變數 USE_BLACKLIST_STATIC=1（明示）
 * 2. VERCEL=1 + 沒有真的 postgresql URL（placeholder）
 * 3. DATABASE_URL=file:*（Vercel 環境）
 * 4. 預設：本地 dev（DATABASE_URL=file:./dev.db）走 Prisma
 */
import blacklistData from "./blacklist.json";

export type BlacklistItem = {
  id: string;
  landlordName: string;
  addressDistrict: string;
  addressDetail: string | null;
  category: string;
  description: string;
  reportCount: number;
  viewCount: number;
  severity: number;
  lastIncidentAt: string;
  createdAt: string;
};

const ALL: BlacklistItem[] = blacklistData as BlacklistItem[];

export function isStaticMode(): boolean {
  if (process.env.USE_BLACKLIST_STATIC === "1") return true;
  if (process.env.VERCEL === "1") {
    const url = process.env.DATABASE_URL ?? "";
    if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
      return true;
    }
    if (url.includes("placeholder") || url.includes("invalid")) return true;
  }
  return false;
}

export function getAllApproved(): BlacklistItem[] {
  return ALL;
}

export function searchApproved(opts: {
  q?: string;
  district?: string;
  category?: string;
  limit: number;
  offset: number;
}): { items: BlacklistItem[]; total: number; elapsedMs: number } {
  const start = Date.now();
  const q = opts.q?.trim() ?? "";
  const district = opts.district?.trim() ?? "";
  const category = opts.category?.trim() ?? "";

  const filtered = ALL.filter((e) => {
    if (q && !e.landlordName.includes(q)) return false;
    if (district && !e.addressDistrict.includes(district)) return false;
    if (category && e.category !== category) return false;
    return true;
  });

  const items = filtered.slice(opts.offset, opts.offset + opts.limit);

  return {
    items,
    total: filtered.length,
    elapsedMs: Date.now() - start,
  };
}

export function getStats(): {
  topDistricts: { district: string; count: number }[];
  recentCount: number;
  totalApproved: number;
  pendingCount: number;
} {
  const districtCount = new Map<string, number>();
  let recentCount = 0;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const e of ALL) {
    districtCount.set(e.addressDistrict, (districtCount.get(e.addressDistrict) ?? 0) + 1);
    if (new Date(e.createdAt).getTime() >= sevenDaysAgo) recentCount++;
  }

  const topDistricts = Array.from(districtCount.entries())
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    topDistricts,
    recentCount,
    totalApproved: ALL.length,
    pendingCount: 0,
  };
}

export function recordSubmission(payload: {
  landlordName: string;
  addressDistrict: string;
  addressDetail?: string;
  category: string;
  description: string;
  evidenceUrls?: string[];
}): { id: string; landlordName: string; addressDistrict: string; status: string; createdAt: string } {
  const id = `static-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  console.warn(
    "[blacklist-store] static mode: submission logged to console only",
    { id, payload },
  );
  return {
    id,
    landlordName: payload.landlordName,
    addressDistrict: payload.addressDistrict,
    status: "pending",
    createdAt,
  };
}
