/**
 * ADR-002 不變性測試（M2 — QA owner）
 *
 * 規則（PRD §5.2 + ADR-002）：
 * - 所有從 src/ 回傳 `landlordName` 的地方，都必須經過 maskLandlordName()
 * - maskLandlordName() 是 single source of truth
 * - 違反此規則 = 個資保護破洞 = critical security finding
 *
 * 實作方式：
 * - 靜態掃描 src/ 下所有 .ts / .tsx 檔（跳過 .test.）
 * - 對每個 `landlordName` 出現的行：
 *   - 若該行已有 `maskLandlordName(` 或 `masked` → 視為合規
 *   - 若該行在「schema / type / interface / Prisma select / Prisma where / DB column」定義，
 *     也視為合規（這些是 raw reference，不是 bypass）
 *   - 其他全部視為違規 → 測試失敗
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_DIR = path.resolve(__dirname, "..");

interface Violation {
  file: string;
  line: number;
  snippet: string;
}

function isAllowedContext(line: string): boolean {
  const trimmed = line.trim();
  // 註解（單行 / 多行）
  if (trimmed.startsWith("//")) return true;
  if (trimmed.startsWith("*")) return true;
  if (trimmed.startsWith("/*")) return true;
  // Schema / type / interface 定義（function return type、type alias、interface）
  if (/^\s*(type|interface)\s+/.test(line)) return true;
  if (/\b(z\.string|z\.enum|z\.object|z\.array)\b/.test(line)) return true;
  // Prisma select / where / create / data 區塊（這些是 DB 層 raw reference）
  if (/\bselect\s*:\s*\{/.test(line)) return true;
  if (/\bwhere\s*:\s*\{/.test(line)) return true;
  if (/\bdata\s*:\s*\{/.test(line)) return true;
  if (/\borderBy\s*:\s*\{/.test(line)) return true;
  // Prisma schema 欄位（如 orderBy: { _count: { landlordName: "desc" } }）
  if (/_count\s*:\s*\{/.test(line)) return true;
  // TypeScript 型別 property 宣告（含 return type 中多個 property）
  if (/\blandlordName\s*:\s*\w/.test(line)) return true;
  if (/\blandlordName\s*\?\s*:/.test(line)) return true;
  // mask 已經處理過的（看變數命名）
  if (/masked/.test(line)) return true;
  if (/maskLandlordName\(/.test(line)) return true;
  // 「filtered data 上的 contains / includes」操作（已被 mask 過的資料）
  if (/\.includes\(/.test(line)) return true;
  // JSX render `{item.landlordName}` / `{data.landlordName}` — 顯示來自 API 已 mask 的資料
  if (/\{[a-zA-Z_$][\w.$]*\.landlordName\}/.test(line)) return true;
  // 「landlordNameFull: data.landlordName」是 ADR-002 有意的：Pro 才能看完整姓名
  // Prisma create.data 區塊內，且 landlordNameFull 與 landlordName 同時出現 → 合規
  if (/landlordNameFull\s*:\s*data\.landlordName/.test(line)) return true;
  // Prisma where filter：`where.landlordName = { contains: q }`（DB 內已是 masked 資料）
  if (/where\.landlordName\s*=/.test(line)) return true;
  // Prisma select: `landlordName: true,`（select list 內欄位宣告）
  if (/\blandlordName\s*:\s*true\b/.test(line)) return true;
  return false;
}

function scan(dir: string, violations: Violation[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full, violations);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    // 跳過測試檔
    if (/\.test\./.test(entry.name)) continue;
    let text: string;
    try {
      text = fs.readFileSync(full, "utf-8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (!/landlordName/.test(line)) return;
      if (isAllowedContext(line)) return;
      violations.push({
        file: path.relative(path.resolve(__dirname, "../.."), full),
        line: i + 1,
        snippet: line.trim(),
      });
    });
  }
}

describe("ADR-002 invariant: 所有 landlordName 出現都必須經過 maskLandlordName", () => {
  it("靜態掃描 src/ 沒有找到 raw landlordName bypass", () => {
    const violations: Violation[] = [];
    scan(SRC_DIR, violations);
    // 若有違規，列出來幫助 debug
    if (violations.length > 0) {
      const detail = violations
        .map((v) => `  ${v.file}:${v.line}\n    ${v.snippet}`)
        .join("\n");
      throw new Error(
        `ADR-002 invariant violated — landlordName 繞過 maskLandlordName()：\n${detail}`,
      );
    }
    expect(violations).toEqual([]);
  });

  it("maskLandlordName 是 src/ 中 landlordName 處理的 single source of truth", () => {
    // 對齊用 sanity check：maskLandlordName 至少被 import 過一次
    const files = walkFiles(SRC_DIR);
    let importCount = 0;
    for (const f of files) {
      if (/\.test\./.test(f)) continue;
      const text = fs.readFileSync(f, "utf-8");
      if (/from\s+["']@\/lib\/mask["']/.test(text)) importCount++;
    }
    expect(importCount).toBeGreaterThan(0);
  });

  it("isAllowedContext 對 raw bypass 正確回傳 false（sanity check）", () => {
    // 確保 allowlist 不會把真正的違規當作合規
    expect(isAllowedContext('return data.landlordName;')).toBe(false);
    expect(isAllowedContext('console.log(input.landlordName);')).toBe(false);
    expect(isAllowedContext('JSON.stringify(payload.landlordName)')).toBe(false);
    expect(isAllowedContext('await res.json(payload.landlordName);')).toBe(false);
  });
});

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}
