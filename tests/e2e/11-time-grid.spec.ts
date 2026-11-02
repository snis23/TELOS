import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("11. 시간 보기에서 할 일을 10분 칸에 끌어 놓으면 시간표 보기의 해당 차시에도 보인다", async ({ page }) => {
  await login(page);
  const card = page.getByTestId("task-card");

  // 그날 첫 자습·야자 차시 (펼쳐진 줄) 의 시간을 읽는다
  await card.getByRole("radio", { name: "시간표" }).click();
  const studyRow = card.getByTestId("slot-view").locator("button[aria-expanded='true']").first();
  const text = (await studyRow.textContent()) ?? "";
  const match = text.match(/^(.*?)(\d{2}):(\d{2})–(\d{2}):(\d{2})/);
  expect(match).not.toBeNull();
  const slotName = match![1].trim();
  const startClock = Number(match![2]) * 60 + Number(match![3]);
  const endClock = Number(match![4]) * 60 + Number(match![5]);
  const length = endClock - startClock;

  // 차시보다 1시간 이른 같은 길이의 블록을 만든다
  const blockStart = startClock - 60;
  await card.getByRole("button", { name: "추가", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("제목").fill("끌어 옮길 할 일");
  await dialog.getByLabel("시간 정하기").check();
  const pad = (n: number) => String(n).padStart(2, "0");
  await dialog.getByLabel("시작 시").selectOption(String(Math.floor(blockStart / 60)));
  await dialog.getByLabel("시작 분").selectOption(String(blockStart % 60));
  const blockEnd = blockStart + length;
  await dialog.getByLabel("끝 시").selectOption(String(Math.floor(blockEnd / 60)));
  await dialog.getByLabel("끝 분").selectOption(String(blockEnd % 60));
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();

  // 시간 보기에서 블록을 1시간 뒤(차시 시작)로 끌어 놓는다
  await card.getByRole("radio", { name: "시간", exact: true }).click();
  const block = card.getByRole("button", { name: new RegExp(`^끌어 옮길 할 일 ${pad(Math.floor(blockStart / 60))}:${pad(blockStart % 60)}`) });
  await block.scrollIntoViewIfNeeded();
  const grid = card.getByRole("grid");
  const box = (await block.boundingBox())!;
  const gridBox = (await grid.boundingBox())!;
  const fromX = box.x + 3;
  const fromY = box.y + box.height / 2;
  const toX = gridBox.x + ((startClock % 60) / 60) * gridBox.width + 3;
  const toY = fromY + 44; // 한 줄 아래 = 1시간 뒤
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move((fromX + toX) / 2, (fromY + toY) / 2, { steps: 5 });
  await page.mouse.move(toX, toY, { steps: 5 });
  await page.mouse.up();
  await expect(card.getByRole("button", { name: new RegExp(`^끌어 옮길 할 일 ${match![2]}:${match![3]}–${match![4]}:${match![5]}`) })).toBeVisible();

  // 시간표 보기: 그 차시 아래에 보인다
  await card.getByRole("radio", { name: "시간표" }).click();
  const row = card.getByTestId("slot-view").locator("div.border-b", { has: page.getByRole("button", { name: new RegExp(`^${slotName}`) }) }).first();
  await expect(row.getByText("끌어 옮길 할 일")).toBeVisible();
});
