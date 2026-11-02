import { expect, test } from "@playwright/test";
import { addTask, login, seedRows, studyToday } from "./helpers";

test("2. 할 일 추가 → 체크 → 진행률 변화", async ({ page }) => {
  await login(page);
  const card = page.getByTestId("task-card");
  await addTask(page, "수학 문제집 3장", { subject: "수학" });
  await addTask(page, "영단어 50개");
  await expect(card.getByTestId("task-count")).toHaveText("0/2");
  await expect(page.locator("main h1")).toHaveText("오늘 할 일 2개 남았어요");

  await card.getByRole("checkbox", { name: "수학 문제집 3장 완료" }).click();
  await expect(card.getByTestId("task-count")).toHaveText("1/2");
  await expect(card.getByRole("progressbar", { name: "할 일 진행률" })).toHaveAttribute("aria-valuenow", "50");

  await card.getByRole("checkbox", { name: "영단어 50개 완료" }).click();
  await expect(card.getByRole("progressbar", { name: "할 일 진행률" })).toHaveAttribute("aria-valuenow", "100");
  await expect(page.locator("main h1")).toHaveText("오늘 할 일을 모두 끝냈어요");

  // 끝낸 항목은 취소선 + 맨 아래
  await expect(card.getByRole("button", { name: "영단어 50개", exact: true })).toHaveClass(/line-through/);
});

test("3. 한 번에 넘기기 → 되돌리기. 3번 미룬 할 일은 맨 위 + 버튼 3개", async ({ page }) => {
  await login(page);
  const card = page.getByTestId("task-card");
  await addTask(page, "첫째 할 일");
  await addTask(page, "둘째 할 일");

  await card.getByRole("button", { name: "못 한 일 2개 내일로 넘기기" }).click();
  await expect(page.getByText("2개를 내일로 넘겼어요")).toBeVisible();
  await expect(card.getByText("첫째 할 일")).toBeHidden();
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(card.getByText("첫째 할 일")).toBeVisible();
  await expect(card.getByText("둘째 할 일")).toBeVisible();

  const today = await studyToday(page);
  await seedRows(page, "tasks", [
    { title: "세 번 미룬 일", study_date: today, sort_order: 99, deferred_count: 3, source: "manual", done_at: null, must_do: false, missed_streak: 0 },
  ]);
  const items = card.getByTestId("task-item");
  await expect(items.first()).toContainText("세 번 미룬 일");
  await expect(items.first()).toContainText("3번 미룸");
  await expect(items.first()).toHaveAttribute("data-defer-level", "3");
  for (const name of ["오늘 꼭 하기", "쪼개기", "삭제"]) {
    await expect(items.first().getByRole("button", { name, exact: true })).toBeVisible();
  }
  // 오늘 꼭 하기: 넘기기 대상에서 빠진다
  await items.first().getByRole("button", { name: "오늘 꼭 하기" }).click();
  await expect(card.getByRole("button", { name: "못 한 일 2개 내일로 넘기기" })).toBeVisible();
});
