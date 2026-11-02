import { expect, type Page, type TestInfo } from "@playwright/test";

export const EMAIL = "demo@telos.local";
export const PASSWORD = "telos1234";

/** 로그인하고 오늘 화면까지 */
export async function login(page: Page) {
  await page.goto("login/");
  await page.getByLabel("이메일").fill(EMAIL);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/TELOS\/$/);
  await expect(page.locator("main h1")).toBeVisible();
}

export function isPc(testInfo: TestInfo) {
  return testInfo.project.name === "pc";
}

export function usesSidebar(testInfo: TestInfo) {
  return testInfo.project.name === "pc" || testInfo.project.name === "pad-landscape";
}

/** 가로 스크롤이 생기지 않는지 */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
