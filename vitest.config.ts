import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", ".vercel", "coverage"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules",
        ".next",
        ".vercel",
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
        "src/app/api/**/route.ts", // API 路由以整合測試為主
      ],
      thresholds: {
        // PRD DoD 第 6 行：Vitest 覆蓋率 ≥ 70%
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
