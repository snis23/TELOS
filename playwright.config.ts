import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";

/**
 * E2E (10.3): 화면 크기 4가지에서 실행한다. 개발용 가짜 백엔드("e2e")로 빌드한 정적 사이트를 쓴다.
 * 테스트마다 새 브라우저 저장소에서 시작하므로 서로 영향을 주지 않는다.
 */
const PORT = 4173;
const PREINSTALLED = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${PORT}/TELOS/`,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `NEXT_PUBLIC_TELOS_FAKE_BACKEND=e2e npm run build && node scripts/serve-out.mjs ${PORT}`,
    url: `http://localhost:${PORT}/TELOS/login/`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  projects: (
    [
      { name: "phone", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
      { name: "pad-portrait", use: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true } },
      { name: "pad-landscape", use: { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true } },
      { name: "pc", use: { viewport: { width: 1440, height: 900 } } },
    ] satisfies NonNullable<PlaywrightTestConfig["projects"]>
  ).map((p) => ({
    ...p,
    use: {
      ...p.use,
      // 이 개발 환경에는 브라우저가 미리 설치되어 있다. CI 는 playwright install 로 받는다.
      launchOptions: process.env.CI ? {} : { executablePath: PREINSTALLED },
    },
  })),
});
