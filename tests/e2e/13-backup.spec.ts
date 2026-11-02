import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { addTask, login } from "./helpers";

test("13. 백업: JSON 내려받기 → 기록 바꾸기 → JSON 복원(확인 창) → 원래대로", async ({ page }) => {
  await login(page);
  await addTask(page, "백업 전에 있던 할 일");

  await page.goto("settings/");
  const card = page.getByRole("region", { name: "백업" });
  await expect(card.getByText("아직 백업한 적이 없어요")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "모든 기록 JSON 내려받기" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^telos-backup-\d{4}-\d{2}-\d{2}\.json$/);
  // 브라우저가 읽을 파일 경로는 영문으로 둔다 (테스트 결과 폴더 이름에는 한글이 들어간다)
  const file = join(mkdtempSync(join(tmpdir(), "telos-e2e-")), "backup.json");
  await download.saveAs(file);
  const json = JSON.parse(readFileSync(file, "utf8"));
  expect(json.app).toBe("telos");
  expect(json.tables.tasks.some((t: { title: string }) => t.title === "백업 전에 있던 할 일")).toBe(true);
  await expect(card.getByText(/마지막 백업:/)).toBeVisible();

  // 기록 바꾸기
  await page.goto("");
  await addTask(page, "백업 뒤에 만든 할 일");

  // 복원: 확인 창에 표별 행 수, 복원 직전 지금 기록을 한 번 더 내려받는다
  await page.goto("settings/");
  await expect(card.getByText(/마지막 백업:/)).toBeVisible();
  await page.getByTestId("restore-input").setInputFiles(file);
  const dialog = page.getByRole("dialog", { name: "이 백업으로 복원할까요?" });
  await expect(dialog.getByText("지금 기록이 백업 파일 내용으로 바뀌어요", { exact: false })).toBeVisible();
  await expect(dialog.getByTestId("restore-counts")).toContainText("할 일");
  const [pre] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "복원하기" }).click()]);
  expect(pre.suggestedFilename()).toMatch(/^telos-backup-/);
  await expect(page.getByText("백업 파일로 복원했어요")).toBeVisible();

  await page.goto("");
  const tasks = page.getByTestId("task-card");
  await expect(tasks.getByText("백업 전에 있던 할 일")).toBeVisible();
  await expect(tasks.getByText("백업 뒤에 만든 할 일")).toHaveCount(0);

  // 잘못된 파일은 거절
  await page.goto("settings/");
  await page.getByTestId("restore-input").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"app":"other"}') });
  await expect(page.getByText("TELOS 백업 파일이 아니에요")).toBeVisible();
});

test("백업 안내: 마지막 백업 후 30일이 지나면 오늘 화면에 보인다", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("backup-reminder")).toHaveCount(0);
  // 계정을 40일 전에 만든 것처럼 바꾼다
  await page.evaluate(() => {
    const key = "telos:fake-db:e2e";
    const db = JSON.parse(localStorage.getItem(key) ?? "{}");
    db.tables.profiles[0].created_at = new Date(Date.now() - 40 * 86400000).toISOString();
    localStorage.setItem(key, JSON.stringify(db));
  });
  await page.reload();
  await expect(page.getByTestId("backup-reminder")).toContainText("마지막 백업 후 30일이 지났어요");
  await page.getByTestId("backup-reminder").getByRole("link", { name: "백업하기" }).click();
  await expect(page).toHaveURL(/\/settings\/#backup$/);
});
