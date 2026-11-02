import { expect, test } from "@playwright/test";
import { login, studyToday } from "./helpers";

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

test("시험 추가 → 범위 분배 → 오늘 분량 → 홈 D-day 카드에서 상세로", async ({ page }) => {
  await login(page);
  const today = await studyToday(page);
  await page.goto("exam/");
  await page.getByRole("tab", { name: "일정" }).click();
  await page.getByRole("button", { name: "일정 추가" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("이름").fill("기말고사");
  await dialog.getByLabel("시험 첫날").fill(addDays(today, 20));
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("기말고사").first()).toBeVisible();

  await page.getByRole("tab", { name: "범위 분배" }).click();
  await page.getByRole("button", { name: "범위 추가" }).click();
  const item = page.getByRole("dialog");
  await item.getByLabel("과목").selectOption({ label: "수학" });
  await item.getByLabel("이름 (교과서, 문제집, 프린트 등)").fill("문제집");
  await item.getByLabel("시작 번호").fill("1");
  await item.getByLabel("끝 번호").fill("160");
  await item.getByRole("button", { name: "저장" }).click();
  const card = page.getByRole("region", { name: "수학 범위" });
  await expect(card.getByText(/오늘 · 문제집 p\.1–\d+|오늘은 쉬는 요일이에요/)).toBeVisible();
  await expect(card.getByText("0%")).toBeVisible();

  await page.goto("");
  const dday = page.getByTestId("dday-cards").getByRole("button", { name: /기말고사/ });
  await expect(dday).toContainText("D-20");
  await dday.click();
  await expect(page).toHaveURL(/\/exam\//);
  await expect(page.getByRole("tab", { name: "범위 분배" })).toHaveAttribute("aria-selected", "true");
});
