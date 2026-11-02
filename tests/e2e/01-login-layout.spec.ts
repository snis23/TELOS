import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, login, usesSidebar } from "./helpers";

test("1. 로그인 → 오늘 화면, 크기별로 맞는 메뉴가 보인다", async ({ page }, testInfo) => {
  await page.goto("");
  await expect(page).toHaveURL(/\/login\/$/);

  // 틀린 비밀번호
  await page.getByLabel("이메일").fill("demo@telos.local");
  await page.getByLabel("비밀번호").fill("wrong");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("이메일이나 비밀번호가 맞지 않아요")).toBeVisible();

  await login(page);
  const sidebar = page.locator("aside[aria-label='메뉴']");
  const tabs = page.locator("nav.tabbar");
  if (usesSidebar(testInfo)) {
    await expect(sidebar).toBeVisible();
    await expect(tabs).toBeHidden();
  } else {
    await expect(tabs).toBeVisible();
    await expect(sidebar).toBeHidden();
    // 더보기 시트
    await tabs.getByRole("button", { name: "더보기" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "설정" }).click();
    await expect(page).toHaveURL(/\/settings\/$/);
  }

  // 로그인 상태 유지
  await page.reload();
  await expect(page.locator("main h1")).toBeVisible();
});

test("9. 다크 모드 전환 → 새로고침 후 색 깜빡임 없음", async ({ page }) => {
  await login(page);
  await page.goto("settings/");
  await page.getByRole("radio", { name: "다크" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // 새로고침할 때 html 의 data-theme 이 한 번이라도 light 가 되는지 기록한다
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __themes: string[] }).__themes = seen;
    // 문서가 만들어지기 전이라 document 전체를 지켜본다
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.target === document.documentElement) seen.push(document.documentElement.getAttribute("data-theme") ?? "none");
      }
    }).observe(document, { attributes: true, attributeFilter: ["data-theme"], subtree: true });
    document.addEventListener("DOMContentLoaded", () =>
      seen.push(`loaded:${document.documentElement.getAttribute("data-theme") ?? "none"}`),
    );
  });
  await page.reload();
  await expect(page.locator("main h1")).toBeVisible();
  const themes = await page.evaluate(() => (window as unknown as { __themes: string[] }).__themes);
  expect(themes).toContain("loaded:dark");
  expect(themes.filter((t) => t.includes("light"))).toEqual([]);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("10. 가로 스크롤 없음 (오늘, 설정)", async ({ page }) => {
  await login(page);
  await expectNoHorizontalScroll(page);
  await page.goto("settings/");
  await expect(page.getByText("과목 관리")).toBeVisible();
  await expectNoHorizontalScroll(page);
});
