/**
 * 가짜 Supabase 클라이언트 (개발 데모, E2E 테스트 전용).
 * NEXT_PUBLIC_TELOS_FAKE_BACKEND 가 "demo" 또는 "e2e" 일 때만 쓰이고, 배포 빌드에서는 빠진다.
 */
import { idbDelete, idbGet, idbSet } from "@/lib/idb";
import { FakeQuery } from "./query";
import { runRpc } from "./rpc";
import { FakeError, FakeStore, pgError } from "./store";
import type { TableName } from "../database.types";

export const FAKE_MARKER = "telos-fake-backend";
export const FAKE_EMAIL = "demo@telos.local";
export const FAKE_PASSWORD = "telos1234";
const FAKE_USER_ID = "00000000-0000-4000-8000-000000000001";

type Session = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "bearer";
  user: { id: string; email: string; aud: string; app_metadata: object; user_metadata: object; created_at: string };
};
type AuthListener = (event: string, session: Session | null) => void;

function makeSession(email: string): Session {
  return {
    access_token: FAKE_MARKER,
    refresh_token: FAKE_MARKER,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: FAKE_USER_ID, email, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
}

export function createFakeClient(mode: string, seed?: (store: FakeStore, putFile: (path: string, blob: Blob) => void) => void) {
  const sessionKey = `telos:fake-session:${mode}`;
  const store = new FakeStore(`telos:fake-db:${mode}`, FAKE_USER_ID);
  const listeners = new Set<AuthListener>();
  const files = new Map<string, Blob>();
  const urls = new Map<string, string>();

  const readSession = (): Session | null => {
    try {
      const raw = window.localStorage.getItem(sessionKey);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  };
  const emit = (event: string, session: Session | null) => {
    for (const l of listeners) l(event, session);
  };

  const rpcCall = (name: string, args: Record<string, unknown> = {}) => ({
    then<A, B = never>(
      onfulfilled?: ((v: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ) {
      const run = async () => {
        await new Promise((r) => setTimeout(r, 0));
        try {
          const data = runRpc(store, name, args);
          if (name === "bootstrap_user" && seed) seed(store, (path, blob) => putFile(`wrong-notes/${path}`, blob));
          return { data, error: null };
        } catch (error) {
          if (error instanceof FakeError) return { data: null, error: error.pg };
          throw error;
        }
      };
      return run().then(onfulfilled, onrejected);
    },
  });

  // 사진 파일은 기기의 IndexedDB 에 둔다 (새로고침해도 남게)
  const fileKey = (path: string) => `telos:fake-file:${mode}:${path}`;
  const putFile = (path: string, blob: Blob) => {
    files.set(path, blob);
    void idbSet(fileKey(path), blob);
  };
  const loadFile = async (path: string) => {
    if (!files.has(path)) {
      const blob = await idbGet<Blob>(fileKey(path));
      if (blob) files.set(path, blob);
    }
    return files.get(path) ?? null;
  };

  const signedUrl = async (path: string) => {
    const blob = await loadFile(path);
    if (!blob) return null;
    let url = urls.get(path);
    if (!url) {
      url = URL.createObjectURL(blob);
      urls.set(path, url);
    }
    return url;
  };

  const client = {
    from: (table: TableName) => new FakeQuery(store, table),
    rpc: rpcCall,
    auth: {
      async getSession() {
        return { data: { session: readSession() }, error: null };
      },
      onAuthStateChange(callback: AuthListener) {
        listeners.add(callback);
        setTimeout(() => callback("INITIAL_SESSION", readSession()), 0);
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        await new Promise((r) => setTimeout(r, 50));
        if (password !== FAKE_PASSWORD) {
          return { data: { session: null, user: null }, error: { name: "AuthApiError", message: "Invalid login credentials", status: 400, code: "invalid_credentials" } };
        }
        const session = makeSession(email);
        window.localStorage.setItem(sessionKey, JSON.stringify(session));
        emit("SIGNED_IN", session);
        return { data: { session, user: session.user }, error: null };
      },
      async signOut() {
        window.localStorage.removeItem(sessionKey);
        emit("SIGNED_OUT", null);
        return { error: null };
      },
    },
    storage: {
      from: (bucket: string) => ({
        async upload(path: string, file: Blob) {
          await new Promise((r) => setTimeout(r, 20));
          if (!path.startsWith(`${FAKE_USER_ID}/`)) {
            return { data: null, error: { message: "new row violates row-level security policy", statusCode: "403" } };
          }
          putFile(`${bucket}/${path}`, file);
          return { data: { path }, error: null };
        },
        async download(path: string) {
          const blob = await loadFile(`${bucket}/${path}`);
          return blob ? { data: blob, error: null } : { data: null, error: { message: "Object not found", statusCode: "404" } };
        },
        async createSignedUrl(path: string) {
          const url = await signedUrl(`${bucket}/${path}`);
          return url ? { data: { signedUrl: url }, error: null } : { data: null, error: { message: "Object not found" } };
        },
        async createSignedUrls(paths: string[]) {
          const data = [];
          for (const p of paths) {
            const url = await signedUrl(`${bucket}/${p}`);
            data.push({ path: p, signedUrl: url ?? "", error: url ? null : "Object not found" });
          }
          return { data, error: null };
        },
        async remove(paths: string[]) {
          for (const p of paths) {
            files.delete(`${bucket}/${p}`);
            void idbDelete(fileKey(`${bucket}/${p}`));
          }
          return { data: paths.map((name) => ({ name })), error: null };
        },
      }),
    },
    channel() {
      const channel = {
        on: () => channel,
        subscribe: () => channel,
        unsubscribe: async () => "ok",
      };
      return channel;
    },
    async removeChannel() {
      return "ok";
    },
    /** 테스트에서 저장소를 직접 다룰 때 */
    __store: store,
    __putFile(path: string, blob: Blob) {
      putFile(`wrong-notes/${path}`, blob);
    },
  };
  return client;
}

export { FakeStore, FakeError, pgError };
