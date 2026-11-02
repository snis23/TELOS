import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("과목 추가 → 중복 검사 → 삭제 → 되돌리기", async ({ page }) => {
  await login(page);
  await page.goto("settings/");
  await page.getByRole("button", { name: "과목 추가" }).click();
  await page.getByLabel("이름").fill("국어");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("이미 있는 과목 이름이에요")).toBeVisible();
  await page.getByLabel("이름").fill("화학Ⅰ");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("화학Ⅰ")).toBeVisible();

  await page.getByRole("button", { name: "화학Ⅰ 수정" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("삭제했어요")).toBeVisible();
  await expect(page.getByText("화학Ⅰ")).toBeHidden();
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByText("화학Ⅰ")).toBeVisible();
});
