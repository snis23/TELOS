import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("4. 타이머 시작 → 과목 전환 → 쪽잠 모드(다른 기능 막힘) → 쪽잠 끝 → 이어서 하기", async ({ page }) => {
  await login(page);
  const timer = page.getByRole("region", { name: "과목별 타이머" });
  await timer.getByRole("button", { name: "타이머 시작" }).click();
  await expect(timer.getByText("측정 중")).toBeVisible();
  await expect(timer.getByTestId("timer-elapsed")).not.toHaveText("00:00:00", { timeout: 4000 });

  // 큰 시간은 그 과목의 오늘 전체 시간: 멈춰도 0으로 돌아가지 않고, 다시 켜면 이어서 쌓인다
  await timer.getByRole("button", { name: "타이머 일시정지" }).click();
  const paused = await timer.getByTestId("timer-elapsed").textContent();
  expect(paused).not.toBe("00:00:00");
  await timer.getByRole("button", { name: "타이머 시작" }).click();
  await expect(timer.getByTestId("timer-elapsed")).not.toHaveText(paused ?? "", { timeout: 4000 });
  expect((await timer.getByTestId("timer-elapsed").textContent())! > paused!).toBe(true);

  // 측정 중 과목 전환: 바로 새 기록
  await timer.getByRole("button", { name: /^수학/ }).click();
  await expect(timer.getByRole("button", { name: /^수학/ })).toHaveAttribute("aria-pressed", "true");
  await expect(timer.getByText("측정 중")).toBeVisible();

  // 쪽잠 시작: 공부 타이머가 멈추고, 쪽잠 모드 화면이 모든 것을 덮는다
  const nap = page.getByRole("region", { name: "쪽잠" });
  await nap.getByRole("button", { name: "쪽잠 시작" }).click();
  const napMode = page.getByTestId("nap-mode");
  await expect(napMode).toBeVisible();
  await expect(napMode).toHaveAttribute("data-theme", "dark");
  await expect(napMode.getByLabel("지금 시각")).toHaveText(/^\d{2}:\d{2}$/);
  await expect(napMode.getByTestId("nap-elapsed")).toHaveText(/^00:00:0\d$/);
  // 뒤의 화면은 누를 수 없고 Esc 로도 닫히지 않는다
  await expect(timer.getByTestId("timer-elapsed").click({ timeout: 1000 })).rejects.toThrow();
  await page.keyboard.press("Escape");
  await expect(napMode).toBeVisible();

  // 쪽잠 끝 → 이어서 하기
  await napMode.getByRole("button", { name: "쪽잠 끝" }).click();
  await expect(napMode).toBeHidden();
  await expect(page.getByText(/쪽잠 \d+분 기록했어요/)).toBeVisible();
  await page.getByRole("button", { name: "수학 이어서 하기" }).click();
  await expect(timer.getByRole("button", { name: "타이머 일시정지" })).toBeVisible();
  await expect(timer.getByRole("button", { name: /^수학/ })).toHaveAttribute("aria-pressed", "true");
  await expect(nap.getByText("오늘 1회")).toBeVisible();
});
