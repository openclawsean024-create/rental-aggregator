/**
 * 靜態黑名單資料 store
 *
 * 設計理由（2026-08-08）：
 * - Vercel serverless filesystem 是 read-only，SQLite file 沒法寫
 * - Vercel Postgres 需要 marketplace integration（Sean 未授權）
 * - Supabase/Neon 需要 Sean 提供 connection string（Sean 未提供）
 * - 1,000 筆只有 248 KB，直接 bundle 進 repository +
 *   build 時 import 進 serverless function 即可
 * - POST 提交：在 production 模式下暫不開放（in-memory 寫入會在 cold start 丟失）
 *   改用「記錄到 console + 回 202 + 訊息告知管理員」做法
 *   本地 dev 模式仍走 Prisma（保持原本 DX）
 *
 * 切換邏輯：DATABASE_URL 開頭是 "file:" 走 Prisma，否則走 static JSON
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

// 已預先排序 (severity desc, lastIncidentAt desc) by export-seed-data.ts
const ALL: BlacklistItem[] = blacklistData as BlacklistItem[];

export function isStaticMode(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return !url.startsWith("file:") && !url.startsWith("postgres");
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

  // 過濾（startsWith 對中文模糊搜尋 OK，因為 DB 存的是已經去識別化字串）
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
  // 區域聚合
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
    pendingCount: 0, // static 模式沒審核佇列
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
  // Static 模式：console log + 給假的 pending ID
  // 將來 Sean 給 DB 後可以升級到真的寫入
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
