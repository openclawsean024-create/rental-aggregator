/**
 * PRD §3.1 P0-1 + 設計準則「資訊密度：首屏就要看到熱門風險區 TOP 5 + 最近 7 天新增」
 * GET /api/blacklist/stats
 *
 * 模式切換跟 /api/blacklist 一致：static 模式走 in-memory JSON
 */
import { NextResponse } from "next/server";
import { getStats, isStaticMode } from "@/data/blacklist-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (isStaticMode()) {
      const stats = getStats();
      return NextResponse.json({ mode: "static", ...stats });
    }

    // Prisma 模式
    const { prisma } = await import("@/lib/db");
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [topDistricts, recentCount, totalApproved, pendingCount] = await Promise.all([
      prisma.blacklistEntry.groupBy({
        by: ["addressDistrict"],
        where: { status: "approved" },
        _count: { _all: true },
        orderBy: { _count: { landlordName: "desc" } },
        take: 5,
      }),
      prisma.blacklistEntry.count({
        where: { status: "approved", createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.blacklistEntry.count({ where: { status: "approved" } }),
      prisma.blacklistEntry.count({ where: { status: "pending" } }),
    ]);

    return NextResponse.json({
      mode: "db",
      topDistricts: topDistricts.map((d) => ({
        district: d.addressDistrict,
        count: d._count._all,
      })),
      recentCount,
      totalApproved,
      pendingCount,
    });
  } catch (err) {
    console.error("[GET /api/blacklist/stats] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
