/**
 * 糾紛類型 metadata 測試
 */
import { describe, it, expect } from "vitest";
import { getCategory, CATEGORIES } from "./categories";

describe("categories", () => {
  it("五個核心類型都有", () => {
    expect(Object.keys(CATEGORIES)).toHaveLength(5);
    expect(CATEGORIES.deposit_dispute.label).toBe("押金不退");
    expect(CATEGORIES.early_termination.label).toBe("提前解約扣款");
    expect(CATEGORIES.fake_listing.label).toBe("假物件");
    expect(CATEGORIES.maintenance_ignored.label).toBe("修繕不理");
    expect(CATEGORIES.illegal_deduction.label).toBe("違約扣款");
  });

  it("押金不退應為 danger tone（PRD 設計準則：嚴重者 red-700）", () => {
    expect(CATEGORIES.deposit_dispute.tone).toBe("danger");
  });

  it("提前解約扣款應為 warn tone（amber-500）", () => {
    expect(CATEGORIES.early_termination.tone).toBe("warn");
  });

  it("getCategory 對未知類型給 fallback neutral", () => {
    const cat = getCategory("unknown_type");
    expect(cat.tone).toBe("neutral");
    expect(cat.label).toBe("unknown_type");
  });

  it("getCategory 對已知類型回正確 metadata", () => {
    const cat = getCategory("fake_listing");
    expect(cat.tone).toBe("warn");
    expect(cat.label).toBe("假物件");
  });
});
