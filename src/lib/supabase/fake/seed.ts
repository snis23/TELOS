/**
 * 개발 데모용 샘플 데이터 (npm run dev:demo). 배포 환경에서는 실행되지 않는다.
 * 처음 한 번만 넣는다.
 */
import type { FakeStore } from "./store";

const SEEDED_KEY = "telos:fake-seeded:demo";

export function seedDemo(store: FakeStore) {
  try {
    if (window.localStorage.getItem(SEEDED_KEY)) return;
    window.localStorage.setItem(SEEDED_KEY, "1");
  } catch {
    return;
  }
  void store;
}
