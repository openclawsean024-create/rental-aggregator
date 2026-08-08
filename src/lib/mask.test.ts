/**
 * 黑名單的核心個資保護：去識別化函式
 * 對齊 PRD §5.2 + ADR-002
 */
import { describe, it, expect } from "vitest";
import { maskLandlordName } from "./mask";

describe("maskLandlordName", () => {
  describe("三個字以上的姓名", () => {
    it("王大明 → 王○明", () => {
      expect(maskLandlordName("王大明")).toBe("王○明");
    });

    it("李小明 → 李○明", () => {
      expect(maskLandlordName("李小明")).toBe("李○明");
    });

    it("陳怡君 → 陳○君", () => {
      expect(maskLandlordName("陳怡君")).toBe("陳○君");
    });

    it("四個字姓名：歐陽大明 → 歐○明", () => {
      expect(maskLandlordName("歐陽大明")).toBe("歐○明");
    });
  });

  describe("雙字姓名", () => {
    it("陳伊 → 陳○", () => {
      expect(maskLandlordName("陳伊")).toBe("陳○");
    });

    it("林安 → 林○", () => {
      expect(maskLandlordName("林安")).toBe("林○");
    });
  });

  describe("邊界情況", () => {
    it("空字串 → 空字串", () => {
      expect(maskLandlordName("")).toBe("");
    });

    it("單字 → 單字（不處理）", () => {
      expect(maskLandlordName("王")).toBe("王");
    });

    it("白話：同樣的隱私保證 '張大膽' mask 為 '張○膽'", () => {
      expect(maskLandlordName("張大膽")).toBe("張○膽");
    });
  });

  describe("個資保護不變性", () => {
    it("mask 結果不包含完整姓名（中間字都已被遮罩）", () => {
      const names = ["王大明", "李小明", "陳怡君", "歐陽建宏"];
      for (const n of names) {
        const masked = maskLandlordName(n);
        if (n.length >= 3) {
          expect(masked).toContain("○");
          expect(masked[1]).toBe("○");
        }
      }
    });
  });
});
