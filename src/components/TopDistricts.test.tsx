/**
 * TopDistricts 元件測試
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TopDistricts } from "./TopDistricts";

describe("TopDistricts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("初次渲染顯示 loading skeleton", () => {
    render(<TopDistricts />);
    expect(screen.getAllByLabelText("載入中")).toHaveLength(5);
  });

  it("成功抓取 stats 後顯示 TOP 5 區域", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            topDistricts: [
              { district: "台北市大安區", count: 56 },
              { district: "台北市信義區", count: 56 },
              { district: "台北市中山區", count: 52 },
              { district: "新北市板橋區", count: 51 },
              { district: "新北市中和區", count: 35 },
            ],
            recentCount: 804,
            totalApproved: 804,
            pendingCount: 142,
          }),
      }),
    );

    render(<TopDistricts />);

    await waitFor(() => {
      expect(screen.getByText("台北市大安區")).toBeInTheDocument();
    });

    expect(screen.getByText("台北市信義區")).toBeInTheDocument();
    expect(screen.getByText("台北市中山區")).toBeInTheDocument();
    expect(screen.getByText("新北市板橋區")).toBeInTheDocument();
    expect(screen.getByText("新北市中和區")).toBeInTheDocument();
    expect(screen.getByText("已審核總數")).toBeInTheDocument();
    expect(screen.getByText("最近 7 天新增")).toBeInTheDocument();
    expect(screen.getByText("待審核中")).toBeInTheDocument();
  });

  it("fetch 失敗時不 crash（loading 維持不刪）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    render(<TopDistricts />);
    // 等一下避免 unhandled rejection，靠 happy-dom 容忍
    await new Promise((r) => setTimeout(r, 50));
    // 不 crash 就算通過（loading skeleton 仍存在）
    expect(screen.getAllByLabelText("載入中").length).toBeGreaterThanOrEqual(0);
  });
});
