import { expect, test } from "@playwright/test";
import { addTask, login } from "./helpers";

test("5. 집중 모드 들어가기 → 할 일 체크 → 나가기 요약", async ({ page }) => {
  await login(page);
  await addTask(page, "국어 비문학 3지문", { subject: "국어" });
  await page.getByRole("link", { name: "집중 모드" }).click();
  const focus = page.getByTestId("focus-mode");
  await expect(focus).toBeVisible();
  await expect(focus).toHaveAttribute("data-theme", "dark");
  await expect(focus.getByText("국어 비문학 3지문")).toBeVisible();

  await focus.getByRole("button", { name: "타이머 시작" }).click();
  await focus.getByRole("checkbox", { name: "국어 비문학 3지문 완료" }).click();
  await expect(focus.getByText("남은 할 일이 없어요")).toBeVisible();

  await page.mouse.move(10, 10);
  await focus.getByRole("button", { name: "나가기" }).click();
  await expect(page).toHaveURL(/\/TELOS\/$/);
  await expect(page.getByText(/이번 집중 .+ · 끝낸 할 일 1개/)).toBeVisible();
});
