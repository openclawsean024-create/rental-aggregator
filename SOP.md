# SOP — 開發流程 / 部署流程

## 開發紀律

1. 每完成一個 P0 功能 → `git commit` (conventional commits)
2. 每個 commit 後 → `bash ../sync-3way.sh rental-aggregator`（dry-run 預設）
3. 階段結束 → push → `bash ../sync-3way.sh rental-aggregator --push`
4. Commit message 前綴用 `rpb(<owner>):`（例：`rpb(backend):`、`rpb(qa):`、`rpb(docs):`、`rpb(devops):`、`rpb(security):`、`rpb(orchestrator):`）— 對應 owner 在 [BUILD_REPORT.md](./BUILD_REPORT.md) 與 [PLAN.md](./PLAN.md) 內可查

## 部署紀律

1. **改 DB schema** → 改 `prisma/schema.prisma` → `npm run db:migrate` → commit migration
2. **開發階段** — SQLite (`file:./dev.db`)
3. **Vercel production** — Vercel Postgres（待 S1-7 部署時切換）
4. **手動 deploy** — `npx vercel deploy --prod --yes --token $VERCEL_TOKEN`

## 個資保護紀律

- **永遠** 用 `maskLandlordName` 處理房東姓名
- Pro 完整姓名 API 必須檢查 user.plan === "PRO_YEARLY"
- POST 偵測不到 user → 自動 upsert 匿名 user

## 測試紀律

- 新增 lib 函式 → 同步寫 `.test.ts`
- 新增 React component → 同步寫 `.test.tsx`
- 跑 `npm run test:coverage` 確保 ≥ 70%
- **新增測試慣例**（M2/M3 round 確立）：
  - 沿用 vitest 框架（不引入 jest / playwright）
  - 檔案命名：與被測檔同層，`<file>.test.<ext>`（例：`rate-limit.ts` → `rate-limit.test.ts`）
  - 結構：AAA pattern（Arrange / Act / Assert）
  - `vi.stubEnv()` 改 env 變數時必須在 `afterEach(() => vi.unstubAllEnvs())` 重置，避免污染後續 test
  - 時間相關測試用 `vi.useFakeTimers()` + `vi.advanceTimersByTime()`，別依賴 `setTimeout` 真的等
  - 新測試**每個 case 至少一個斷言**（不要只 call function 不 expect）

## 新增 endpoint / 修改 route handler

- 任何 `src/app/api/**/route.ts` 新增 / 修改 handler → **必加對應 `route.test.ts`**（happy-dom + fetch mock；同目錄放）
- `evidenceUrls` / 任何接受外部 URL 的欄位 → 必加 `.refine(/^https?:\/\//i, "必須是 http(s) URL")`，拒絕 `javascript:` / `data:` / `file:` / `ftp:` 等危險 scheme
- 公開 POST endpoint 必加 `checkRateLimit(ip)`，在 Zod parse 之前先 check（避免 schema 試誤攻擊消耗 DB write）
- 見 [`src/app/api/blacklist/route.test.ts`](./src/app/api/blacklist/route.test.ts) 與 [`src/lib/rate-limit.ts`](./src/lib/rate-limit.ts) 作為參考樣板

## CI 流程（[.github/workflows/ci.yml](./.github/workflows/ci.yml)）

- **觸發條件** — push 到 `main` + 任何 `pull_request`（target branch `main`）
- **Runner** — `ubuntu-latest`，timeout 10 分鐘
- **權限** — `contents: read`（最小權限；無 `id-token` / `packages`）
- **Concurrency** — 同 PR 重複 push 自動 cancel-in-progress（避免浪費 runner）
- **Steps** — 依序：
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4`（Node 22，npm cache）
  3. `npm ci --legacy-peer-deps`（對齊 `vercel.json` installCommand）
  4. `npm run db:generate`（提早暴露 Prisma schema 錯誤）
  5. `npm run typecheck`（tsc --noEmit）
  6. `npm test`（vitest run）
  7. `npm run build`（`prisma generate && next build --webpack`）
- **本地對照** — PR 開之前先跑同一份三個 verify command（`typecheck` / `test` / `build`），存到 `rpb-<role>-verify.log`
- **Follow-up**（不在 M3 scope）：未加 `npm audit --omit=dev --audit-level=high` 步驟（防新增 high+ CVE），未加 cache hit 優化

## 故障排除

### Prisma 跑不起來

```bash
rm -rf node_modules/.prisma
npm run db:generate
```

### Vercel 拉不到新版

```bash
# 因為沒有 webhook，要手動
npx vercel deploy --prod --yes --token $VERCEL_TOKEN
```

### Seed 重複

`prisma/seed.ts` 內建 `deleteMany({ where: { submitterId: SYSTEM_USER_ID } })`，重跑安全。

### Rate limit 測試 flaky

`src/lib/rate-limit.test.ts` 用 `vi.useFakeTimers()`，若混用 `Date.now()` 會漏 reset。確保 `vi.setSystemTime()` + `vi.advanceTimersByTime()` 同步操作（見 rate-limit.test.ts:80~110 範例）。
