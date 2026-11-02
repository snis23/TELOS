"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth/auth-provider";
import { ConfigMissing } from "@/lib/auth/require-auth";
import { getSupabase } from "@/lib/supabase/client";
import { isNetworkError } from "@/lib/supabase/errors";
import { fieldErrors } from "@/lib/validation/form";
import { loginSchema } from "@/lib/validation/auth";

/** 로그인 (이메일 + 비밀번호). 회원가입은 없다. */
export function LoginForm() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (auth.status === "signed-in") router.replace("/");
  }, [auth.status, router]);

  if (auth.status === "unconfigured") return <ConfigMissing />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    setErrors(fieldErrors(parsed));
    setFormError(null);
    if (!parsed.success) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setPending(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) {
        setFormError(
          isNetworkError(error) ? "연결이 불안정해요. 잠시 뒤 다시 해 주세요" : "이메일이나 비밀번호가 맞지 않아요",
        );
      }
    } catch {
      setFormError("연결이 불안정해요. 잠시 뒤 다시 해 주세요");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-8">
      <form onSubmit={submit} noValidate className="card flex w-full max-w-login flex-col gap-4">
        <div>
          <p className="text-15 font-semibold tracking-brand">TELOS</p>
          <h1 className="page-title mt-1">로그인</h1>
        </div>
        <TextField
          label="이메일"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        {formError ? (
          <p role="alert" className="text-12 text-urgent-ink">
            {formError}
          </p>
        ) : null}
        <Button type="submit" block disabled={pending}>
          {pending ? "로그인하는 중" : "로그인"}
        </Button>
        {process.env.NEXT_PUBLIC_TELOS_FAKE_BACKEND ? (
          <p className="text-12 text-sub">개발용 가짜 서버예요. demo@telos.local / telos1234</p>
        ) : null}
      </form>
    </div>
  );
}
