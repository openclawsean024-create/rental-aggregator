/**
 * 糾紛類型 metadata（PRD §4.3 §3.1 P0-1）
 * 用於 UI 上顯示中文標籤 + 配色
 */

export type Category = {
  value: string;
  label: string;
  /** 預設配色：trust-y (slate/indigo), warn (amber-500), danger (red-700 by severity) */
  tone: "neutral" | "warn" | "danger";
};

export const CATEGORIES: Record<string, Category> = {
  deposit_dispute: {
    value: "deposit_dispute",
    label: "押金不退",
    tone: "danger",
  },
  early_termination: {
    value: "early_termination",
    label: "提前解約扣款",
    tone: "warn",
  },
  fake_listing: {
    value: "fake_listing",
    label: "假物件",
    tone: "warn",
  },
  maintenance_ignored: {
    value: "maintenance_ignored",
    label: "修繕不理",
    tone: "neutral",
  },
  illegal_deduction: {
    value: "illegal_deduction",
    label: "違約扣款",
    tone: "danger",
  },
};

export function getCategory(key: string): Category {
  return CATEGORIES[key] ?? {
    value: key,
    label: key,
    tone: "neutral",
  };
}
