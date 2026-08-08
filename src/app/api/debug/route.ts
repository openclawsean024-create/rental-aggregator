/**
 * GET /api/debug — 取得 runtime 環境狀態
 * 用途：trace Vercel serverless runtime 行為
 */
import { NextResponse } from "next/server";
import { isStaticMode } from "@/data/blacklist-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
    useStatic: process.env.USE_BLACKLIST_STATIC,
    databaseUrl: process.env.DATABASE_URL?.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1***$2"),
    hasListener: typeof process.listenerCount === "function",
    isStaticMode: isStaticMode(),
  });
}
