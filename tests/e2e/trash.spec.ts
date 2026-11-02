import { expect, test } from "@playwright/test";
import { addTask, login } from "./helpers";

test("휴지통: 할 일 삭제 → 휴지통에 남은 기간과 함께 보임 → 복원", async ({ page }) => {
  await login(page);
  await addTask(page, "지울 할 일");
  const card = page.getByTestId("task-card");
  await card.getByRole("button", { name: "지울 할 일", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("삭제했어요")).toBeVisible();
  await expect(card.getByText("지울 할 일")).toHaveCount(0);

  await page.goto("settings/");
  const trash = page.getByRole("region", { name: "휴지통" });
  await expect(trash.getByText("지울 할 일")).toBeVisible();
  await expect(trash.getByText("7일 뒤 완전히 삭제")).toBeVisible();
  await trash.getByRole("button", { name: "복원" }).click();
  await expect(trash.getByText("휴지통이 비어 있어요")).toBeVisible();

  await page.goto("");
  await expect(card.getByText("지울 할 일")).toBeVisible();
});
