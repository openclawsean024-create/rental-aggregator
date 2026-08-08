/**
 * 去識別化工具（PRD §5.2 / ADR-002）
 * 「王大明」→ 顯示「王○明」
 * 「陳伊」 → 顯示「陳○」
 * 雙字姓名保留姓 + 第一字用 ○ 取代
 * 三字以上保留姓 + 中間字 + 最後一字
 */

export function maskLandlordName(fullName: string): string {
  if (!fullName) return "";
  if (fullName.length < 2) return fullName;
  if (fullName.length === 2) {
    return `${fullName[0]}○`;
  }
  // 「王大明」→ 「王○明」
  return `${fullName[0]}○${fullName[fullName.length - 1]}`;
}
