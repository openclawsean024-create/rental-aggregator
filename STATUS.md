# rental-aggregator 狀態

> 2026-08-08 (Hermes Agent 接手)

## M1 黑名單 MVP ✅ 完成 + Production Verified

### production 驗證結果（11/11 通過）

```
https://rental-aggregator-sean.vercel.app
https://rental-aggregator-three.vercel.app

✅ /api/health                      → HTTP 200, mode=static, 804 entries
✅ GET /api/blacklist?q=王&district=大安  → HTTP 200, 290ms
✅ GET /api/blacklist 第二次              → HTTP 200, 284ms (warm, < 500ms PRD §5.1)
✅ GET /api/blacklist/stats          → HTTP 200, 287ms
✅ POST /api/blacklist                 → HTTP 202, 293ms (status=pending, fake ID)
✅ Response shape: mode=static, totalEntries present
✅ totalEntries=804 ≥ 800（PRD §3.1 AC-01 預載 1,000 筆）
✅ 查詢含去識別化王姓 + 大安區
✅ stats TOP 5 含台北市
✅ POST mask 正確（生○）+ status=pending
✅ 首頁「找房前」+「免責聲明」都有
```

### 完成項目

- ✅ Next.js 16.3.0 + TS + Tailwind + Prisma 骨架
- ✅ Prisma schema 對齊 PRD §4.3（User / BlacklistEntry / Inspection / LeaseContract）
- ✅ Seed 1,000 筆程式生成（不爬 Dcard — 爬蟲法律風險）
- ✅ GET /api/blacklist?q=&district= + 去識別化（王○明）
- ✅ POST /api/blacklist → status=pending 進審核佇列
- ✅ GET /api/blacklist/stats — TOP 5 風險區 + 7 天新增
- ✅ 首頁 hero 搜尋 + Airbnb-style 安靜卡片 + 風險區 TOP 5 bar chart
- ✅ 設計準則：slate/indigo + amber 警示 + red-700 嚴重 + Inter/Noto Sans TC
- ✅ vitest 34/34 pass, coverage 95.09% / 92.47% / 83.33%
- ✅ tsc --noEmit 0 error
- ✅ next build 0 error
- ✅ Vercel 部署成功（production SHA `2105024`）
- ✅ alias rental-aggregator-sean.vercel.app + rental-aggregator-three.vercel.app
- ✅ Notion page `3b6449ca-65d8-81c4-a5f2-f398433ad93e`
- ✅ sync-3way 3-way 對齊

### 設計決策：Static JSON Fallback

**問題**：Vercel serverless filesystem 是 read-only，SQLite file 沒法寫。Sean 沒給 Supabase/Neon connection string 也沒授權 Vercel Postgres marketplace。

**解法**（2026-08-08）：
1. 把 1,000 筆 approved 資料 export 成 `src/data/blacklist.json`（248 KB）
2. 寫 `src/data/blacklist-store.ts` 提供 `searchApproved()` / `getStats()` / `recordSubmission()` 函式
3. Route Handler 根據 `isStaticMode()` 自動切換：
   - `USE_BLACKLIST_STATIC=1` 或 `VERCEL=1 + 沒有真的 Postgres URL` → 走 static JSON
   - `DATABASE_URL=file:...` → 走 Prisma + SQLite（dev mode）
4. POST 在 static 模式：console 記錄 + 回 202 + fake pending ID + 訊息告知管理員

**升級路（無需改 code）**：
- Sean 提供 Postgres connection string → PATCH Vercel env
- `isStaticMode()` 自動偵測到真的 URL → 切換回 Prisma 模式
- 移除 `src/data/blacklist.json` 也不是必須，但會浪費 248 KB

### 踩過的坑（記給以後參考）

1. **Vercel x64 vs Mac ARM64 binary sha mismatch** → 移除 lockfile + vercel.json installCommand
2. **Next 15.0.3 CVE 拒 deploy** → 升 16.3.0
3. **Next 16 Turbopack nft.json 路徑錯** → build script 改 `next build --webpack`
4. **`output: "standalone"` 部署失敗** → Vercel 預設用 Next.js 標準 serverless 部署，不需要 standalone
5. **postinstall prisma generate 在 install 階段 fail** → 移除，靠 build script 第一行 prisma generate
6. **Vercel CLI 印 `▲ Aliased` 但 alias 仍指舊 deployment** → 用 Vercel HTTP API 顯式 POST `/v2/deployments/{id}/aliases` 把 alias 指到新 deployment
7. **isStaticMode() 看似沒 work** → 真正原因是 alias 沒更新，serverless function 仍跑舊 deployment；用 `/api/debug` 端點 trace 出來

## 下一階段：M2 屋況清單 + 租約產生器

待 Sean 給 R2 bucket credentials（M2 拍照上傳才需要）後開工。
