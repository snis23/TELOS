import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("8. 모의고사 입력 → 그래프 지표 전환 → 영어 백분위 안내", async ({ page }) => {
  await login(page);
  await page.goto("grade/");
  await page.getByRole("tab", { name: "모의고사" }).click();
  await page.getByRole("button", { name: "회차 추가" }).click();
  const d = page.getByRole("dialog", { name: "새 회차" });
  await d.getByLabel("연도").selectOption("2026");
  await d.getByLabel("월").selectOption("10");
  await expect(d.getByLabel("이름")).toHaveValue("2026년 10월 모의고사");
  await d.getByRole("button", { name: "저장" }).click();

  await page.getByRole("button", { name: "점수 입력" }).click();
  const t = page.getByTestId("mock-table");
  await t.getByLabel("국어 원점수").fill("88");
  await t.getByLabel("국어 백분위").fill("92");
  await t.getByLabel("국어 등급").fill("2");
  await t.getByLabel("영어 원점수").fill("85");
  await t.getByLabel("영어 등급").fill("2");
  // 영어·한국사는 백분위 입력칸이 없다
  await expect(t.getByLabel("영어 백분위")).toHaveCount(0);
  await expect(t.getByLabel("한국사 백분위")).toHaveCount(0);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(t).toBeHidden();

  const chart = page.getByRole("region", { name: "모의고사 그래프" });
  await expect(chart.getByRole("figure", { name: "모의고사 원점수" })).toBeVisible();
  await chart.getByRole("radio", { name: "등급" }).click();
  await expect(chart.getByRole("figure", { name: "모의고사 등급" })).toBeVisible();

  await chart.getByRole("button", { name: "영어" }).click();
  await chart.getByRole("radio", { name: "백분위" }).click();
  await expect(chart.getByTestId("no-percentile")).toHaveText("영어: 절대평가라 백분위가 없어요");
});
