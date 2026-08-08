/**
 * BlacklistSearch 元件測試
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BlacklistSearch } from "./BlacklistSearch";

describe("BlacklistSearch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("初次渲染顯示搜尋框", () => {
    render(<BlacklistSearch />);
    expect(screen.getByLabelText("房東姓名")).toBeInTheDocument();
    expect(screen.getByLabelText("區域")).toBeInTheDocument();
    expect(screen.getByLabelText("查詢")).toBeInTheDocument();
  });

  it("查詢後顯示結果列表", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: "1",
                landlordName: "王○明",
                addressDistrict: "台北市大安區",
                addressDetail: null,
                category: "deposit_dispute",
                description: "測試描述",
                reportCount: 5,
                viewCount: 100,
                severity: 5,
                lastIncidentAt: new Date(Date.now() - 86400000).toISOString(),
                createdAt: new Date().toISOString(),
              },
            ],
            total: 1,
            limit: 20,
            offset: 0,
            query: { q: "王", district: "大安" },
            elapsedMs: 12,
          }),
      }),
    );

    render(<BlacklistSearch />);
    const input = screen.getByLabelText("房東姓名");
    fireEvent.change(input, { target: { value: "王" } });
    fireEvent.click(screen.getByLabelText("查詢"));

    await waitFor(() => {
      expect(screen.getByText("王○明")).toBeInTheDocument();
    });

    expect(screen.getByText("台北市大安區")).toBeInTheDocument();
    expect(screen.getByText(/5 筆檢舉/)).toBeInTheDocument();
    expect(screen.getByText(/100 次瀏覽/)).toBeInTheDocument();
  });

  it("查詢 0 結果顯示『沒找到』訊息", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
            total: 0,
            limit: 20,
            offset: 0,
            query: {},
            elapsedMs: 5,
          }),
      }),
    );

    render(<BlacklistSearch />);
    fireEvent.click(screen.getByLabelText("查詢"));

    await waitFor(() => {
      expect(screen.getByText(/沒有找到符合條件/i)).toBeInTheDocument();
    });
  });

  it("fetch 失敗時顯示錯誤訊息", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    render(<BlacklistSearch />);
    fireEvent.click(screen.getByLabelText("查詢"));

    await waitFor(() => {
      expect(screen.getByText(/查詢失敗/)).toBeInTheDocument();
    });
  });
});
