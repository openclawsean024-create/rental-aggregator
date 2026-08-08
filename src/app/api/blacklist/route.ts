/**
 * PRD §4.4 /api/blacklist
 * GET  /api/blacklist?q=&district=&limit=&offset=  — 查詢黑名單（去識別化）
 * POST /api/blacklist                              — 提交檢舉（status=pending）
 *
 * 個資保護（PRD §5.2 / ADR-002）：
 *   - 一般查詢只回 landlordName（去識別化）
 *   - landlordNameFull 僅 Pro 才回（M3 實作）
 *   - 設計：把 mask 邏輯在 SQL 端用 landlordName 已存好的遮罩欄位做，
 *     因此一般查詢不需要再處理遮罩
 *
 * 性能（PRD §5.1）：< 500ms
 *   - schema 已有 @@index([landlordName, addressDistrict])
 *   - 加 viewCount increment（熱門排序）
 *   - Prisma findMany 不用 include 全部欄位
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// 強制 dynamic，否則 build 會 fail（用到 DB）
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

    // 構建 WHERE（姓名只查詢已去識別化欄位）
    const where: Record<string, unknown> = {
      status: "approved", // 只回已審核的
    };

    if (q) {
      where.landlordName = { contains: q };
    }
    if (district) {
      where.addressDistrict = { contains: district };
    }
    if (category) {
      where.category = category;
    }

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
        .catch(() => {
          // 忽略 increment 失敗，不影響主查詢
        });
    }

    return NextResponse.json(
      {
        items,
        total,
        limit,
        offset,
        query: { q, district, category },
        elapsedMs: Date.now() - start,
      },
      {
        headers: {
          // 避免 CDN 快取去識別化結果
          "Cache-Control": "no-store",
        },
      },
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
  evidenceUrls: z.array(z.string().url()).max(10).optional(),
  // 提交者：M1 階段先允許匿名（用 IP 當 submitterId）；M2 串 Clerk
  submitterId: z.string().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // 個資保護：直接 mask 後存 DB
    const { maskLandlordName } = await import("@/lib/mask");
    const masked = maskLandlordName(data.landlordName);

    // 提交者 ID：M1 階段用 IP + timestamp hash 作為匿名 ID
    // 將來 Clerk 接管後直接用 user.id
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "anonymous";
    const submitterId = data.submitterId ?? `anon-${ip}`;

    // 匿名提交者 upsert 一個 User（FK 必須有對應 record）
    // 這個 user.email 是個合成 id，實際上無法登入
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
        landlordNameFull: data.landlordName, // 完整姓名暫存，待審核通過後 Pro 才能看
        addressDistrict: data.addressDistrict,
        addressDetail: data.addressDetail,
        category: data.category,
        description: data.description,
        evidenceUrls: JSON.stringify(data.evidenceUrls ?? []),
        submitterId,
        status: "pending", // PRD §3.4 AC-03：進審核佇列
        severity: 3, // 預設中度，由管理員調整
      },
      select: {
        id: true,
        landlordName: true,
        addressDistrict: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        entry,
        message: "檢舉已提交，進入管理員審核佇列（3-7 個工作天）",
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/blacklist] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
