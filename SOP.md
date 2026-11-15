# SOP — 台灣租屋防雷網（暫定，rental-aggregator）

> 本 SOP 依 2026-11-16 的 `package.json` 與 `.github/workflows/ci.yml` 查證。本機未安裝 node，以下指令**未在本機執行**；CI 現況取自 GitHub Actions 紀錄。

## 1. 環境

- Node.js ≥ 20（`package.json` `engines`）；CI 使用 Node 20。
- 安裝：`npm ci --legacy-peer-deps`（與 `vercel.json` 的 `installCommand` 一致使用 `--legacy-peer-deps`）。
- 環境變數：複製 `.env.example` 為 `.env`。M1 只需要 `DATABASE_URL="file:./dev.db"`（給 `prisma generate`）；`UPSTASH_*`、`STRIPE_*`、`CLERK_*`、`R2_*` 在 M1 一律留空。**不得 commit `.env`。**

## 2. 本機驗證（每次交付前全部執行）

| 步驟 | 指令 | 說明 |
|---|---|---|
| 1 | `npm run db:generate` | 產生 Prisma client |
| 2 | `npm run lint` | ESLint flat config |
| 3 | `npm run typecheck` | `tsc --noEmit` |
| 4 | `npm run test:coverage` | Vitest + coverage，門檻 70% |
| 5 | `npm run build` | `prisma generate && next build --webpack` |
| — | Format | 尚未配置 |
| — | E2E | 尚未配置 |

一次執行：`npm run db:generate && npm run lint && npm run typecheck && npm run test:coverage && npm run build`。任何一步非 0 即停止並修正。

M1 新增的測試（見 `GOAL.md`，檔名可調整但需同步本表）：

| AC | 指令 |
|---|---|
| AC-002 | `npm test -- src/app/api/health`；`npx prisma validate` |
| AC-003 | `npm test -- src/lib/inspection.test.ts src/app/inspection` |
| AC-004 | `npm test -- src/lib/lease.test.ts src/app/lease` |
| AC-005 | `npm test -- src/lib/no-network.test.ts` |
| AC-006 | `npm test -- src/lib/fixtures-safety.test.ts` |

## 3. CI（`.github/workflows/ci.yml`）

- 觸發：push 到 `main`、對 `main` 的 PR、手動。
- Job：`lint` → `test` → `build`（需 lint、test 通過）→ `deploy`（只在 push 到 `main`，用 `amondnet/vercel-action`，需 `VERCEL_TOKEN` 等 secrets）。
- 現況（2026-11-16）：最近 7 次 push 全部失敗，原因是 test job 找不到 `@rollup/rollup-linux-x64-gnu`；build、deploy 從未執行。修正方式列在 `GOAL.md` AC-001。
- 檢查最近結果：`gh run list --repo openclawsean024-create/rental-aggregator --limit 5`；失敗細節：`gh run view <run-id> --log-failed`。

## 4. 資料庫

- schema：`prisma/schema.prisma`（開發為 SQLite）。改 schema → `npm run db:migrate` → commit `prisma/migrations/`。
- M1 會移除 `BlacklistEntry`（GOAL AC-002），需新增 migration；不需在任何雲端資料庫執行。
- `npm run db:seed` 目前會產生 1,000 筆假黑名單；M1 完成後 seed 只能產生明顯假資料的示範清單或不再需要。

## 5. 部署

- 正式站：`rental-aggregator-three.vercel.app`、`rental-aggregator-sean.vercel.app`（2026-11-16 仍在線，公開黑名單假資料）。
- **下架黑名單**由 Sean 在 Vercel 操作，不由 agent 執行。
- agent 不執行 `vercel deploy`，不修改 Vercel 專案設定或環境變數。

## 6. 資料與個資檢查

- 新增範例資料前確認：姓名加「示範」／「測試」、電話 0900-000-xxx、Email `@example.com`。
- 送 PR 前執行：`git grep -nIE "(sk_live|sk_test|AKIA[0-9A-Z]{12,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN)" -- src prisma scripts .github .env.example`，應無結果。
- 發現疑似真實個資或憑證：不要複製內容，記錄路徑並回報 Sean。

## 7. 故障排除

- Prisma client 異常：`rm -rf node_modules/.prisma && npm run db:generate`。
- CI 出現 rollup 原生模組錯誤：代表 lockfile 缺少 Linux optional 相依，依 AC-001 處理，不要以 `|| npm install` 掩蓋。
- Vitest 時間相關測試不穩：使用 `vi.useFakeTimers()` 與 `vi.setSystemTime()`；改環境變數用 `vi.stubEnv()` 並在 `afterEach` 呼叫 `vi.unstubAllEnvs()`。
