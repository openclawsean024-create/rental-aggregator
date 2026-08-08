/**
 * GET /api/health — 給部署 + 監控用
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await prisma.blacklistEntry.count();
    return NextResponse.json({
      ok: true,
      db: "up",
      totalEntries: count,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: "down", error: String(err) },
      { status: 503 },
    );
  }
}
