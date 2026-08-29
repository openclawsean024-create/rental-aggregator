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

---

## Status Update（Goal Round 3 中段 — backend 完成 + security 派工）

| Milestone | 狀態 | 證據 |
|---|---|---|
| **M1 — CI workflow** | ✅ 完成 | `f6b2e12` |
| **M2 — Edge case 測試補強** | ✅ 完成 | `b50494e` |
| **M3 backend — rate-limit + evidenceUrls refine** | ✅ 完成 + 已 commit | commit `23e7683`：`rpb(backend): M3 hardening — rate limit + evidenceUrls scheme allowlist` — 5 檔（rate-limit.ts 新檔、rate-limit.test.ts 新檔 14 unit tests、route.ts POST 套 rate limit、route.test.ts +6 case、rpb-backend-verify.log） |
| **M3 security — vercel.json headers + SECURITY_FINDINGS.md** | 🟡 派工中 | security subagent `09417c70-ab2e-413e-9699-f3873248516c` 正在 background 跑 vercel.json headers + SECURITY_FINDINGS.md + npm audit |
| **M4 — 文件同步 + BUILD_REPORT** | ⏳ 待開工 |  |

**git 狀態**：`branch main ahead of origin/main by 5 commits`（M1 + 2× PLAN + M2 + M3 backend；皆未 push）

**M3 backend verify（orchestrator 獨立重跑確認）**：
- typecheck EXIT=0
- test 107/107 passed（8 files，1.13s）— M2 baseline 87 + M3 backend +20
- build EXIT=0，5 routes

**M3 backend 重點產出**：
- `src/lib/rate-limit.ts`（127 行）— per-IP sliding window 5 req/min，附 R2 Vercel 多實例已知限制 JSDoc
- `src/lib/rate-limit.test.ts`（167 行，14 unit tests）— 100% coverage
- POST `/api/blacklist`：Zod parse 之前先 `checkRateLimit(ip)`，避免 schema 試誤攻擊
- `evidenceUrls`：`.url()` → `.url().refine(/^https?:\/\//i)` — 拒絕 javascript: / file: / data: / ftp:
- coverage 97.16% statements

**Round 3 Orchestrator 動作**：
1. backend subagent `e7aaac91` 回報 M3 backend 完成（commit 23e7683）
2. orchestrator 獨立重跑 verify 三個 command（typecheck/test/build 全 exit 0，test 107/107）— 確認 backend 報告可信
3. 派 security 進 M3 第二段（subagent `09417c70`，背景跑）

---

## Status Update（Goal Round 4 — M3 全完成 + M4 派工）

| Milestone | 狀態 | 證據 |
|---|---|---|
| **M1 — CI workflow** | ✅ 完成 | `f6b2e12` |
| **M2 — Edge case 測試補強** | ✅ 完成 | `b50494e` |
| **M3 backend — rate-limit + evidenceUrls** | ✅ 完成 | `23e7683` |
| **M3 security — vercel.json headers + SECURITY_FINDINGS** | ✅ 完成 + 已 commit | commit `0ac551f`：`rpb(security): M3 hardening — security headers + SECURITY_FINDINGS` — 3 檔（SECURITY_FINDINGS.md 215 行、rpb-security-verify.log 303 行、vercel.json +14 行 6 headers）。FINDINGS: 0 critical / 1 HIGH fixed / 2 MEDIUM fixed / 1 KNOWN LIMITATION。npm audit --omit=dev 0 漏洞。 |
| **M4 — 文件同步 + BUILD_REPORT** | 🟡 派工中 | docs subagent `d37daf6e-f667-4049-9cd2-c137cabfe948` 正在 background 跑 README badges + STATUS + SOP + 新增 BUILD_REPORT.md |

**git 狀態**：`branch main ahead of origin/main by 7 commits`（皆未 push，符合 goal constraint）

**M3 security verify（orchestrator 獨立重跑確認）**：
- typecheck EXIT=0
- test 107/107 passed（8 files，1.04s）— M3 backend baseline 不變
- build EXIT=0，5 routes
- vercel.json 6 security headers 已生效（CSP 可運行版本 / X-Frame-Options DENY / HSTS / Referrer-Policy / Permissions-Policy / X-Content-Type-Options）

**M3 security 重點產出**：
- SECURITY_FINDINGS.md：完整 OWASP Top 10 檢視 + 4 findings（critical/high/medium/known limitation）+ CSP 設計理由
- vercel.json：保留既有 build config（不破 build），新增 headers 區塊覆蓋 `/(.*)`
- npm audit：prod 0 漏洞；dev 12 個 moderate+ 留 follow-up
- R2 known limitation 紀錄完整

**Round 4 Orchestrator 動作**：
1. security subagent `09417c70` 回報 M3 security 完成（commit 0ac551f）
2. orchestrator 獨立重跑 verify 三個 command（typecheck/test/build 全 exit 0）— 確認 security 報告可信
3. 派 docs 進 M4（subagent `d37daf6e`，背景跑）

---

## 🏁 FINAL STATUS — Goal 完成

| Milestone | 狀態 | 證據 |
|---|---|---|
| **M1 — CI workflow** | ✅ 完成 | `f6b2e12` |
| **M2 — Edge case 測試** | ✅ 完成 | `b50494e`（34 → 87 tests） |
| **M3 backend — rate-limit + evidenceUrls** | ✅ 完成 | `23e7683`（87 → 107 tests, coverage 97.16%） |
| **M3 security — headers + FINDINGS** | ✅ 完成 | `0ac551f`（6 headers, 4 findings, npm audit 0 prod CVE） |
| **M4 — 文件同步 + BUILD_REPORT** | ✅ 完成 | `946b839`（README/STATUS/SOP 更新 + 新增 BUILD_REPORT.md） |

**Total commits ahead of origin/main：9**（皆未 push，符合 goal constraint）

```
946b839  rpb(docs): M4 — file sync + BUILD_REPORT
dd88f22  rpb(orchestrator): PLAN.md status update — M3 done, M4 in flight
0ac551f  rpb(security): M3 hardening — security headers + SECURITY_FINDINGS
6b575b2  rpb(orchestrator): PLAN.md status update — M3 backend done, security in flight
23e7683  rpb(backend): M3 hardening — rate limit + evidenceUrls scheme allowlist
bf5d49b  rpb(orchestrator): PLAN.md status update — M2 done, M3 backend in flight
b50494e  rpb(qa): Milestone 2 — edge case test coverage (87/87 passing)
b20ab4c  rpb(orchestrator): PLAN.md with Resume Context (Goal Round 1)
f6b2e12  rpb(devops): add GitHub Actions CI workflow (Milestone 1)
```

### Final Verify（orchestrator 獨立跑，5 個檢查全綠）

| 檢查 | 結果 |
|---|---|
| `npm run typecheck` | ✅ EXIT=0 |
| `npm test` | ✅ **107/107 passed**（8 files, 1.01s） |
| `npm run build` | ✅ EXIT=0（5 routes） |
| TODO/FIXME/HACK scan | ✅ 0 new debt（rpb-docs-verify.log 自指不算） |
| Secrets scan | ✅ 0 hits |
| console.log in app code | ✅ 0（兩個命中都在 test 檔：route.test.ts 的斷言註解 + mask-invariant.test.ts 的 invariant fixture） |

### Success Criteria 驗收對照（goal.md §Success Criteria）

| # | 條件 | 結果 |
|---|---|---|
| 1 | 三個 verify command 全綠，無新增 warning | ✅ typecheck/test/build 全 EXIT=0；無新 warning（M1 baseline 的 `act()`/ECONNREFUSED stderr 是既有 noise） |
| 2 | 沒有破壞性改動 | ✅ 公開 API contracts 不變（只新增 headers；rate limit 對合法 client 透明；evidenceUrls 是收緊而非放寬） |
| 3 | 新增程式碼有測試覆蓋 | ✅ 新增 53 tests（mask 9 / blacklist-store 13 / route 22 + mask-invariant 3 / rate-limit 14）；coverage 95.09% → 97.16% statements |
| 4 | 文件同步 | ✅ README（CI + coverage badge + Security posture 段落）+ STATUS（M1 Hardening 紀錄）+ SOP（CI 流程 + 測試慣例）+ BUILD_REPORT.md |
| 5 | Code quality bar | ✅ 無 TODO/FIXME/HACK / 無 console.log（除 test invariant）/ 無未使用 import / 無 raw exception 吞噬 |
| 6 | commit message 包含 `rpb:` 前綴 | ✅ 全部 9 個 commit 都符合：`rpb(devops)` / `rpb(orchestrator)` / `rpb(qa)` / `rpb(backend)` / `rpb(security)` / `rpb(docs)` |

### Constraints 對照（goal.md §Constraints）

| 約束 | 結果 |
|---|---|
| 不要 `git push` | ✅ 9 commits 全部本地，未 push |
| 不要改 PRD/SPEC.md §1-§9 | ✅ 完全沒動 SPEC.md |
| 不要引入新 heavyweight dep | ✅ M3 backend 用 stdlib Map；M2 test 用既有 vitest；zero new deps |
| 不要把 secrets 寫進 commit | ✅ `git grep -E "(sk-|AKIA|ghp_)[A-Za-z0-9]{16,}"` 0 hits |
| 不要改既有 schema | ✅ Prisma schema.prisma 完全沒動 |
| 不要跳過驗收 | ✅ 每個 milestone 都有 `rpb-*-verify.log`，final verify 5 項全綠 |
| 不要 LLM 自行聲稱完成 | ✅ 每個 builder 都有 verify log；orchestrator 獨立重跑確認 |

### Known Limitations（follow-up，下一輪再處理）

1. **PLAN.md R2**：rate limit in-memory 多實例不精確 → production 升級 Upstash Redis / Vercel KV
2. **M1 baseline noise**：`TopDistricts.test.tsx` 缺 `act()` wrap + fetch mock 缺漏時打 `localhost:3000` → frontend round 補
3. **devDependencies CVEs**：`npm audit fix --force` 升級 happy-dom / postcss / esbuild（需先跑回歸 + peer deps 驗證）
4. **CSP 進階**：nonce-based + Report-Only 觀察期
5. **CI 強化**：加 `npm audit --omit=dev --audit-level=high` 步驟

### 完成聲明

Goal `goal-88729ab3-eeb8-448d-95a0-39c9190d35de` 達成所有 success criteria，可標記 complete。

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
