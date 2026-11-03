import { expect, test } from "@playwright/test";
import { login, studyToday } from "./helpers";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

test("시험 대비: 카테고리 만들기 → 달력에 계획 → 오늘 할 일로 가져오기 → 체크하면 진행표에 반영", async ({ page }) => {
  await login(page);
  const today = await studyToday(page);

  // 오늘 화면 맨 위: 지금 시각, 지금 일정, 지금 할 일 (명언 없음)
  const now = page.getByTestId("now-card");
  await expect(now.getByLabel("지금 시각")).toHaveText(/^\d{2}:\d{2}$/);
  await expect(now.getByLabel("지금 할 일")).toContainText("할 일이 없어요");
  await expect(page.locator("blockquote")).toHaveCount(0);

  await page.goto("exam/");
  await expect(page.getByText("시험을 추가하면 시험별 로드맵을 만들 수 있어요", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "시험 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "일정 추가" });
  await dialog.getByLabel("시험 종류").selectOption({ label: "모의고사" });
  await dialog.getByLabel("이름").fill("11월 모의고사");
  await dialog.getByLabel("시험 첫날").fill(addDays(today, 10));
  await dialog.getByRole("button", { name: "저장" }).click();

  await expect(page.getByRole("region", { name: "11월 모의고사" })).toContainText("D-10");
  const progress = page.getByRole("region", { name: "과목별 진행", exact: true });
  for (const name of ["국어", "수학", "통합사회"]) await expect(progress.getByText(name, { exact: true })).toBeVisible();

  // 달력의 오늘 칸에 계획 적기
  await page.locator(`[data-date="${today}"]`).first().click();
  const day = page.getByRole("dialog", { name: /계획$/ });
  await day.getByLabel("과목").selectOption({ label: "국어" });
  await day.getByLabel("회독 (선택)").selectOption({ label: "1회독" });
  await day.getByLabel("무슨 공부").fill("비문학 3지문");
  await day.getByRole("button", { name: "계획 추가" }).click();
  await expect(day.getByRole("button", { name: "비문학 3지문", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(`[data-date="${today}"]`).first()).toContainText("0/1");

  // 오늘 할 일로 골라 넣기 (자동으로 들어가지 않는다)
  await page.goto("");
  const card = page.getByTestId("task-card");
  await expect(card.getByText("비문학 3지문")).toHaveCount(0);
  await card.getByRole("button", { name: "로드맵에서" }).click();
  const picker = page.getByRole("dialog", { name: /로드맵에서 할 일 가져오기/ });
  await picker.getByRole("checkbox", { name: "비문학 3지문 고르기" }).click();
  await picker.getByRole("button", { name: "1개 넣기" }).click();
  await expect(card.getByText("비문학 3지문")).toBeVisible();

  // 체크하면 로드맵 칸도 끝난 것으로
  await card.getByRole("checkbox", { name: "비문학 3지문 완료" }).click();
  await expect(card.getByTestId("task-count")).toHaveText("1/1");
  await page.waitForTimeout(300); // 저장이 끝나기 전에 페이지를 옮기지 않도록
  await page.goto("plan/");
  await page.getByRole("tab", { name: "진행표" }).click();
  const board = page.getByRole("region", { name: "11월 모의고사 진행표" });
  await expect(board).toContainText("1회독 1/1");
  await expect(board.getByRole("progressbar", { name: "11월 모의고사 전체 진행률" })).toHaveAttribute("aria-valuenow", "100");

  // 기록: 시험 대비 기록과 개선점 카드
  await page.goto("record/");
  await expect(page.getByRole("region", { name: /개선이 필요한 과목/ })).toBeVisible();
  await page.getByRole("tab", { name: "시험 대비" }).click();
  await expect(page.getByRole("region", { name: "11월 모의고사" })).toContainText("로드맵 1/1칸");
});

test("새 학기 정리: 입학 연도를 정하고 내신 과목을 추가하면 배너가 사라진다", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "과목 정리" }).click();
  const dialog = page.getByRole("dialog", { name: "새 학기 내신 과목 정리" });
  await dialog.getByLabel("이번 학기 새 과목").fill("문학");
  await dialog.getByRole("button", { name: "추가", exact: true }).click();
  await dialog.getByLabel("이번 학기 새 과목").fill("대수");
  await dialog.getByRole("button", { name: "추가", exact: true }).click();
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("button", { name: "과목 정리" })).toHaveCount(0);
  await page.goto("settings/");
  const school = page.getByRole("region", { name: "내신 과목" });
  await expect(school.getByText("문학")).toBeVisible();
  await expect(school.getByText("대수")).toBeVisible();
});
