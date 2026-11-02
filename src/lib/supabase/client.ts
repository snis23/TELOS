import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createFakeBackend } from "@telos/fake-backend";
import type { Database } from "./database.types";

/**
 * 브라우저에서 바로 Supabase 에 접속한다 (서버 기능 없음).
 * 두 값은 빌드할 때 들어가는 공개 값이고, 데이터는 RLS 가 지킨다. 서비스 키는 쓰지 않는다.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** 개발 데모·E2E 전용 가짜 백엔드 ("demo" | "e2e"). 배포 빌드에서는 비어 있어야 한다. */
export const FAKE_BACKEND = process.env.NEXT_PUBLIC_TELOS_FAKE_BACKEND ?? "";

export type TelosClient = SupabaseClient<Database>;

export function isSupabaseConfigured(): boolean {
  return FAKE_BACKEND !== "" || (SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0);
}

let client: TelosClient | null = null;

function createFake(): TelosClient {
  return createFakeBackend(FAKE_BACKEND) as TelosClient;
}

/** 브라우저 전용 클라이언트. 설정 값이 없으면 null */
export function getSupabase(): TelosClient | null {
  if (typeof window === "undefined" || !isSupabaseConfigured()) return null;
  if (!client) {
    if (process.env.NEXT_PUBLIC_TELOS_FAKE_BACKEND) {
      client = createFake();
    } else {
      client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: "telos:auth",
        },
      });
    }
  }
  return client;
}

/** 로그인 뒤 화면에서 쓴다. 설정이 없으면 오류 */
export function requireSupabase(): TelosClient {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}
