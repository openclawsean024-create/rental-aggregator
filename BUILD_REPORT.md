# Build Report — rental-aggregator M1 Hardening round

> 期間：2026-08-29
> Branch：`main`（7 commits ahead of origin/main，皆未 push）
> Goal：把 M1 黑名單 MVP 從「能跑」推進到「production-ready」（見 [PLAN.md](./PLAN.md)）

## 本 round commits（依時序，從 `git log acfd188..HEAD` 撈）

1. `f6b2e12` — `rpb(devops): add GitHub Actions CI workflow (Milestone 1)`
   - owner: devops｜scope: CI infra
   - verify log: `rpb-devops-verify.log`
   - 改了 2 檔（+129/-0）：`.github/workflows/ci.yml`（new, 59 行）、`rpb-devops-verify.log`（new, 70 行）

2. `b20ab4c` — `rpb(orchestrator): PLAN.md with Resume Context (Goal Round 1)`
   - owner: orchestrator｜scope: plan
   - verify log: —（plan 檔，無 verify）
   - 改了 1 檔（+168/-0）：`PLAN.md`

3. `b50494e` — `rpb(qa): Milestone 2 — edge case test coverage (87/87 passing)`
   - owner: qa｜scope: tests
   - verify log: `rpb-qa-verify.log`
   - 改了 5 檔（+905/-1）：`src/lib/mask.test.ts`（+65）、`src/data/blacklist-store.test.ts`（+213）、`src/app/api/blacklist/route.test.ts`（new, 345）、`src/lib/mask-invariant.test.ts`（new, 154）、`rpb-qa-verify.log`（new, 129）

4. `bf5d49b` — `rpb(orchestrator): PLAN.md status update — M2 done, M3 backend in flight`
   - owner: orchestrator｜scope: plan
   - verify log: —（plan 檔）
   - 改了 1 檔（+24/-0）：`PLAN.md`

5. `23e7683` — `rpb(backend): M3 hardening — rate limit + evidenceUrls scheme allowlist`
   - owner: backend｜scope: security hardening impl
   - verify log: `rpb-backend-verify.log`
   - 改了 5 檔（+624/-33）：`src/lib/rate-limit.ts`（new, 127）、`src/lib/rate-limit.test.ts`（new, 167）、`src/app/api/blacklist/route.ts`（+43）、`src/app/api/blacklist/route.test.ts`（+178）、`rpb-backend-verify.log`（new, 142）

6. `6b575b2` — `rpb(orchestrator): PLAN.md status update — M3 backend done, security in flight`
   - owner: orchestrator｜scope: plan
   - verify log: —（plan 檔）
   - 改了 1 檔（+31/-0）：`PLAN.md`

7. `0ac551f` — `rpb(security): M3 hardening — security headers + SECURITY_FINDINGS`
   - owner: security｜scope: security hardening lead
   - verify log: `rpb-security-verify.log`
   - 改了 3 檔（+537/-1）：`vercel.json`（+18/-1）、`SECURITY_FINDINGS.md`（new, 216）、`rpb-security-verify.log`（new, 304）

**本 round 總計**：7 commits、17 files changed（新增 8 files + 修改 9 files）、LOC 估算約 +2,418 / -35（純從 `git log --stat` 加總，扣除 PLAN.md 變更）。

## Verify logs（本 round 全部 exit 0）

| Log | Owner | 涵蓋範圍 |
|---|---|---|
| `rpb-devops-verify.log` | devops | M1 CI YAML lint + action pin check + YamlSafeLoad |
| `rpb-qa-verify.log` | qa | M2 typecheck + 87/87 tests + build |
| `rpb-backend-verify.log` | backend | M3 backend typecheck + 107/107 tests + build + coverage 97.16% |
| `rpb-security-verify.log` | security | M3 security typecheck + 107/107 tests + build + npm audit + secrets scan + TODO scan |
| `rpb-docs-verify.log` | docs（本 round） | typecheck + 107/107 tests + build + README bash block lint + README size check + Markdown internal link check |

## 主要變更摘要

### M1 — CI workflow

新增 `.github/workflows/ci.yml`：Node 22、push + pull_request trigger、permissions: contents read、concurrency cancel-in-progress、order: `db:generate` → `typecheck` → `test` → `build`（10 分鐘 timeout）。

### M2 — Edge case 測試

22 → 87 → 107 tests；4 個既有 test 檔擴充 + 4 個新 test 檔（mask-invariant / rate-limit / route / blacklist-store 擴充）。ADR-002 mask-invariant 靜態掃描守住（所有 /api/blacklist response path 必須 mask）。

### M3 — Security hardening

**backend**：
- 新增 `src/lib/rate-limit.ts`（per-IP sliding window 5 req/min；`getClientIp()` 從 `x-forwarded-for` / `x-real-ip` / `"anonymous"` fallback；100% coverage）
- POST handler 加 rate limit（在 Zod parse 之前先 check）
- `evidenceUrls` 從 `.url()` 升級為 `.url().refine(/^https?:\/\//i)` 拒絕 `javascript:` / `file:` / `data:` / `ftp:`

**security**：
- `vercel.json` 加 6 個 security headers（CSP / X-Frame-Options DENY / HSTS / Referrer-Policy / Permissions-Policy / X-Content-Type-Options）
- 產出 `SECURITY_FINDINGS.md`（4 findings：0 critical / 1 HIGH fixed / 2 MEDIUM fixed / 1 KNOWN LIMITATION）

**npm audit**：0 production 漏洞；devDependencies 12 個 moderate+ 留 follow-up。

## Follow-up（不在本 round）

- [PLAN.md R2](./PLAN.md)：rate limit production 升級 Upstash Redis（多實例共享狀態）
- `TopDistricts.test.tsx` 的 `act()` wrap + `localhost:3000` ECONNREFUSED 警告（M1 baseline 既有，frontend round 修）
- `npm audit fix --force` 升級 devDependencies（需先跑回歸 + peer deps 驗證）
- CI 加 `npm audit --omit=dev --audit-level=high` 步驟
- CSP 進階：nonce-based + Report-Only 觀察期
- Production logging / monitoring：M1 只有 `console.warn` / `console.error`，應串 Sentry / Vercel Log Drain

## 驗收 checklist

- [x] `npm run typecheck` → exit 0
- [x] `npm test` → 107/107 passed
- [x] `npm run build` → exit 0
- [x] `git grep -E "TODO|FIXME|HACK"` → 0 hits（排除 PLAN.md / SECURITY_FINDINGS.md 自提及）
- [x] `git grep -E "(sk-|AKIA|ghp_)[A-Za-z0-9]{16,}"` → 0 hits（排除 PLAN.md / package-lock.json 假陽性）
- [x] `SECURITY_FINDINGS.md` 無 critical
- [x] 所有 `rpb-*-verify.log` 存在
- [x] README / STATUS / SOP 同步
- [x] 沒 push

## 本 round owner

- M1：devops
- M2：qa
- M3 backend：backend
- M3 security：security lead
- M4 docs：docs（本檔 owner）
- 全部由 orchestrator 在 PLAN.md 內協調
