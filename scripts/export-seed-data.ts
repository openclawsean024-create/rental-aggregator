/**
 * 從 dev.db 抽出已審核的 1,000 筆黑名單 → 寫成 JSON file
 * 用途：Vercel serverless filesystem read-only，
 *       改用 in-memory JSON import 替代 Prisma runtime
 *
 * 設計：
 * - 只輸出 approved 狀態（PRD §3.1：未審核不公開）
 * - 不輸出 landlordNameFull（保留個資，Pro 付費牆才回）
 * - 不輸出 submitterId / evidenceUrls（個資）
 * - 預先按 severity desc 排序，方便 serverless handler 直接 slice
 */
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.blacklistEntry.findMany({
    where: { status: "approved" },
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
    orderBy: [{ severity: "desc" }, { lastIncidentAt: "desc" }],
  });

  console.log(`Found ${entries.length} approved entries`);

  const out = entries.map((e) => ({
    id: e.id,
    landlordName: e.landlordName, // 已是去識別化
    addressDistrict: e.addressDistrict,
    addressDetail: e.addressDetail,
    category: e.category,
    description: e.description,
    reportCount: e.reportCount,
    viewCount: e.viewCount,
    severity: e.severity,
    lastIncidentAt: e.lastIncidentAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
  }));

  const outPath = path.resolve("src/data/blacklist.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(out, null, 2));

  const size = (JSON.stringify(out).length / 1024).toFixed(1);
  console.log(`Wrote ${outPath} (${size} KB)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
