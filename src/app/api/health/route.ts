/**
 * GET /api/health — 給部署 + 監控用
 *
 * 模式：
 * - static 模式：回 in-memory 資料 + 顯示 static 標記
 * - db 模式：回 Prisma count
 */
import { NextResponse } from "next/server";
import { isStaticMode, getAllApproved } from "@/data/blacklist-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isStaticMode()) {
    return NextResponse.json({
      ok: true,
      mode: "static",
      db: "up",
      totalEntries: getAllApproved().length,
      timestamp: new Date().toISOString(),
      note: "Static mode: 1,000 筆 in-memory JSON. 升級為 Postgres 後會自動切換.",
    });
  }

  try {
    const { prisma } = await import("@/lib/db");
    const count = await prisma.blacklistEntry.count();
    return NextResponse.json({
      ok: true,
      mode: "db",
      db: "up",
      totalEntries: count,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, mode: "db", db: "down", error: String(err) },
      { status: 503 },
    );
  }
}
