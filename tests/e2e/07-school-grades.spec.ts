import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("7. 내신 입력 → 등급 자동 계산 → 계산기 평균", async ({ page }) => {
  await login(page);
  await page.goto("grade/");
  await page.getByRole("tab", { name: "내신", exact: true }).click();
  const table = page.getByTestId("grade-table");

  // 국어: 석차 9, 동석차 3, 수강자 100 → 중간석차 10 → 10% → 1등급
  await table.getByLabel("국어 학점").fill("4");
  await table.getByLabel("국어 원점수").fill("92.5");
  await table.getByLabel("국어 석차").fill("9");
  await table.getByLabel("국어 동석차").fill("3");
  await table.getByLabel("국어 수강자").fill("100");
  await expect(table.getByTestId("grade-국어").locator("option").first()).toHaveText("1 (자동)");

  // 수학: 석차 30 / 100 → 30% → 2등급
  await table.getByLabel("수학 학점").fill("3");
  await table.getByLabel("수학 원점수").fill("80");
  await table.getByLabel("수학 석차").fill("30");
  await table.getByLabel("수학 수강자").fill("100");
  await expect(table.getByTestId("grade-수학").locator("option").first()).toHaveText("2 (자동)");

  // 잘못된 값은 입력칸 아래에 이유
  await table.getByLabel("영어 학점").fill("9");
  await table.getByLabel("영어 원점수").fill("70");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(table.getByText("1~8")).toBeVisible();
  await table.getByLabel("영어 학점").fill("");
  await table.getByLabel("영어 원점수").fill("");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("저장했어요")).toBeVisible();

  // 계산기: (4×1 + 3×2) ÷ 7 = 1.43
  await page.getByRole("tab", { name: "내신 계산기" }).click();
  await expect(page.getByTestId("calc-total")).toHaveText("1.43");
  // 수학을 빼면 1.00
  await page.getByRole("group", { name: "과목 고르기" }).getByText("수학").click();
  await expect(page.getByTestId("calc-total")).toHaveText("1.00");
});
