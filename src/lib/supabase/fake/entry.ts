/** 가짜 백엔드 진입점. next.config 의 별칭(@telos/fake-backend)으로만 불러온다. */
import { createFakeClient } from "./index";
import { seedDemo } from "./seed";

export function createFakeBackend(mode: string): unknown {
  return createFakeClient(mode, mode === "demo" ? seedDemo : undefined);
}
