import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("모의고사 과목은 고정, 내신 과목 추가 → 중복 검사 → 보관·풀기 → 삭제 → 되돌리기", async ({ page }) => {
  await login(page);
  await page.goto("settings/");
  const manager = page.getByRole("region", { name: "과목 관리" });

  // 모의고사 과목 6개, 이름은 바꿀 수 없다
  const mock = manager.getByRole("region", { name: "모의고사 과목" });
  for (const name of ["국어", "수학", "영어", "한국사", "통합과학", "통합사회"]) await expect(mock.getByText(name, { exact: true })).toBeVisible();
  await mock.getByRole("button", { name: "국어 수정" }).click();
  await expect(page.getByRole("dialog").getByLabel("이름")).toBeDisabled();
  await expect(page.getByRole("dialog").getByRole("button", { name: "삭제" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // 내신 과목 추가와 중복 검사 (모의고사 "국어" 와 같은 이름은 내신에서 쓸 수 있다)
  const school = manager.getByRole("region", { name: "내신 과목" });
  await page.getByRole("button", { name: "내신 과목 추가" }).click();
  await page.getByLabel("이름").fill("화학Ⅰ");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(school.getByText("화학Ⅰ")).toBeVisible();
  await page.getByRole("button", { name: "내신 과목 추가" }).click();
  await page.getByLabel("이름").fill("화학Ⅰ");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("이미 있는 과목 이름이에요")).toBeVisible();
  await page.keyboard.press("Escape");

  // 보관하면 내신 목록에서 빠지고 보관한 과목에 남는다
  await school.getByRole("button", { name: "화학Ⅰ 보관" }).click();
  await expect(school.getByText("화학Ⅰ")).toBeHidden();
  await page.getByRole("button", { name: /보관한 과목 1개/ }).click();
  const archived = manager.getByRole("region", { name: "보관한 과목" });
  await expect(archived.getByText("화학Ⅰ")).toBeVisible();
  await archived.getByRole("button", { name: "화학Ⅰ 보관 풀기" }).click();
  await expect(school.getByText("화학Ⅰ")).toBeVisible();

  // 삭제와 되돌리기
  await school.getByRole("button", { name: "화학Ⅰ 수정" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("삭제했어요")).toBeVisible();
  await expect(school.getByText("화학Ⅰ")).toBeHidden();
  await expect(page.getByRole("region", { name: "휴지통" }).getByText("화학Ⅰ")).toBeVisible();
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(school.getByText("화학Ⅰ")).toBeVisible();
});
