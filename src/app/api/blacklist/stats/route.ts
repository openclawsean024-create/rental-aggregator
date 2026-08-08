/**
 * PRD §3.1 P0-1 + 設計準則「資訊密度：首屏就要看到熱門風險區 TOP 5 + 最近 7 天新增」
 * GET /api/blacklist/stats
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [topDistricts, recentCount, totalApproved, pendingCount] = await Promise.all([
      // 熱門風險區 TOP 5（approved 狀態，按 district 聚合）
      prisma.blacklistEntry.groupBy({
        by: ["addressDistrict"],
        where: { status: "approved" },
        _count: { _all: true },
        orderBy: { _count: { landlordName: "desc" } },
        take: 5,
      }),
      // 最近 7 天新增
      prisma.blacklistEntry.count({
        where: {
          status: "approved",
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      // 全部已審核的黑名單數
      prisma.blacklistEntry.count({ where: { status: "approved" } }),
      // 待審核數
      prisma.blacklistEntry.count({ where: { status: "pending" } }),
    ]);

    return NextResponse.json({
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
