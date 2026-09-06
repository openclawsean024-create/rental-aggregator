/**
 * Static blacklist store 測試
 * 用途：M1 production fallback（Vercel serverless filesystem read-only）
 */
import { describe, it, expect, vi } from "vitest";
import {
  searchApproved,
  getStats,
  getAllApproved,
  isStaticMode,
  recordSubmission,
} from "./blacklist-store";

describe("static blacklist store", () => {
  it("getAllApproved 至少有 800 筆", () => {
    const all = getAllApproved();
    expect(all.length).toBeGreaterThanOrEqual(800);
  });

  it("所有資料都已去識別化（沒有真實姓名）", () => {
    const all = getAllApproved();
    // 抽 100 筆檢查
    for (const e of all.slice(0, 100)) {
      expect(e.landlordName).toMatch(/○/);
      // 至少 2 個字（姓 + 1 個字）
      expect(e.landlordName.length).toBeGreaterThanOrEqual(2);
    }
  });

  describe("searchApproved", () => {
    it("q=王 應回多筆（含王姓氏）", () => {
      const result = searchApproved({
        q: "王",
        limit: 20,
        offset: 0,
      });
      expect(result.items.length).toBeGreaterThan(0);
      for (const item of result.items) {
        expect(item.landlordName).toContain("王");
      }
      expect(result.total).toBeGreaterThan(0);
    });

    it("q=王 + district=大安 應正確 filter", () => {
      const result = searchApproved({
        q: "王",
        district: "大安區",
        limit: 20,
        offset: 0,
      });
      for (const item of result.items) {
        expect(item.landlordName).toContain("王");
        expect(item.addressDistrict).toContain("大安區");
      }
    });

    it("q=找不到 → 0 結果", () => {
      const result = searchApproved({
        q: "不存在之姓氏",
        limit: 20,
        offset: 0,
      });
      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it("依 severity desc + lastIncidentAt desc 排序", () => {
      const result = searchApproved({ limit: 100, offset: 0 });
      for (let i = 1; i < result.items.length; i++) {
        const prev = result.items[i - 1];
        const curr = result.items[i];
        if (prev.severity === curr.severity) {
          expect(new Date(prev.lastIncidentAt).getTime()).toBeGreaterThanOrEqual(
            new Date(curr.lastIncidentAt).getTime(),
          );
        } else {
          expect(prev.severity).toBeGreaterThanOrEqual(curr.severity);
        }
      }
    });

    it("limit 與 offset 正確運作", () => {
      const limit = 30;
      const page1 = searchApproved({ limit, offset: 0 });
      const page2 = searchApproved({ limit, offset: limit });
      expect(page1.items.length).toBeLessThanOrEqual(limit);
      expect(page2.items.length).toBeLessThanOrEqual(limit);
      // 兩頁不重疊
      const page1Ids = new Set(page1.items.map((i) => i.id));
      for (const item of page2.items) {
        expect(page1Ids.has(item.id)).toBe(false);
      }
    });

    it("performance: 100 筆 filter < 50ms", () => {
      const start = Date.now();
      searchApproved({
        q: "王",
        district: "大安區",
        limit: 20,
        offset: 0,
      });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("getStats", () => {
    it("TOP 5 區域回 5 個且排序", () => {
      const stats = getStats();
      expect(stats.topDistricts.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < stats.topDistricts.length; i++) {
        expect(stats.topDistricts[i - 1].count).toBeGreaterThanOrEqual(
          stats.topDistricts[i].count,
        );
      }
    });

    it("totalApproved = 全部筆數", () => {
      const stats = getStats();
      const all = getAllApproved();
      expect(stats.totalApproved).toBe(all.length);
    });

    it("recentCount <= totalApproved", () => {
      const stats = getStats();
      expect(stats.recentCount).toBeLessThanOrEqual(stats.totalApproved);
    });

    it("包含台北市大安區（PRD §11.3 預期）", () => {
      const stats = getStats();
      const daan = stats.topDistricts.find(
        (d) => d.district === "台北市大安區",
      );
      expect(daan).toBeDefined();
    });
  });

  // ============================================================
  // M2 edge case — isStaticMode env 組合矩陣
  // 注意：因 blacklist-store.ts 在 module load 時已經 import blacklist.json
  // 且內部只讀 process.env 在函式內，這裡用 vi.stubEnv + vi.unstubAllEnvs 處理
  // ============================================================
  describe("M2 edge case — isStaticMode env 組合", () => {
    it("無 USE_BLACKLIST_STATIC、無 VERCEL → 預設 false（dev 模式）", () => {
      vi.stubEnv("USE_BLACKLIST_STATIC", "");
      vi.stubEnv("VERCEL", "");
      vi.stubEnv("DATABASE_URL", "");
      expect(isStaticMode()).toBe(false);
    });

    it("USE_BLACKLIST_STATIC=1 → true（不論其他 env）", () => {
      vi.stubEnv("USE_BLACKLIST_STATIC", "1");
      vi.stubEnv("VERCEL", "");
      vi.stubEnv("DATABASE_URL", "");
      expect(isStaticMode()).toBe(true);
    });

    it("VERCEL=1 + DATABASE_URL=postgresql://... → false（真實 Postgres）", () => {
      vi.stubEnv("USE_BLACKLIST_STATIC", "");
      vi.stubEnv("VERCEL", "1");
      vi.stubEnv(
        "DATABASE_URL",
        "postgresql://user:pass@host:5432/db",
      );
      expect(isStaticMode()).toBe(false);
    });

    it("VERCEL=1 + DATABASE_URL=postgres://... → false（真實 Postgres，postgres:// 前綴也接受）", () => {
      vi.stubEnv("USE_BLACKLIST_STATIC", "");
      vi.stubEnv("VERCEL", "1");
      vi.stubEnv(
        "DATABASE_URL",
        "postgres://user:pass@host:5432/db",
      );
      expect(isStaticMode()).toBe(false);
    });

    it("VERCEL=1 + DATABASE_URL= 空字串 → true（Vercel 預設 fallback）", () => {
      vi.stubEnv("USE_BLACKLIST_STATIC", "");
      vi.stubEnv("VERCEL", "1");
      vi.stubEnv("DATABASE_URL", "");
      expect(isStaticMode()).toBe(true);
    });

    it("VERCEL=1 + DATABASE_URL=file:./dev.db → true（Vercel 看到 file:// 走 static）", () => {
      vi.stubEnv("USE_BLACKLIST_STATIC", "");
      vi.stubEnv("VERCEL", "1");
      vi.stubEnv("DATABASE_URL", "file:./dev.db");
      expect(isStaticMode()).toBe(true);
    });

    it("VERCEL=1 + DATABASE_URL 含 'placeholder' → true", () => {
      vi.stubEnv("USE_BLACKLIST_STATIC", "");
      vi.stubEnv("VERCEL", "1");
      vi.stubEnv("DATABASE_URL", "postgresql://placeholder:5432/db");
      expect(isStaticMode()).toBe(true);
    });
  });

  // ============================================================
  // M2 edge case — searchApproved filter 行為
  // ============================================================
  describe("M2 edge case — searchApproved filter 行為", () => {
    it("全空字串參數 → 回傳所有 approved", () => {
      const all = getAllApproved();
      const result = searchApproved({
        q: "",
        district: "",
        category: "",
        limit: 20,
        offset: 0,
      });
      expect(result.total).toBe(all.length);
      expect(result.items.length).toBeLessThanOrEqual(20);
    });

    it("q 含 SQL injection 試圖 '%'; DROP TABLE-- → 不 throw，正常 filter", () => {
      expect(() =>
        searchApproved({
          q: "%'; DROP TABLE--",
          limit: 20,
          offset: 0,
        }),
      ).not.toThrow();
      // in-memory 過濾，沒有 SQL 風險，純字串 contains
      const result = searchApproved({
        q: "%'; DROP TABLE--",
        limit: 20,
        offset: 0,
      });
      expect(result.total).toBe(0);
    });

    it("q 含 unicode '王○' → 正常 filter", () => {
      const result = searchApproved({
        q: "王",
        district: "",
        category: "",
        limit: 50,
        offset: 0,
      });
      // 大部分 entry 都含 '王'
      expect(result.total).toBeGreaterThan(0);
      for (const item of result.items) {
        expect(item.landlordName).toContain("王");
      }
    });

    it("district = '不存在區' → total = 0", () => {
      const result = searchApproved({
        q: "",
        district: "不存在區",
        category: "",
        limit: 20,
        offset: 0,
      });
      expect(result.total).toBe(0);
      expect(result.items.length).toBe(0);
    });

    it("category = 'invalid_category' → total = 0（嚴格 enum 對齊）", () => {
      const result = searchApproved({
        q: "",
        district: "",
        category: "invalid_category",
        limit: 20,
        offset: 0,
      });
      expect(result.total).toBe(0);
    });
  });

  // ============================================================
  // M2 edge case — recordSubmission
  // ============================================================
  describe("M2 edge case — recordSubmission", () => {
    it("static mode：回傳 fake pending ID + 正確 payload mirror", () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      try {
        const result = recordSubmission({
          landlordName: "王○明",
          addressDistrict: "台北市大安區",
          category: "deposit_dispute",
          description: "退租時房東以各種理由拒退押金",
        });
        expect(result.id).toMatch(/^static-\d+-[a-z0-9]+$/);
        expect(result.status).toBe("pending");
        expect(result.landlordName).toBe("王○明");
        expect(result.addressDistrict).toBe("台北市大安區");
        expect(consoleSpy).toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("recordSubmission 帶 evidenceUrls → console.warn payload 內含 urls", () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      try {
        recordSubmission({
          landlordName: "陳○君",
          addressDistrict: "新北市板橋區",
          category: "fake_listing",
          description: "照片與實際屋況差很大",
          evidenceUrls: ["https://example.com/evidence1.jpg"],
        });
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("[blacklist-store]"),
          expect.objectContaining({
            payload: expect.objectContaining({
              evidenceUrls: ["https://example.com/evidence1.jpg"],
            }),
          }),
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("recordSubmission 連發兩次 → ID 不重複（Math.random 防碰撞）", () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      try {
        const a = recordSubmission({
          landlordName: "王○明",
          addressDistrict: "台北市大安區",
          category: "deposit_dispute",
          description: "退租時房東以各種理由拒退押金",
        });
        const b = recordSubmission({
          landlordName: "陳○君",
          addressDistrict: "新北市板橋區",
          category: "fake_listing",
          description: "照片與實際屋況差很大",
        });
        expect(a.id).not.toBe(b.id);
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});
