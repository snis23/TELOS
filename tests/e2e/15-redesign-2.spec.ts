import { expect, test } from "@playwright/test";
import { addTask, login } from "./helpers";

/** 설정 > 과목 관리에서 내신 과목 추가 */
async function addSchoolSubject(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "내신 과목 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "내신 과목 추가" });
  await dialog.getByLabel("이름").fill(name);
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("region", { name: "내신 과목" }).getByText(name)).toBeVisible();
}

test("타이머: 모의고사 | 내신 묶음을 나눠 보여 주고, 내신 순서는 ▲▼ 로 바꾼다", async ({ page }) => {
  await login(page);
  await page.goto("settings/");
  // 모의고사 과목 순서: 통합사회가 통합과학보다 앞
  const mock = page.getByRole("region", { name: "모의고사 과목" });
  await expect(mock).toContainText(/국어.*수학.*영어.*한국사.*통합사회.*통합과학/);
  await addSchoolSubject(page, "문학");
  await addSchoolSubject(page, "대수");
  const school = page.getByRole("region", { name: "내신 과목" });
  await expect(school).toContainText(/문학.*대수/);
  await school.getByRole("button", { name: "대수 위로" }).click();
  await expect(school).toContainText(/대수.*문학/);
  await expect(school.getByRole("button", { name: "대수 위로" })).toBeDisabled();

  await page.goto("");
  const timer = page.getByRole("region", { name: "과목별 타이머" });
  const chips = timer.getByRole("group", { name: "과목 고르기" });
  await expect(chips.getByRole("button", { name: /^국어/ })).toBeVisible();
  await expect(chips.getByRole("button", { name: /^문학/ })).toHaveCount(0);
  await timer.getByRole("radio", { name: "내신" }).click();
  await expect(chips.getByRole("button", { name: /^국어/ })).toHaveCount(0);
  await expect(chips).toContainText(/대수.*문학/);
  await chips.getByRole("button", { name: /^문학/ }).click();
  await expect(chips.getByRole("button", { name: /^문학/ })).toHaveAttribute("aria-pressed", "true");
  // 고른 묶음은 새로고침해도 그대로
  await page.reload();
  await expect(page.getByRole("region", { name: "과목별 타이머" }).getByRole("radio", { name: "내신" })).toHaveAttribute("aria-checked", "true");
});

test("할 일: ⋯ 메뉴로 제목·과목 수정과 삭제, 지금 카드에 보인다", async ({ page }) => {
  await login(page);
  const card = page.getByTestId("task-card");
  await addTask(page, "영단어 30개", { subject: "영어" });
  await expect(page.getByTestId("now-card").getByLabel("지금 할 일")).toContainText("영단어 30개");

  await card.getByRole("button", { name: "영단어 30개 메뉴" }).click();
  await page.getByRole("menuitem", { name: "제목·과목 수정" }).click();
  const dialog = page.getByRole("dialog", { name: "할 일 수정" });
  await dialog.getByLabel("제목").fill("영단어 50개");
  await dialog.getByLabel("과목").selectOption({ label: "국어" });
  await dialog.getByRole("button", { name: "저장" }).click();
  const item = card.getByTestId("task-item").filter({ hasText: "영단어 50개" });
  await expect(item).toContainText("국어");

  await card.getByRole("button", { name: "영단어 50개 메뉴" }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await expect(card.getByText("영단어 50개")).toBeHidden();
  await expect(page.getByText("삭제했어요")).toBeVisible();
});

test("이름: 사이트 TELOS, 메뉴 스케줄, 연속 달성일 없음", async ({ page }) => {
  await login(page);
  await expect(page).toHaveTitle(/TELOS/);
  await page.goto("record/");
  await page.getByRole("tab", { name: "공부 시간" }).click();
  await expect(page.getByText("연속 달성일")).toHaveCount(0);
  await page.goto("exam/");
  await expect(page.locator("main h1")).toHaveText("스케줄");
});
