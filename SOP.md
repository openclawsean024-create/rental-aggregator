# SOP — 開發流程 / 部署流程

## 開發紀律

1. 每完成一個 P0 功能 → `git commit` (conventional commits)
2. 每個 commit 後 → `bash ../sync-3way.sh rental-aggregator`（dry-run 預設）
3. 階段結束 → push → `bash ../sync-3way.sh rental-aggregator --push`

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
