# rental-aggregator (台灣租屋防雷網)

## 目標

建立一個**台灣租屋防雷網**，幫租屋族避開黑心房東與黑心租約。最終交付（M5 Public Launch）：

1. **黑心房東黑名單**（M1 ✅ 已上線）— 可搜尋的去識別化資料庫，POST 提交進入審核佇列。
2. **屋況檢查清單**（M2 ⏳）— 入住 / 退房拍照比對，避免押金被扣。
3. **定型化租約產生器**（M2 ⏳）— 依台灣民法 / 租賃住宅市場發展及管理條例自動產生條款。
4. **押金信託比較**（M3 ⏳）— 各銀行信託商品評比。
5. **Pro 付費**（M3 ⏳）— 解鎖完整姓名 `landlordNameFull`、進階搜尋。

完整 PRD 見 [`PRD/SPEC.md`](./PRD/SPEC.md)、進度見 [`STATUS.md`](./STATUS.md)、操作流程見 [`SOP.md`](./SOP.md)。

---

## 避免

### 個資保護（強制，違反即回滾）

- **絕對不要**直接儲存 / 回傳未去識別化的房東姓名。任何寫入 DB 的房東姓名**一律**先過 `src/lib/mask.ts` 的 `maskLandlordName()`，存成 `王○明` 格式。
- **絕對不要**在一般 `GET /api/blacklist` 回應裡吐 `landlordNameFull`。完整姓名 API 必須檢查 `user.plan === "PRO_YEARLY"`，未付費使用者一律 403。
- POST 偵測不到 user 時可以自動 upsert 匿名 user，但**不可**因此繞過審核佇列（status 必須是 `pending`）。

### 部署與資料來源

- **不要爬 Dcard / 591 / 任何 UGC 平台** 來充實黑名單 — 爬蟲法律風險 + TOS 違反 + 證據鏈不可信。Seed 必須走程式生成（見 `prisma/seed.ts`）。
- **不要在 Vercel 用 SQLite** — Vercel serverless filesystem 是 read-only。Production 一律用 Postgres（Vercel Postgres 或外部 Neon/Supabase）。
- 當沒有真的 Postgres URL 時，Route Handler 會走 **Static JSON Fallback**（見 `src/data/blacklist-store.ts`），POST 進 console + 回 202 + fake ID。**不要**為了「讓 POST 真的寫入」而 hack SQLite — 等 Sean 提供 connection string 再切換。
- **不要開 `output: "standalone"`** — Vercel 預設 serverless 部署不需要；開了反而 deploy 失敗。

### 升級與工具鏈

- **不要 pin Next.js < 16.3.0** — 15.0.3 有 CVE，Vercel 會拒 deploy。
- **不要用 Turbopack build** — Next 16 Turbopack 的 `nft.json` 路徑在 Vercel 有 bug。build script 一律用 `next build --webpack`（已寫在 `package.json`）。
- **不要在 `package.json` 加 `postinstall` 跑 `prisma generate`** — Vercel install 階段會 fail。改在 `build` script 第一行跑 `prisma generate`（已處理）。
- **不要 commit `package-lock.json` 的同時又把 lockfile 移除** — Vercel x64 vs Mac ARM64 binary sha mismatch 時，要嘛完整 commit lockfile，要嘛用 `vercel.json` 的 `installCommand` 覆寫，不要混著來。

### 測試與覆蓋率

- **不要新增 lib 函式卻不寫 `.test.ts`**、**不要新增 React component 卻不寫 `.test.tsx`**（見 SOP §測試紀律）。
- 任何改動交付前必須跑 `npm test` + `npm run test:coverage`，確認 ≥ 70%（目前 95.09%）；失敗不可 merge。
- DB schema 變更必須同步改 `prisma/schema.prisma` + 跑 `npm run db:migrate` + commit migration 檔。

### 跨專案邊界

- 本專案**不**做房屋交易 / 仲介媒合 / 房東刊登，只做**防雷**（資訊揭露 + 工具）。
- **不要** import `agent-orchestrator`、`beauty-crm`、`meeting-recorder` 或其他 `Agent space` 子專案的程式碼 — 每個子專案是獨立部署單元。

---

## 技術棧與指令

### 技術棧

- **Frontend** — Next.js 16.3.0（App Router）+ React 19 + TypeScript 5.6
- **Styling** — Tailwind CSS 3.4 + framer-motion + lucide-react
- **API** — Next.js Route Handlers（`src/app/api/**/route.ts`）
- **DB** — Prisma 5.22（dev: SQLite `file:./dev.db`、prod: Postgres）
- **Validation** — Zod 3.23
- **Testing** — Vitest 2.1 + @testing-library/react + happy-dom + @vitest/coverage-v8
- **Deploy** — Vercel（手動 `vercel deploy --prod`，無 GitHub webhook）

### 目錄結構

```
rental-aggregator/
├── PRD/SPEC.md              # 完整 PRD（§1-§7）
├── prisma/
│   ├── schema.prisma        # User / BlacklistEntry / Inspection / LeaseContract
│   ├── migrations/          # dev / prod migration
│   └── seed.ts              # 1,000 筆程式生成黑名單
├── scripts/
│   └── export-seed-data.ts  # 把 approved 資料 export 成 JSON 給 static fallback
├── src/
│   ├── app/                 # App Router pages + api/
│   │   └── api/             # blacklist / blacklist/stats / health / debug
│   ├── components/          # React UI（含 .test.tsx）
│   ├── lib/                 # mask / categories / db / blacklist-store（含 .test.ts）
│   └── data/                # blacklist.json（static fallback）+ blacklist-store.ts
├── SOP.md                   # 開發 / 部署 / 個資保護 / 測試紀律
├── STATUS.md                # 各 milestone 進度與 production 驗證結果
├── README.md                # 對外文件（badges、API 契約、快速啟動）
├── next.config.mjs
├── tailwind.config.ts
├── vitest.config.ts
├── vercel.json
└── package.json
```

### 主要指令

```bash
# 安裝（注意 --legacy-peer-deps — Next 16 / React 19 peer dep）
npm install --legacy-peer-deps

# DB 初始化
npm run db:generate          # prisma generate
npm run db:migrate           # dev migration
npm run db:seed              # 預載 1,000 筆黑名單（idempotent）
npm run db:studio            # Prisma Studio GUI

# 開發 / 測試 / 型別檢查
npm run dev                  # next dev (port 3000)
npm test                     # vitest run
npm run test:coverage        # vitest run --coverage（須 ≥ 70%）
npm run typecheck            # tsc --noEmit
npm run lint                 # next lint
npm run build                # prisma generate && next build --webpack

# 部署（手動，沒有 webhook）
npx vercel deploy --prod --yes --token $VERCEL_TOKEN
```

### 環境變數

複製 `.env.example` 為 `.env`。**絕對不要 commit `.env`**（已寫進 `.gitignore`）。
Production 走 Vercel dashboard 設定，關鍵變數：

- `DATABASE_URL` — 真的 Postgres URL（沒給時自動 fallback 到 static JSON）
- `VERCEL=1` — 自動偵測
- `USE_BLACKLIST_STATIC=1` — 強制走 static fallback
- `VERCEL_TOKEN` — 部署用

### 設計準則（同步 README）

- **色系** — slate-50 背景 + indigo/brand 主色 + amber-500 警示 + red-700 嚴重
- **字體** — Inter / Noto Sans TC，內文 14/15px 行高 1.6
- **互動** — 100ms transition + focus ring-2
- **可及性** — WCAG AA color contrast
- **信任感** — 每頁 footer 都有免責聲明 + 資料來源 + 律師顧問 placeholder

### API 契約速查（完整見 README.md）

- `GET /api/blacklist?q=&district=&category=&limit=&offset=` — 查詢（去識別化，< 500ms）
- `GET /api/blacklist/stats` — TOP 5 風險區 + 7 天新增
- `POST /api/blacklist` — 提交檢舉（status=pending，3-7 個工作天審核）
- `GET /api/health` — 健康檢查 + mode/entry count
- `GET /api/debug` — 部署診斷（static fallback 啟動時才有 alias 問題時用）
