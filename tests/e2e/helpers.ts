import { expect, type Page, type TestInfo } from "@playwright/test";

export const EMAIL = "demo@telos.local";
export const PASSWORD = "telos1234";
const DB_KEY = "telos:fake-db:e2e";

/** 로그인하고 오늘 화면까지 */
export async function login(page: Page) {
  await page.goto("login/");
  await page.getByLabel("이메일").fill(EMAIL);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/TELOS\/$/);
  await expect(page.locator("main h1")).toBeVisible();
}

export function isPc(testInfo: TestInfo) {
  return testInfo.project.name === "pc";
}

export function usesSidebar(testInfo: TestInfo) {
  return testInfo.project.name === "pc" || testInfo.project.name === "pad-landscape";
}

export function isPhone(testInfo: TestInfo) {
  return testInfo.project.name === "phone";
}

/** 가로 스크롤이 생기지 않는지 */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** 가짜 백엔드 저장소를 읽는다 */
export async function readDb(page: Page): Promise<Record<string, Record<string, unknown>[]>> {
  await page.waitForTimeout(150);
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}").tables ?? {}, DB_KEY);
}

/**
 * 테스트 준비용: 가짜 백엔드 저장소에 행을 직접 넣고 새로고침한다.
 * (화면으로 만들기 번거로운 상태, 예: 3번 미룬 할 일)
 */
export async function seedRows(page: Page, table: string, rows: Record<string, unknown>[]) {
  await page.waitForTimeout(150);
  await page.evaluate(
    ({ key, table, rows }) => {
      const db = JSON.parse(window.localStorage.getItem(key) ?? '{"tables":{}}');
      const userId = db.tables.profiles?.[0]?.user_id;
      const now = new Date().toISOString();
      db.tables[table] = [
        ...(db.tables[table] ?? []),
        ...rows.map((r) => ({
          id: crypto.randomUUID(),
          user_id: userId,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          delete_batch_id: null,
          ...r,
        })),
      ];
      window.localStorage.setItem(key, JSON.stringify(db));
    },
    { key: DB_KEY, table, rows },
  );
  await page.reload();
  await expect(page.locator("main h1, [data-testid=focus-mode]").first()).toBeVisible();
}

/** 오늘 공부 날짜 (페이지 안에서 앱과 같은 계산) */
export async function studyToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const now = new Date(Date.now() - 6 * 3600 * 1000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
  });
}

/** 할 일 추가 창으로 할 일 하나 만들기 */
export async function addTask(page: Page, title: string, options: { subject?: string } = {}) {
  await page.getByTestId("task-card").getByRole("button", { name: "추가", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("제목").fill(title);
  if (options.subject) await dialog.getByLabel("과목").selectOption({ label: options.subject });
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("task-card").getByText(title)).toBeVisible();
}
