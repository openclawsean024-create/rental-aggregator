# rental-aggregator 狀態

> 2026-08-08 (Alex 接手)

## M1 黑名單 MVP ✅

### 已完成

- ✅ Next.js 16.3.0 + TS + Tailwind + Prisma 骨架
- ✅ Prisma schema 對齊 PRD §4.3（User / BlacklistEntry / Inspection / LeaseContract）
- ✅ Seed 1,000 筆程式生成（不爬 Dcard — 爬蟲法律風險）
- ✅ GET /api/blacklist?q=&district= 12ms warm
- ✅ POST /api/blacklist 104ms, status=pending 入審核佇列
- ✅ GET /api/blacklist/stats — TOP 5 風險區 + 804 最近 7 天新增
- ✅ 首頁 hero 搜尋 + Airbnb-style 安靜卡片 + 風險區 TOP 5 bar chart
- ✅ 設計準則：slate/indigo + amber 警示 + red-700 嚴重 + Inter/Noto Sans TC
- ✅ vitest 22/22 pass, coverage 95.09% / 92.47% / 83.33%
- ✅ tsc --noEmit 0 error
- ✅ next build 0 error
- ✅ Vercel 部署成功（production SHA `08102c1`）
- ✅ alias rental-aggregator-sean.vercel.app + rental-aggregator-three.vercel.app
- ✅ Notion page `3b6449ca-65d8-81c4-a5f2-f398433ad93e`
- ✅ sync-3way.sh 3-way 對齊

### ⚠️ Blocker — 需要 Sean 拍板

**Production DB 連不上**：Vercel serverless filesystem 是 read-only，SQLite file 沒法寫進去。
- `/api/blacklist` 在 production 回 500
- `/api/health` 回 503
- **首頁本身 200 OK**（靜態 HTML 渲染），但風險區 TOP 5 卡住 loading

候選解（單一推薦）：

1. **Neon 免費 Postgres** — 直接給我 connection string，我 5 分鐘內 PATCH Vercel env + 切 schema provider + 跑 schema push + re-deploy
2. **Supabase** — 跟 PRD §4.1 寫的一致，但需要你給 project id + service role key
3. **裝 Vercel Postgres** — `vercel postgres create` CLI，需要你授權 team integration

> 我**單一推薦**：[Neon](https://neon.tech) 免費 Postgres，5 分鐘就好。

### 設計決策紀錄（給之後接手的人）

- 開發 SQLite、production 必須 Postgres（schema 同步 `provider="postgresql"` 切換）
- Seed 程式生成而不是爬 Dcard（PRD §7.1 R1/R5 風險）
- M1 階段 POST 自動 upsert 匿名 user（避免 FK 違規）
- Next 16 CVE 強制升級、CSS @import 必須在 @tailwind 之前
- Vercel Turbopack 失敗 → 改用 --webpack
- 開發 lockfile 在 Vercel x64 跟 Mac ARM64 binary sha 不 match → 移除 lockfile

## 下一階段：M2 屋況 + 租約

待 Sean 給 DB connection string + 部署穩定後開工。
