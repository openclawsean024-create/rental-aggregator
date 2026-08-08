/**
 * Static blacklist store 測試
 * 用途：M1 production fallback（Vercel serverless filesystem read-only）
 */
import { describe, it, expect } from "vitest";
import {
  searchApproved,
  getStats,
  getAllApproved,
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
      const all = getAllApproved();
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
});
