import { expect, test } from "@playwright/test";
import { isPc, login } from "./helpers";

test("12. PC 단축키 표는 선택·클릭이 안 되고, 단축키가 동작한다", async ({ page }, testInfo) => {
  await login(page);
  const table = page.getByTestId("shortcut-table");
  if (!isPc(testInfo)) {
    await expect(table).toBeHidden();
    return;
  }
  await expect(table).toBeVisible();
  const style = await table.evaluate((el) => {
    const s = getComputedStyle(el);
    return { userSelect: s.userSelect, pointerEvents: s.pointerEvents, cursor: s.cursor };
  });
  expect(style).toEqual({ userSelect: "none", pointerEvents: "none", cursor: "default" });
  // 탭 이동에서 빠진다: 안에 포커스 받을 요소가 없다
  expect(await table.locator("a, button, [tabindex]").count()).toBe(0);

  // Alt+2 → 계획, Shift+T → 다크 모드
  await page.keyboard.press("Alt+Digit2");
  await expect(page).toHaveURL(/\/plan\/$/);
  const before = await page.locator("html").getAttribute("data-theme");
  await page.keyboard.press("Shift+KeyT");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", before ?? "");
});

test("입력칸에 쓰는 중에는 단축키가 동작하지 않는다", async ({ page }) => {
  await login(page);
  await page.goto("settings/");
  await page.getByRole("button", { name: "과목 추가" }).click();
  const before = await page.locator("html").getAttribute("data-theme");
  await page.getByLabel("이름").press("Shift+KeyT");
  await expect(page.locator("html")).toHaveAttribute("data-theme", before ?? "");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
