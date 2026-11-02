import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("암기 카드: 여러 장 한 번에(틀린 줄 알림) → 외우기", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("learn/");
  await page.getByRole("tab", { name: "암기 카드" }).click();
  await page.getByRole("button", { name: "묶음 추가" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("제목").fill("영단어 Day 1");
  await d.getByLabel("과목").selectOption({ label: "영어" });
  await d.getByRole("button", { name: "저장" }).click();
  if (!["pad-landscape", "pc"].includes(testInfo.project.name)) {
    await page.getByRole("button", { name: /영단어 Day 1/ }).click();
  }
  const detail = page.getByTestId("deck-detail");
  await detail.getByRole("button", { name: "여러 장 한 번에" }).click();
  const bulk = page.getByRole("dialog", { name: "여러 장 한 번에 추가" });
  await bulk.getByRole("textbox").fill("apple | 사과\n틀린 줄\nbanana | 바나나");
  await bulk.getByRole("button", { name: "추가" }).click();
  await expect(bulk.getByText("2번째 줄의 형식을 확인해 주세요 (앞면 | 뒷면)")).toBeVisible();
  await bulk.getByRole("textbox").fill("apple | 사과\nbanana | 바나나");
  await bulk.getByRole("button", { name: "추가" }).click();
  await expect(detail.getByText("외움 0 / 2")).toBeVisible();

  await detail.getByRole("button", { name: "외우기" }).click();
  const study = page.getByRole("dialog", { name: "영단어 Day 1 외우기" });
  await expect(study.getByTestId("study-progress")).toHaveText("1 / 2");
  await study.getByRole("button", { name: "뒷면 보기" }).click();
  await study.getByRole("button", { name: "외웠음" }).click();
  await expect(study.getByTestId("study-progress")).toHaveText("2 / 2");
  await study.getByRole("button", { name: "모름" }).click();
  await expect(study.getByText("한 바퀴 다 봤어요")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail.getByText("외움 1 / 2")).toBeVisible();
});
