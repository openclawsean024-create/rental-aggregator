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

  describe("M2 edge case — 空字串與單字", () => {
    it("空字串 → 空字串（明確斷言）", () => {
      expect(maskLandlordName("")).toBe("");
    });

    it("單字 '王' → '王'（長度 < 2 不處理）", () => {
      expect(maskLandlordName("王")).toBe("王");
    });

    it("兩字 '王明' → '王○'（首字保留，第二字遮罩）", () => {
      expect(maskLandlordName("王明")).toBe("王○");
    });

    it("null → 空字串（既有 !fullName 防線）", () => {
      // @ts-expect-error 測 null 容錯
      expect(maskLandlordName(null)).toBe("");
    });

    it("undefined → 空字串（既有 !fullName 防線）", () => {
      // @ts-expect-error 測 undefined 容錯
      expect(maskLandlordName(undefined)).toBe("");
    });
  });

  describe("M2 edge case — 複姓", () => {
    it("複姓 '歐陽小明' → '歐○明'（依首字 + ○ + 末字規則）", () => {
      expect(maskLandlordName("歐陽小明")).toBe("歐○明");
    });

    it("複姓 '司馬中原' → '司○原'", () => {
      expect(maskLandlordName("司馬中原")).toBe("司○原");
    });

    it("四字以上 '歐陽司馬光' → '歐○光'", () => {
      expect(maskLandlordName("歐陽司馬光")).toBe("歐○光");
    });
  });

  describe("M2 edge case — 外國姓名（英文 ASCII）", () => {
    it("英文三字 'Mary Smith' → 'M○h'（依 ASCII 一樣適用 mask rule）", () => {
      // "Mary Smith" → 首字 'M' + '○' + 末字 'h' → 'M○h'
      expect(maskLandlordName("Mary Smith")).toBe("M○h");
    });

    it("英文兩字 'Li' → 'L○'", () => {
      expect(maskLandlordName("Li")).toBe("L○");
    });

    it("英文單字 'A' → 'A'（長度 < 2 不處理）", () => {
      expect(maskLandlordName("A")).toBe("A");
    });
  });

  describe("M2 edge case — 已含遮罩字元不重複 mask", () => {
    it("'王○明' 已含 '○' → 不重複遮罩，原樣回傳 '王○明'", () => {
      // 既有程式碼只 mask 中間字（index 0 與 last），不做「偵測已 mask」
      // 故 '王○明' (length 3) → '王' + '○' + '明' = '王○明'（恰好不變）
      expect(maskLandlordName("王○明")).toBe("王○明");
    });

    it("'陳○君' 已含 '○' → '陳○君' 不變", () => {
      expect(maskLandlordName("陳○君")).toBe("陳○君");
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
