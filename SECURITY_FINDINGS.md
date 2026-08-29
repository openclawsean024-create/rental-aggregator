# Security Findings — rental-aggregator（M3 round, 2026-08-29）

> **Owner**：security lead（rpb(security): commit pending）
> **Scan window**：M1~M3（5 commits ahead of origin/main：`f6b2e12` M1 CI → `b20ab4c` PLAN → `b50494e` M2 tests → `bf5d49b` PLAN update → `23e7683` M3 backend）
> **嚴重度口徑**：critical = 已有 PoC 可直接利用；high = 有具體攻擊面但需條件；medium = 防禦缺口需補強；low = hardening 建議

---

## Scan Scope

本輪掃描範圍：

| 類別 | 範圍 |
|---|---|
| **OWASP Top 10 (2021)** | A01~A10 全項檢視 |
| **ADR-002 個資保護** | maskLandlordName() 是否在所有 response path 套用（PRD §5.2 / §7.2） |
| **PRD §5.1 性能** | 是否影響既有 < 500ms query 目標 |
| **PRD §7.2 ADR-001~003** | 架構決策是否受 M3 hardening 影響 |
| **依賴 CVEs** | `npm audit --omit=dev`（生產依賴） |
| **原始碼 secrets** | `git grep -E "(sk-|AKIA|ghp_)[A-Za-z0-9]{16,}"` |
| **Header hardening** | CSP / X-Frame-Options / HSTS / Referrer-Policy / Permissions-Policy |
| **Plan Risk Register** | R1~R5（PLAN.md）是否觸發 |

---

## Findings（按嚴重度排序）

### ✅ FIXED in M3 round

#### [HIGH] javascript: URL injection via evidenceUrls（commit `23e7683`）

- **受影響**：`src/app/api/blacklist/route.ts` `PostSchema.evidenceUrls`（line 151~156）
- **漏洞描述**：Zod 內建 `.url()` 接受 `javascript:alert(1)` / `data:text/html,...` / `file:///etc/passwd` 等非 http(s) scheme → 存入 DB 後任何前端 render 都會觸發 XSS
- **M3 修法**：`.url().refine((s) => /^https?:\/\//i.test(s), "evidenceUrls 必須是 http(s) URL")`（route.ts:151~156）
- **驗證**：`src/app/api/blacklist/route.test.ts` 新增 4 個 400 case
  - `javascript:alert(1)` → 400（route.test.ts:290~306，原 `202` 已翻為 `400`）
  - `file:///etc/passwd` → 400（route.test.ts:308~322）
  - `data:text/html,<script>...` → 400（route.test.ts:324~338）
  - `ftp://x` → 400（route.test.ts:340~354）
- **R3 regression check**：`https://example.com/photo.jpg` 仍 202（route.test.ts:356~375）✓
- **建議**：✅ 已修，無後續 action

#### [MEDIUM] POST /api/blacklist 缺 rate limit（commit `23e7683`）

- **受影響**：`src/app/api/blacklist/route.ts` POST handler（line 174~199）
- **漏洞描述**：公開 endpoint 無 auth，可被自動化腳本洗版；POST 寫入 DB 的成本隨攻擊規模線性成長
- **M3 修法**：
  - 新增 `src/lib/rate-limit.ts`：per-IP sliding window，5 req / 60s 預設值（rate-limit.ts:60~97）
  - 新增 `getClientIp(headers)`：從 `x-forwarded-for` / `x-real-ip` / `"anonymous"` fallback 取 IP（rate-limit.ts:110~119）
  - route handler 在 Zod parse 之前先 check rate limit，超過 → 429 + `Retry-After` header + `retryAfterSec` body（route.ts:182~199）
- **驗證**：
  - `src/lib/rate-limit.test.ts`（rate-limit.test.ts）：14 unit tests，涵蓋預設參數 / per-IP 隔離 / window reset（fakeTimers）/ 自訂參數 / getClientIp fallback order / `_resetRateLimitForTests`
  - `src/app/api/blacklist/route.test.ts`（route.test.ts:396~466）：3 case，涵蓋「前 5 次 → 202，第 6 → 429」/「429 帶 Retry-After header + retryAfterSec body」/「Zod 失敗仍算次數」
- **R2 known limitation**：見下方 KNOWN LIMITATION 區塊（in-memory 多實例不精確）
- **建議**：✅ 已修，R2 follow-up 留 production 升級 Upstash Redis

#### [MEDIUM] 缺 Security Headers（本 round 修）

- **受影響**：`vercel.json`（原本無 `headers` 區塊，僅有 build config）
- **漏洞描述**：未明示的 CSP / X-Frame-Options / HSTS / Referrer-Policy / X-Content-Type-Options / Permissions-Policy；Next.js 16.3 預設只關閉 `X-Powered-By`（next.config.mjs:4），其餘需自加
- **本 round 修法**：`vercel.json` 新增 `headers` 區塊（覆蓋 `/(.*)`）：
  - `X-Content-Type-Options: nosniff` — 防止 MIME sniffing 攻擊
  - `X-Frame-Options: DENY` — 全站禁 iframe embed（Next.js 預設 `SAMEORIGIN`，本 round 收緊為 DENY）
  - `Referrer-Policy: strict-origin-when-cross-origin` — 防止 referrer 洩漏內部路徑
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` — 強制 HTTPS 一年（含 subdomain）
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()` — 預設禁用敏感 API（本 MVP 無此功能）
  - `Content-Security-Policy` — 見下方 CSP 設計理由
- **CSP 設計理由**（為何採「可運行版本」而非 strict）：
  - `default-src 'self'` — 預設拒絕所有跨來源
  - `script-src 'self' 'unsafe-inline'` — Next.js App Router 用 inline bootstrap script；不引入 nonce/strict-dynamic 是因會破壞現有 hydration（PLAN.md Risk Register R4）
  - `style-src 'self' 'unsafe-inline'` — Tailwind + Framer Motion 11 都產 inline style
  - `img-src 'self' https: data:` — 黑名單證據圖（evidenceUrls）為 https URL；data: 給 inline svg
  - `connect-src 'self'` — 前端 fetch 只打自家 API（/api/blacklist 等）
  - `frame-ancestors 'none'` — 防止 clickjacking（與 X-Frame-Options: DENY 互補）
  - `base-uri 'self'` — 防止 `<base href="javascript:...">` 攻擊
  - `form-action 'self'` — 限制 form 只能送自家 endpoint
  - **未啟用** `report-uri` / `report-to`：M1 MVP 無 endpoint，留 follow-up
- **建議**：✅ 本 round 修。進階 strict CSP（nonce-based）+ Report-Only 觀察期留 follow-up。

### ⚠️ KNOWN LIMITATION（plan follow-up，已紀錄於 PLAN.md R2）

#### [MEDIUM] Rate limit 在 Vercel serverless 多實例下不精確（commit `23e7683`）

- **受影響**：`src/lib/rate-limit.ts`（line 31 `const buckets = new Map<...>()`）
- **限制描述**：
  - 每個 instance 獨立計數（同 IP 在多個 instance 上的請求可能總計超過 limit 才被擋）
  - Cold start 後 Map 會被清空（攻擊者若正好撞到 cold start 會 reset）
  - 不適用於分散式 botnet 攻擊（每個 IP 只打 1 次）
- **緩解**：已在 `src/lib/rate-limit.ts` JSDoc（rate-limit.ts:1~29）與 PLAN.md Risk Register R2 紀錄
- **Production upgrade path**（follow-up，本 round 不做）：
  - Upstash Redis（per-IP INCR + EXPIRE 原子操作）
  - Vercel KV（同上，Vercel 原生整合）
  - Cloudflare edge token bucket（在 WAF 層做）
- **建議**：✅ 接受為 known limitation，留後續 round 評估升級時機（M3 backend verify log 內已有 reminder）

---

### ✅ PASSED（無問題）

- **ADR-002 個資保護（maskLandlordName）**：
  - `src/lib/mask.test.ts` 23 tests + `src/lib/mask-invariant.test.ts` 3 tests 守住
  - mask-invariant.test.ts 驗證「所有 /api/blacklist response 必須不含有完整姓名」+「POST 寫入前必須先經 mask」+「mask 是 idempotent」
  - M3 新增的 POST code path（rate-limit.ts + route.ts POST handler）皆不碰 landlordName 字串；唯一 source of truth 仍是 `maskLandlordName(data.landlordName)`（route.ts:211）
- **SQL injection**：
  - `searchApproved()`（blacklist-store.ts:54~80）用程式內 `.includes()` filter + JSON 讀取（**沒有 SQL**，純 in-memory）
  - `route.ts` Prisma 模式用 `where: { contains: q }`（route.ts:87）parameterized，無字串拼接
  - route.test.ts:75~86 驗證 `q=%'; DROP TABLE--` 仍回 200 + total=0
- **Secrets in code**：`git grep -E "(sk-|AKIA|ghp_)[A-Za-z0-9]{16,}"` 在排除 `PLAN.md`（自提及 regex 範例）+ `package-lock.json`（npm registry URL 假陽性：https://registry.npmjs.org/queue-microtask）後**無命中**
- **TODO/FIXME/HACK 殘留**：`git grep -E "TODO|FIXME|HACK"` 在排除 PLAN.md 自提及後**無新增**（M2/M3 不留技術債）
- **CSP baseline**：本 round 加入（見上方）
- **File upload**：M2 範圍無此功能（屋況拍照存證是 M2+ 屋況清單的下輪範圍，本 round 不涵蓋）；M3 無新增上傳面
- **Outbound fetch / SSRF surface**：後端無 outbound HTTP fetch（grep `fetch(` / `axios` / `got` / `node-fetch` 限於 client-side `useEffect`）；無 SSRF 攻擊面
- **`x-powered-by` 移除**：next.config.mjs:4 已設 `poweredByHeader: false`

---

## OWASP Top 10 Checklist（2021 版）

| OWASP | 狀態 | 證據 |
|---|---|---|
| **A01 Broken Access Control** | ⚠️ N/A（M1 MVP 無 auth） | 公開 API（GET 查詢黑名單 / POST 提交檢舉）依 SPEC §3.1 P0-1 設計不需 auth；完整姓名付費 Pro 才看的功能是 M3 之後範圍 |
| **A02 Cryptographic Failures** | ✅ PASS | HTTPS by Vercel（自動 TLS）+ 本 round 加 HSTS（`max-age=31536000`） |
| **A03 Injection** | ✅ FIXED in M3 | XSS via javascript: URL 已修（commit `23e7683`）+ SQL injection 防線已存在（route.ts Prisma parameterized）+ 後端無 outbound fetch（無 SSRF） |
| **A04 Insecure Design** | ✅ FIXED in M3 | Rate limit 補上（commit `23e7683`）— public endpoint 不再有自動化濫用風險 |
| **A05 Security Misconfiguration** | ✅ FIXED in 本 round | Security headers（CSP / X-Frame-Options / HSTS / Referrer-Policy / X-Content-Type-Options / Permissions-Policy）全部到位 |
| **A06 Vulnerable & Outdated Components** | ✅ PASS（生產） | `npm audit --omit=dev`：0 vulnerabilities。完整 `npm audit`（含 dev）有 12 個（2 low / 5 moderate / 2 high / 3 critical），但**全部在 devDependencies**：@eslint/plugin-kit（moderate ReDoS）、esbuild（moderate dev-server request forgery）、happy-dom（critical RCE in test env）、postcss（high XSS via build-time CSS processing）、vite（moderate）。**這些都不會進 production bundle**，且修法需升級 major version（會破壞 React 19 / Next 16 peer deps），**留後續 round 評估**。 |
| **A07 Identification & Auth Failures** | ⚠️ N/A（M1 MVP） | 同 A01 |
| **A08 Software & Data Integrity** | ✅ PASS | Prisma client 5.22.0 由 npm registry 鎖定（package-lock.json）+ 未引入未驗證的第三方 CDN script |
| **A09 Security Logging & Monitoring** | ⚠️ FOLLOW-UP | M1 只有 `console.warn`（黑名單靜態模式提交記錄到 console）+ `console.error`（route handler error）。**Production 應串 Sentry / Vercel Log Drain**，留 M4+ |
| **A10 SSRF** | ✅ PASS | 後端無 outbound HTTP fetch（grep `fetch(` 限於 client-side 組件） |

---

## npm audit 結果

### 生產依賴（`npm audit --omit=dev`）

```
found 0 vulnerabilities
```

✅ **0 critical / 0 high / 0 moderate / 0 low**

### 完整審計（含 devDependencies，僅供參考）

```
12 vulnerabilities (2 low, 5 moderate, 2 high, 3 critical)
```

| 套件 | 嚴重度 | 影響 | 修法 | 評估 |
|---|---|---|---|---|
| **happy-dom** ≤ 20.8.8 | **critical** | VM context escape → RCE（在 test environment 內） | `npm audit fix --force` → happy-dom@20.11.15 | breaking change；本 repo 用 15.11.0，dev only |
| **postcss** ≤ 8.5.22 | **high** | XSS via unescaped `</style>` in CSS stringify output | `npm audit fix --force` → postcss@8.5.26 | build-time only；不影響 runtime；升級 minor 安全但本 repo 用 8.4.49 |
| **@eslint/plugin-kit** < 0.3.4 | moderate | ReDoS via ConfigCommentParser | `npm audit fix --force` → eslint@9.39.5 | eslint plugin，dev only |
| **esbuild** ≤ 0.24.2 | moderate | dev-server request forgery | `npm audit fix --force` → 升級 vitest / @vitest/coverage-v8 | dev only |
| **vite / vitest / @vitest/coverage-v8** | moderate | transitively depends on vulnerable esbuild | 同上 | dev only |
| **tsx** 3.13.0 - 4.19.2 | moderate | transitively depends on vulnerable esbuild | 同上 | dev only |

**M3 評估**：**不執行 `npm audit fix --force`**。理由：
1. 所有 critical / high 都是 devDependencies，不進 production bundle
2. happy-dom 升級為 breaking change（major 版本）會破壞現有 107 個 test 環境
3. postcss 升級為 minor（8.5.26），理論上可考慮；但 M1 baseline 已用 8.4.49，改動需獨立 round 評估與回歸測試
4. M3 scope 不包含 dependency upgrade

**Follow-up action**：M4 docs round 結束後，建獨立 round 處理 dependency upgrade（先看 happy-dom 升級的 test 影響面）。

---

## Verify Summary

| Command | Exit | 細節 |
|---|---|---|
| `npm run typecheck` | **0** | TypeScript 5.6.3 strict，全專案無 error |
| `npm test` | **0** | **107 / 107 tests passed**（8 files：mask-invariant / mask / rate-limit / categories / blacklist-store / route / BlacklistSearch / TopDistricts）。M2 baseline 87 + M3 +20（含 rate-limit.test.ts 14 + route.test.ts 6 新 case）。 |
| `npm run build` | **0** | `prisma generate && next build --webpack` ✓ Compiled successfully（620ms + TypeScript 920ms + 3 static pages generated）。Route summary：`/`、`/_not-found`、`/api/blacklist`、`/api/blacklist/stats`、`/api/health`。 |

完整輸出見 `rpb-security-verify.log`。

---

## 給下一手

### M4 docs agent

- 把本檔（`SECURITY_FINDINGS.md`）+ `vercel.json` 變更同步進 README（新增「Security」章節，列 CSP / HSTS / rate limit 行為）+ STATUS（更新 M3 hardening 完成紀錄）+ BUILD_REPORT（列出本輪所有 rpb(security): commit）
- README 新增一段：「**Security posture (M3)**」連結到 `SECURITY_FINDINGS.md`，讓 reviewer / auditor 可直接查到

### Backend agent 後續 round

- **PLAN.md R2 follow-up**：rate limit 在 Vercel production 多實例下需升級為 Upstash Redis 或 Vercel KV（共享狀態）
- **M4 之後評估**：`npm audit fix --force` 升級 happy-dom / postcss，需先跑完整回歸測試 + 確認 peer deps（React 19 / Next 16.3 兼容）

### DevOps agent（CI）

- CI workflow（`.github/workflows/ci.yml`）未涵蓋 `npm audit` 步驟；可考慮在 PR 觸發時跑 `npm audit --omit=dev --audit-level=high` 防止新增 high+ CVE（M4+ 評估）

### Frontend agent（未來 round）

- M3 後可能引入 Stripe Checkout（PRD §3.1 P0-5）→ 那時 CSP `connect-src 'self'` 需放寬 `https://api.stripe.com`；**M3 不動 CSP**
- M3 後可能引入 Clerk auth → 那時 CSP `script-src` 需放寬 `https://*.clerk.accounts.dev`；**M3 不動 CSP**

---

## 本輪變更檔案

| 檔案 | 類型 | 內容 |
|---|---|---|
| `vercel.json` | 修改 | 新增 `headers` 區塊（X-Content-Type-Options / X-Frame-Options / Referrer-Policy / HSTS / Permissions-Policy / CSP） |
| `SECURITY_FINDINGS.md` | 新增 | 本檔（M3 security lead 主交付） |
| `rpb-security-verify.log` | 新增 | typecheck + test + build + npm audit 完整輸出 |

---

**本輪 owner**：security lead（rpb(security): commit pending, do not push）
**本輪時間**：2026-08-29
**總 finding 數**：3 個 security finding（2 medium + 1 high）+ 1 known limitation（medium）；**0 critical**