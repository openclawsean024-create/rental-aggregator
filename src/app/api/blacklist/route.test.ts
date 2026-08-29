/**
 * /api/blacklist route handler 整合測試（M2 edge case 補強）
 *
 * 範圍：
 * - GET：基本查詢、空字串、SQL injection 試圖、unicode 查詢、
 *       limit 超出範圍、無效 category、district 不存在
 * - POST：缺欄位、合法 payload、javascript: URL（既有 .url() 行為紀錄）
 *
 * 環境設定：
 * - 設 USE_BLACKLIST_STATIC=1 走 in-memory 模式（避免 Prisma 連線）
 * - setup 用 vi.stubEnv，並在 afterEach 還原
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// 在 import route handler 之前設定 env，確保模組層級只讀 env 的邏輯正確
// 注意：route.ts 在 import 時只讀 process.env.USE_BLACKLIST_STATIC，但
// isStaticMode() 在每次 call 時才讀，所以可以在測試內動態切換
beforeAll(() => {
  vi.stubEnv("USE_BLACKLIST_STATIC", "1");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("DATABASE_URL", "");
});

afterEach(() => {
  // 每個 case 後確保還原預設 static 模式
  vi.stubEnv("USE_BLACKLIST_STATIC", "1");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("DATABASE_URL", "");
});

function makeGet(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

function makePost(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/blacklist GET", () => {
  it("沒參數 → 200，items 是陣列，total ≥ 0", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeGet("/api/blacklist"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.items)).toBe(true);
    expect(typeof json.total).toBe("number");
    expect(json.total).toBeGreaterThanOrEqual(0);
    expect(json.mode).toBe("static");
  });

  it("q= 空字串 → 200，正常回傳", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeGet("/api/blacklist?q="));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("static");
    expect(Array.isArray(json.items)).toBe(true);
  });

  it("q= '%'; DROP TABLE-- (SQL 注入試圖) → 200，不 crash", async () => {
    const { GET } = await import("./route");
    const url =
      "/api/blacklist?q=" +
      encodeURIComponent("%'; DROP TABLE--");
    const res = await GET(makeGet(url));
    expect(res.status).toBe(200);
    const json = await res.json();
    // 不會 crash，total 通常為 0（因為沒人叫「%'; DROP TABLE--」）
    expect(typeof json.total).toBe("number");
    expect(Array.isArray(json.items)).toBe(true);
  });

  it("q=王&district=大安 → 200，items 內含王姓 + 大安區", async () => {
    const { GET } = await import("./route");
    const url =
      "/api/blacklist?q=" +
      encodeURIComponent("王") +
      "&district=" +
      encodeURIComponent("大安");
    const res = await GET(makeGet(url));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBeGreaterThanOrEqual(0);
    for (const item of json.items) {
      expect(item.landlordName).toContain("王");
      expect(item.addressDistrict).toContain("大安");
    }
  });

  it("limit=999（超出 max 50） → 400（Zod 拒絕）", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeGet("/api/blacklist?limit=999"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid query parameters/i);
  });

  it("limit=0（低於 min 1） → 400", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeGet("/api/blacklist?limit=0"));
    expect(res.status).toBe(400);
  });

  it("offset=-1（負數） → 400", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeGet("/api/blacklist?offset=-1"));
    expect(res.status).toBe(400);
  });

  it("category=invalid_category → 200，items=[]（GET schema 不限定 enum）", async () => {
    // 重要：GET QuerySchema 用 z.string().trim().max(50).optional()，沒限定 enum
    // 所以 invalid category 不會 400，會回 200 + empty（filter 不到任何資料）
    const { GET } = await import("./route");
    const res = await GET(
      makeGet("/api/blacklist?category=invalid_category"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(0);
    expect(json.items.length).toBe(0);
  });

  it("q 超過 50 字 → 400（max length）", async () => {
    const { GET } = await import("./route");
    const longQ = "王".repeat(51);
    const url = "/api/blacklist?q=" + encodeURIComponent(longQ);
    const res = await GET(makeGet(url));
    expect(res.status).toBe(400);
  });

  it("q 含 unicode '王○' → 200，正常 filter", async () => {
    const { GET } = await import("./route");
    const url =
      "/api/blacklist?q=" + encodeURIComponent("王○");
    const res = await GET(makeGet(url));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.total).toBe("number");
  });

  it("district=不存在區 → 200，total=0", async () => {
    const { GET } = await import("./route");
    const url =
      "/api/blacklist?district=" +
      encodeURIComponent("不存在區");
    const res = await GET(makeGet(url));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(0);
  });

  it("回應 Cache-Control header 為 no-store", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeGet("/api/blacklist"));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("/api/blacklist POST", () => {
  it("缺 landlordName → 400", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePost("/api/blacklist", {
        addressDistrict: "台北市大安區",
        category: "deposit_dispute",
        description: "退租時房東以各種理由拒退押金",
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid payload/i);
  });

  it("缺 description → 400", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePost("/api/blacklist", {
        landlordName: "王小明",
        addressDistrict: "台北市大安區",
        category: "deposit_dispute",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("landlordName 太短（< 2 字） → 400", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePost("/api/blacklist", {
        landlordName: "王",
        addressDistrict: "台北市大安區",
        category: "deposit_dispute",
        description: "退租時房東以各種理由拒退押金",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("category 不在 enum → 400", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePost("/api/blacklist", {
        landlordName: "王小明",
        addressDistrict: "台北市大安區",
        category: "not_a_real_category",
        description: "退租時房東以各種理由拒退押金",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("description 太短（< 10 字） → 400", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makePost("/api/blacklist", {
        landlordName: "王小明",
        addressDistrict: "台北市大安區",
        category: "deposit_dispute",
        description: "太短",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("合法 payload → 202（static mode），landlordName 經 maskLandlordName 處理", async () => {
    const { POST } = await import("./route");
    const consoleSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    try {
      const res = await POST(
        makePost("/api/blacklist", {
          landlordName: "王小明",
          addressDistrict: "台北市大安區",
          category: "deposit_dispute",
          description: "退租時房東以各種理由拒退押金",
        }),
      );
      expect(res.status).toBe(202);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.mode).toBe("static");
      // ADR-002 個資保護：回傳的 landlordName 必須已被 mask
      expect(json.entry.landlordName).toBe("王○明");
      expect(json.entry.status).toBe("pending");
      // console.log 應有記錄
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("合法 payload 兩字姓名 → 202，mask 為『姓 + ○』", async () => {
    const { POST } = await import("./route");
    const consoleSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    try {
      const res = await POST(
        makePost("/api/blacklist", {
          landlordName: "陳伊",
          addressDistrict: "新北市板橋區",
          category: "fake_listing",
          description: "照片與實際屋況差很大，請勿上當",
        }),
      );
      expect(res.status).toBe(202);
      const json = await res.json();
      expect(json.entry.landlordName).toBe("陳○");
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("evidenceUrls=['javascript:alert(1)'] → 既有 .url() 通過，回 202（M3 會修）", async () => {
    // 重要：M2 只紀錄既有行為。PostSchema.evidenceUrls: z.array(z.string().url()).max(10).optional()
    // 既有 .url() 接受 javascript:alert(1) 為 valid URL（Zod 預設）
    // M3 會改成 .refine(s => /^https?:\/\//.test(s)) → 400
    const { POST } = await import("./route");
    const consoleSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    try {
      const res = await POST(
        makePost("/api/blacklist", {
          landlordName: "王小明",
          addressDistrict: "台北市大安區",
          category: "deposit_dispute",
          description: "退租時房東以各種理由拒退押金",
          evidenceUrls: ["javascript:alert(1)"],
        }),
      );
      // 既有行為：通過 Zod，static mode 回 202
      expect(res.status).toBe(202);
      const json = await res.json();
      expect(json.ok).toBe(true);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("evidenceUrls 含 https URL → 202（合法）", async () => {
    const { POST } = await import("./route");
    const consoleSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    try {
      const res = await POST(
        makePost("/api/blacklist", {
          landlordName: "王小明",
          addressDistrict: "台北市大安區",
          category: "deposit_dispute",
          description: "退租時房東以各種理由拒退押金",
          evidenceUrls: ["https://example.com/photo.jpg"],
        }),
      );
      expect(res.status).toBe(202);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("evidenceUrls 超過 10 個 → 400", async () => {
    const { POST } = await import("./route");
    const urls = Array.from(
      { length: 11 },
      (_, i) => `https://example.com/${i}.jpg`,
    );
    const res = await POST(
      makePost("/api/blacklist", {
        landlordName: "王小明",
        addressDistrict: "台北市大安區",
        category: "deposit_dispute",
        description: "退租時房東以各種理由拒退押金",
        evidenceUrls: urls,
      }),
    );
    expect(res.status).toBe(400);
  });
});
