import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/** 1×1 PNG 대신 조금 큰 PNG 를 만들어 사진으로 쓴다 */
async function pngBuffer(page: import("@playwright/test").Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 300;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = "black";
    ctx.fillText("오답", 50, 50);
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(base64, "base64");
}

test("6. 오답 추가(사진) → 해결 표시 → 거르기. 과목 추가와 숨기기", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("learn/");
  await page.getByRole("tab", { name: "오답노트" }).click();
  await expect(page.getByText("아직 기록한 오답이 없어요")).toBeVisible();

  // 사진으로 추가
  const png = await pngBuffer(page);
  await page.getByTestId("note-file-input").setInputFiles({ name: "note.png", mimeType: "image/png", buffer: png });
  const dialog = page.getByRole("dialog", { name: "오답 추가" });
  await expect(dialog.getByText("1/5")).toBeVisible();
  await dialog.getByLabel("단원").selectOption({ label: "+ 새 단원" });
  const unitDialog = page.getByRole("dialog", { name: "새 단원" });
  await unitDialog.getByLabel("단원 이름").fill("지수");
  await unitDialog.getByRole("button", { name: "저장" }).click();
  await dialog.getByLabel("출처 (예: 문제집 p.91 12번)").fill("문제집 p.91 12번");
  await dialog.getByRole("radio", { name: "개념 부족" }).click();
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();

  const item = page.getByTestId("note-item").filter({ hasText: "문제집 p.91 12번" });
  await expect(item).toContainText("다시 풀기");
  await expect(page.getByText("지수 단원 ·")).toBeVisible();
  await expect(page.getByTestId("note-unsolved")).toHaveText("1");

  // 해결 표시
  await item.click();
  const twoColumns = ["pad-landscape", "pc"].includes(testInfo.project.name);
  if (!twoColumns) await expect(page).toHaveURL(/\/learn\/note\/\?id=/);
  await page.getByTestId("note-detail").getByRole("button", { name: "해결로 표시" }).click();
  await expect(page.getByTestId("note-detail").getByRole("button", { name: "다시 풀기로 되돌리기" })).toBeVisible();
  if (!twoColumns) await page.getByRole("link", { name: "오답노트" }).click();
  await expect(page.getByTestId("note-item").filter({ hasText: "문제집 p.91 12번" })).toContainText("해결");

  // 거르기
  await page.getByRole("radiogroup", { name: "상태 거르기" }).getByRole("radio", { name: "다시 풀기" }).click();
  await expect(page.getByTestId("note-item")).toHaveCount(0);
  await page.getByRole("radiogroup", { name: "상태 거르기" }).getByRole("radio", { name: "해결" }).click();
  await expect(page.getByTestId("note-item")).toHaveCount(1);

  // 과목 추가
  await page.getByRole("button", { name: "과목", exact: true }).click();
  await page.getByRole("button", { name: "새 과목 만들기" }).click();
  const subjectDialog = page.getByRole("dialog", { name: "과목 추가" });
  await subjectDialog.getByLabel("이름").fill("화학Ⅰ");
  await subjectDialog.getByRole("button", { name: "저장" }).click();
  const chips = page.getByRole("group", { name: "과목" });
  await expect(chips.getByRole("button", { name: /^화학Ⅰ \d+$/ })).toHaveAttribute("aria-pressed", "true");

  // 오답이 없는 과목은 바로 숨긴다
  await chips.getByRole("button", { name: "화학Ⅰ 과목 메뉴" }).click();
  await page.getByRole("button", { name: "이 종류에서 숨기기 또는 삭제" }).click();
  await expect(chips.getByRole("button", { name: /^화학Ⅰ \d+$/ })).toHaveCount(0);
});
