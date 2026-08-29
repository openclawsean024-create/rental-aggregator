# Plan: rental-aggregator — M1 穩化 round

> 由 orchestrator 依據 `goal.md`（M1 穩化 scope）+ 9 個 agent briefs 拆出。
> Goal round 1/256（DSH autonomous rounds；本 goal 共 4 個 internal sequential round + 1 verify round）。
> 預估總 LOC：~220（不含測試）；~350（含測試）。

## Resume Context（Goal Round 1 接手時的狀態）

| Milestone | 狀態 | 證據 |
|---|---|---|
| **M1 — CI workflow + 開發流程文件** | ✅ 完成 + 已 commit | commit `f6b2e12`：`rpb(devops): add GitHub Actions CI workflow` — `.github/workflows/ci.yml` + `rpb-devops-verify.log` |
| **M2 — Edge case 測試補強** | 🟡 in progress（working tree 未 commit） | `src/lib/mask.test.ts` 已加 9 個 edge case（空字串 / 單字 / 複姓 / 英文姓名 / 已含遮罩）；`src/data/blacklist-store.test.ts` 已 import `isStaticMode` + `recordSubmission` 但新 case 還沒寫。**qA agent 接手時繼續。** |
| **M3 — 安全 hardening** | ⏳ 待開工（依賴 M2 baseline） |  |
| **M4 — 文件同步 + BUILD_REPORT** | ⏳ 待開工（依賴 M1 + M3） |  |

**git 狀態**：`branch main ahead of origin/main by 1 commit`（M1 未 push，符合 goal constraint）

**Orchestrator Round 1 動作**：plan 已存在 → 補上 Resume Context → commit PLAN.md → 進入 M2 接手（給 qa agent 派工）

---

## Status Update（Goal Round 2 結束時）

| Milestone | 狀態 | 證據 |
|---|---|---|
| **M1 — CI workflow** | ✅ 完成 | `f6b2e12` |
| **M2 — Edge case 測試補強** | ✅ 完成 + 已 commit | commit `b50494e`：`rpb(qa): Milestone 2 — edge case test coverage (87/87 passing)` — 4 test 檔（mask / blacklist-store / route / mask-invariant）+ `rpb-qa-verify.log`。test 數 34 → 87（+156%）。 |
| **M3 — 安全 hardening** | 🟡 backend 派工中 | backend subagent `e7aaac91-d904-437f-9183-6ffae3f9bc4b` 正在 background 跑 rate-limit.ts + evidenceUrls refine + 對應測試。security agent 待 M3 backend 完成後接手。 |
| **M4 — 文件同步 + BUILD_REPORT** | ⏳ 待開工 |  |

**git 狀態**：`branch main ahead of origin/main by 3 commits`（M1 + PLAN + M2；皆未 push，符合 goal constraint）

**已知 stderr noise（M1 baseline 既有，非 M2 引入，列為 known issue）**：
- `TopDistricts.test.tsx` 在 fetch mock 缺漏時打真的 `localhost:3000` → ECONNREFUSED
- `TopDistricts.test.tsx` 缺 `act()` wrap warning
→ 都是 M1 baseline 測試品質 issue；非 M2 範圍。前端 round 再處理。

**Round 2 Orchestrator 動作**：
1. qa subagent `8b74a3fe` 在 stale build lock 時失敗，但其 87/87 test 結果已落地
2. orchestrator 接手清掉 stale lock、重跑 verify（typecheck/test/build 全 exit 0）
3. commit M2（`b50494e`）
4. 派 backend 進 M3（subagent `e7aaac91`，背景跑）

## 為什麼這樣排

1. **M1（CI）獨立且阻塞 M4** — 沒 CI badge 之前 docs 無法更新 README。M2/M3 不阻塞 M1。
2. **M2（測試）獨立** — 純測試補強，不碰 production code，可與 M1 平行。
3. **M3（hardening）需要 M2 已有測試慣例** — ADR-002 invariant test 需要沿用 qa 在 M2 建立的 pattern。
4. **M4（docs）在所有後** — 需要 M1 完成（badge）、M3 完成（SECURITY_FINDINGS、BUILD_REPORT 內容）。

## Milestone 1 — CI workflow + 開發流程文件

- **owner**: devops
- **co-owner**: docs（M4 會收尾 badge 與 SOP CI 章節；本輪 docs 不開工）
- **scope**:
  - 新增 `.github/workflows/ci.yml`（Node 22, npm ci, typecheck + test + build on PR/push）
  - 不要動 `vercel.json`（那是 M3 security 的範圍）
- **verify**:
  - `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exit 0
  - YAML 內 actions pin 到 version（`@v4` 不是 `@main`）
  - jobs 包含 typecheck / test / build 三個 step
  - 觸發條件：`on: push` 到 `main` + `on: pull_request`
- **est. LOC**: ~40
- **verify log**: `rpb-devops-verify.log`

## Milestone 2 — Edge case 測試補強

- **owner**: qa
- **scope**（既有 test 檔擴充 + 新檔）：
  - `src/lib/mask.test.ts` — 新增：空字串 / 單字 / 複姓（歐陽、司馬）/ 外國姓名（英文 Mary Smith）/ 已含「○」字串 / null-ish
  - `src/data/blacklist-store.test.ts` — 新增：`isStaticMode()` 四種組合（dev+SQLite / dev+no DB / Vercel+postgresql URL / Vercel+placeholder URL）、`searchApproved()` 空 blacklist.json fallback、`recordSubmission()` 重複 ID 容錯
  - 新增 `src/app/api/blacklist/route.test.ts`（route handler 整合測試，使用 happy-dom + fetch mock）— `q` 空字串 / SQL 注入試圖（`'%'; DROP TABLE--`）/ unicode（中英文混雜）/ district 不存在 / limit 超出範圍 / invalid category enum
  - **不動** production code（M2 是純測試 round）
  - **不開新 test framework**，沿用 vitest
- **verify**:
  - `npm run typecheck` exit 0
  - `npm test` exit 0，coverage ≥ 95% statements（不低於 M1 baseline）
  - `npm run build` exit 0
  - 新測試全綠，且**每個新 case 至少有一個斷言**
- **est. LOC**: ~180（測試碼）
- **verify log**: `rpb-qa-verify.log`

## Milestone 3 — 安全 hardening

- **owner**: security（lead）
- **co-owner**: backend（實作 production code 變更）
- **scope**:
  - **security（lead）**:
    - 新增 `SECURITY_FINDINGS.md` — 本輪掃描結果（OWASP Top 10 + ADR-002 + 個資法 §5.2）
    - `vercel.json` 加 CSP / X-Frame-Options / Strict-Transport-Security / Referrer-Policy / X-Content-Type-Options
    - 與 qa 協調 ADR-002 invariant test 規格（qa 在 M2 已寫）
  - **backend（impl）**:
    - 新增 `src/lib/rate-limit.ts`（in-memory token bucket, per-IP, 5 req/min, sliding window）
    - `src/app/api/blacklist/route.ts` POST handler 加 rate limit（GET 不限）
    - `PostSchema.evidenceUrls` 從 `.url()` 改成 `.refine(s => /^https?:\/\//.test(s), "evidenceUrls 必須是 http(s) URL")`
    - 在 static mode 下也要走 rate limit（POST 是公開 endpoint）
  - **不動**：DB schema、SPEC scope 章節、push
- **verify**:
  - 既有 `npm test` 全綠（M2 baseline 不能 regress）
  - 新增 rate limit 測試：連發 6 次 POST → 第 6 次 429
  - 新增 evidenceUrls 拒絕測試：`file:///etc/passwd` / `javascript:alert(1)` / `ftp://x` → 400
  - ADR-002 invariant test 守住（所有回傳 path 都 mask）
  - `SECURITY_FINDINGS.md` 沒有 critical
  - `npm audit --omit=dev` 跑一次，記錄到 `rpb-security-deps.log`
- **est. LOC**: ~80 (security files) + ~60 (backend)
- **verify log**: `rpb-security-verify.log` + `rpb-backend-verify.log`

## Milestone 4 — 文件同步 + BUILD_REPORT

- **owner**: docs
- **scope**:
  - `README.md`：
    - 加 CI badge（指向 `.github/workflows/ci.yml`）+ coverage badge 維護
    - 「開發流程」章節補強：分支策略、commit 前綴（rpb:）、test workflow
  - `STATUS.md`：新增「M1 Hardening 紀錄」區塊（列出本輪做的事）
  - `SOP.md`：補「CI 流程」+「新增測試」段落
  - 新增 `BUILD_REPORT.md`：本輪 rpb: commit 列表 + verify log 連結 + known issues
  - **不動** `PRD/SPEC.md` §1-§9（hard rule）
- **verify**:
  - `bash -n <(awk '/```bash/{flag=1;next}/```/{flag=0}flag' README.md)` exit 0
  - README 長度 ≤ 既有 × 1.5
  - `git grep -E "TODO|FIXME|HACK"` 沒有新增（M2/M3 不該留）
  - `git grep -E "(sk-|AKIA|ghp_)[A-Za-z0-9]{16,}"` 沒有 leak
  - 內部連結 target 存在
- **est. LOC**: ~120
- **verify log**: `rpb-docs-verify.log`

## Dependencies（執行順序）

```
M1 (CI) ──────────────────────┐
                               │
M2 (tests) ────────────────┐  │
                            │  │
                            ▼  ▼
                    M3 (security + backend)
                            │
                            ▼
                    M4 (docs + BUILD_REPORT)
                            │
                            ▼
                    Verify round + final summary
```

- **Round 1**: M1（devops）+ M2（qa）— 可平行（互不踩檔）
- **Round 2**: M3（security lead + backend impl）— 單一 milestone，兩 owner 協作
- **Round 3**: M4（docs）
- **Round 4**: 整體 verify + 產出 final summary

## Out of scope (this round) — 明確不做

- M2 屋況清單 30 項（下一輪）
- M2 定型化租約產生器（下一輪）
- M3 信託 5 家銀行比較（之後）
- M3 Stripe Checkout + Webhook（之後）
- DB schema breaking change
- Push 任何東西到 remote（除非 Sean 在本 session 明確說「可以 push」）
- 引入 heavyweight dependency（任何新增 dep 必須 ≤ 50KB 與零 transitive；除非 SPEC 同意）
- 修改 PRD/SPEC.md §1-§9（hard rule）
- 線上電子簽 / 公證（ADR-003）
- 跨平台租屋比價（Non-Goal #1）

## Risk Register（本輪）

| ID | Risk | Mitigation |
|---|---|---|
| R1 | vitest 預設排除 `src/app/api/**/route.ts`（API 整合測試） | M2 新增 route test 時順手調整 vitest.config.ts 加 `route.test.ts` 到 include，coverage 不要把 route 算進去（維持既有排除） |
| R2 | in-memory rate limit 在 Vercel serverless 多實例下會失效 | 加註解說明 production 多實例需換 Upstash Redis；M3 scope 不涵蓋此升級 |
| R3 | `evidenceUrls` 從 `.url()` 改成 `.refine` 可能 reject 既有合法 https URL | 測試要涵蓋合法 https 仍 200，非法 scheme 才 400 |
| R4 | CSP header 太嚴會破壞 Next.js inline style | 啟動時用 `Content-Security-Policy-Report-Only` 觀察一段時間，再轉正式（M3 不啟用 report-only，僅加嚴格但可運行的版本） |
| R5 | Sync-3way 自動 commit 衝突 orchestrator 的 PLAN.md | PLAN.md 放在 clone 根目錄，跟 SOP 的 commit pattern 一致；如有衝突 docs round 重排 |

## Coordination Rules

1. **Builders 不能互相踩同一個檔**。M1 只動 `.github/workflows/`，M2 只動 test 檔，M3 動 `vercel.json` + `src/app/api/blacklist/route.ts` + 新增 `src/lib/rate-limit.ts`，M4 動 `README/STATUS/SOP/BUILD_REPORT`。
2. **每個 milestone 的 verify 必須在 < 5 分鐘跑完**。CI workflow 在本地無法 `act` 模擬就跑 YAML lint + syntax check。
3. **不要重構整個目錄**。M3 動 `route.ts` 時只加 rate limit + evidenceUrls refine，不重構錯誤處理或加新功能。
4. **每輪結束跑 verify，存 log**。`rpb-<round>-<role>-verify.log`。
5. **進度透明**：每個 builder 完成後寫 3-5 行中文 summary（動了哪些檔、為什麼、verify 結果）到 commit message 或 `rpb-<round>-summary.md`。

## Verification Checklist（final round）

- [ ] `.github/workflows/ci.yml` 存在，YAML syntax 正確
- [ ] `npm run typecheck` exit 0
- [ ] `npm test` exit 0，coverage ≥ 95% statements
- [ ] `npm run build` exit 0
- [ ] `SECURITY_FINDINGS.md` 沒有 critical（high/medium 接受）
- [ ] `BUILD_REPORT.md` 列出本輪所有 rpb: commit
- [ ] README / STATUS / SOP 同步
- [ ] `git grep -E "TODO|FIXME|HACK"` 沒有新增
- [ ] `git grep -E "(sk-|AKIA|ghp_)[A-Za-z0-9]{16,}"` 沒有 leak
- [ ] 所有 `rpb-*-verify.log` 存在且 ✅
