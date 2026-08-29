/**
 * PRD §4.4 /api/blacklist
 * GET  /api/blacklist?q=&district=&limit=&offset=  — 查詢黑名單（去識別化）
 * POST /api/blacklist                              — 提交檢舉（status=pending）
 *
 * 存儲策略（2026-08-08）：
 * - 本地 dev (DATABASE_URL=file:...): 用 Prisma 寫入 SQLite
 * - Vercel prod (DATABASE_URL=postgresql://...): 預期用 Prisma + Postgres
 * - Vercel prod 預設 fallback (DATABASE_URL=file:./dev.db): 走 static 模式
 *   因為 Vercel serverless filesystem 是 read-only，SQLite 沒法寫
 *   static 模式 = 1,000 筆 in-memory JSON，POST 寫入 console + fake ID
 *
 * 個資保護（PRD §5.2 / ADR-002）：
 *   - 一般查詢只回 landlordName（去識別化），landlordNameFull 留 Prisma 層
 *   - 完整姓名僅 Pro 才回（M3 實作）
 *
 * 性能（PRD §5.1）：< 500ms
 *   - Static 模式：8 萬字節 JSON + 簡單 filter，應該 < 20ms
 *   - Prisma 模式：依賴 DB 索引 + 查詢計劃
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  searchApproved,
  getStats,
  recordSubmission,
  isStaticMode,
  type BlacklistItem,
} from "@/data/blacklist-store";
import { maskLandlordName } from "@/lib/mask";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// =============================================================
// GET 查詢
// =============================================================
const QuerySchema = z.object({
  q: z.string().trim().max(50).optional(),
  district: z.string().trim().max(50).optional(),
  category: z.string().trim().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});

export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      district: searchParams.get("district") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { q, district, category, limit, offset } = parsed.data;

    // Static 模式：直接 in-memory filter
    if (isStaticMode()) {
      const result = searchApproved({ q, district, category, limit, offset });
      return NextResponse.json(
        {
          mode: "static",
          items: result.items,
          total: result.total,
          limit,
          offset,
          query: { q, district, category },
          elapsedMs: result.elapsedMs,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // Prisma 模式（dev 或未來 prod with Postgres）
    const { prisma } = await import("@/lib/db");
    const where: Record<string, unknown> = { status: "approved" };
    if (q) where.landlordName = { contains: q };
    if (district) where.addressDistrict = { contains: district };
    if (category) where.category = category;

    const [items, total] = await Promise.all([
      prisma.blacklistEntry.findMany({
        where,
        orderBy: [{ severity: "desc" }, { lastIncidentAt: "desc" }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          landlordName: true,
          addressDistrict: true,
          addressDetail: true,
          category: true,
          description: true,
          reportCount: true,
          viewCount: true,
          severity: true,
          lastIncidentAt: true,
          createdAt: true,
        },
      }),
      prisma.blacklistEntry.count({ where }),
    ]);

    // async 熱門瀏覽數 increment（不阻塞 response）
    if (items.length > 0) {
      prisma.blacklistEntry
        .updateMany({
          where: { id: { in: items.map((i) => i.id) } },
          data: { viewCount: { increment: 1 } },
        })
        .catch(() => {});
    }

    return NextResponse.json(
      {
        mode: "db",
        items,
        total,
        limit,
        offset,
        query: { q, district, category },
        elapsedMs: Date.now() - start,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[GET /api/blacklist] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// =============================================================
// POST 提交檢舉
// =============================================================
// 證據 URL 限縮為 http(s)：拒絕 javascript: / file: / data: / ftp: 等
// （M3 hardening — Zod 內建 .url() 接受 javascript:alert(1) 為 valid URL，
// 這是 XSS 風險。改用 .refine 明確只接受 http(s) scheme）
const EvidenceUrlSchema = z
  .string()
  .url()
  .refine((s) => /^https?:\/\//i.test(s), {
    message: "evidenceUrls 必須是 http(s) URL",
  });

const PostSchema = z.object({
  landlordName: z.string().trim().min(2).max(20),
  addressDistrict: z.string().trim().min(3).max(50),
  addressDetail: z.string().trim().max(100).optional(),
  category: z.enum([
    "deposit_dispute",
    "early_termination",
    "fake_listing",
    "maintenance_ignored",
    "illegal_deduction",
  ]),
  description: z.string().trim().min(10).max(500),
  evidenceUrls: z.array(EvidenceUrlSchema).max(10).optional(),
  submitterId: z.string().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit（M3 hardening）：
    // - 在 Zod parse 之前先計數，無論 schema 是否通過都算 1 次
    // - 避免攻擊者用 schema 試誤免費探測 endpoint
    // - IP 從 proxy header 取（Vercel / Cloudflare），fallback 'anonymous'
    // - 5 req / min，超過 → 429 + Retry-After
    // - static mode 也要走（POST 是公開 endpoint）
    const ip = getClientIp(request.headers);
    const rl = checkRateLimit(ip);
    if (!rl.ok) {
      const retryAfterSec = Math.ceil(rl.resetMs / 1000);
      return NextResponse.json(
        {
          error: "Too many requests, please retry later.",
          retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    const body = await request.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const masked = maskLandlordName(data.landlordName);

    // Static 模式：console log + fake pending ID
    if (isStaticMode()) {
      const entry = recordSubmission({
        landlordName: masked,
        addressDistrict: data.addressDistrict,
        addressDetail: data.addressDetail,
        category: data.category,
        description: data.description,
        evidenceUrls: data.evidenceUrls,
      });
      return NextResponse.json(
        {
          ok: true,
          mode: "static",
          entry,
          message:
            "檢舉已收到（static 模式）。Production DB 接入後會進入審核佇列（3-7 個工作天）。" +
            "目前管理員會從 server log 看到您的提交，下週會批次匯入。",
        },
        { status: 202 },
      );
    }

    // Prisma 模式
    const { prisma } = await import("@/lib/db");
    // 重用上方 rate limit 抓的 client IP（避免重複 parse header）
    const submitterId = data.submitterId ?? `anon-${ip}`;

    await prisma.user.upsert({
      where: { id: submitterId },
      update: {},
      create: {
        id: submitterId,
        email: `${submitterId}@rental-aggregator.local`,
        role: "TENANT",
        plan: "FREE",
      },
    });

    const entry = await prisma.blacklistEntry.create({
      data: {
        landlordName: masked,
        landlordNameFull: data.landlordName,
        addressDistrict: data.addressDistrict,
        addressDetail: data.addressDetail,
        category: data.category,
        description: data.description,
        evidenceUrls: JSON.stringify(data.evidenceUrls ?? []),
        submitterId,
        status: "pending",
        severity: 3,
      },
      select: {
        id: true,
        landlordName: true,
        addressDistrict: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, mode: "db", entry }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/blacklist] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
