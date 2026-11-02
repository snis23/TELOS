"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export type AuthState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | { status: "signed-in"; session: Session; userId: string };

const AuthContext = createContext<AuthState>({ status: "loading" });

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** 로그인한 화면에서만 쓴다 */
export function useUserId(): string {
  const auth = useAuth();
  if (auth.status !== "signed-in") throw new Error("useUserId requires a signed-in user");
  return auth.userId;
}

function toState(session: Session | null): AuthState {
  return session
    ? { status: "signed-in", session, userId: session.user.id }
    : { status: "signed-out" };
}

/** 로그인 상태는 브라우저에 저장되어 기기마다 유지된다 (2장 로그인) */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에서만 알 수 있는 값
      setState({ status: "unconfigured" });
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState(toState(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState((prev) => {
        // 토큰만 새로 받은 경우 같은 사용자면 화면을 다시 그리지 않게 userId 를 유지
        const next = toState(session);
        if (prev.status === "signed-in" && next.status === "signed-in" && prev.userId === next.userId) {
          return { ...next };
        }
        return next;
      });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
