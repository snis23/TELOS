import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("4. 타이머 시작 → 과목 전환 → 쪽잠 시작 → 쪽잠 끝 → 이어서 하기", async ({ page }) => {
  await login(page);
  const timer = page.getByRole("region", { name: "과목별 타이머" });
  await timer.getByRole("button", { name: "타이머 시작" }).click();
  await expect(timer.getByText("측정 중")).toBeVisible();
  await expect(timer.getByTestId("timer-elapsed")).not.toHaveText("00:00:00", { timeout: 4000 });

  // 측정 중 과목 전환: 바로 새 기록
  await timer.getByRole("button", { name: /^수학/ }).click();
  await expect(timer.getByRole("button", { name: /^수학/ })).toHaveAttribute("aria-pressed", "true");
  await expect(timer.getByText("측정 중")).toBeVisible();

  // 쪽잠 시작: 공부 타이머 멈춤
  const nap = page.getByRole("region", { name: "쪽잠" });
  await nap.getByRole("button", { name: "쪽잠 시작" }).click();
  await expect(nap.getByText("측정 중 · 공부 타이머 멈춤")).toBeVisible();
  await expect(timer.getByRole("button", { name: "타이머 시작" })).toBeVisible();

  // 쪽잠 끝 → 이어서 하기
  await nap.getByRole("button", { name: "쪽잠 끝" }).click();
  await expect(page.getByText(/쪽잠 \d+분 기록했어요/)).toBeVisible();
  await page.getByRole("button", { name: "수학 이어서 하기" }).click();
  await expect(timer.getByRole("button", { name: "타이머 일시정지" })).toBeVisible();
  await expect(timer.getByRole("button", { name: /^수학/ })).toHaveAttribute("aria-pressed", "true");
  await expect(nap.getByText("오늘 1회")).toBeVisible();
});
