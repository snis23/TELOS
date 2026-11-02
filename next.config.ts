import type { NextConfig } from "next";

// GitHub Pages(https://<아이디>.github.io/TELOS/)에 정적 사이트로 올린다.
const BASE_PATH = "/TELOS";

/** 개발 데모·E2E 전용 가짜 백엔드 ("demo" | "e2e"). 비어 있으면 빈 대체 파일로 바꿔 배포 빌드에서 뺀다. */
const FAKE_BACKEND = process.env.NEXT_PUBLIC_TELOS_FAKE_BACKEND ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_TELOS_FAKE_BACKEND: FAKE_BACKEND,
  },
  turbopack: {
    resolveAlias: {
      "@telos/fake-backend": FAKE_BACKEND ? "./src/lib/supabase/fake/entry.ts" : "./src/lib/supabase/fake-disabled.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
