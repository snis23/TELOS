"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useBootstrap } from "@/lib/data/bootstrap";
import { isSchemaMissing } from "@/lib/supabase/errors";
import { useAuth } from "./auth-provider";

function FullScreenMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="card w-full max-w-dialog">
        <h1 className="text-14 font-semibold">{title}</h1>
        <div className="mt-2 text-13 text-ink-2">{children}</div>
      </div>
    </div>
  );
}

/** Supabase 주소와 키가 빌드에 없을 때 */
export function ConfigMissing() {
  return (
    <FullScreenMessage title="연결 설정이 필요해요">
      Supabase 주소와 공개 키가 빌드에 들어 있지 않아요. 저장소 Secrets 에 NEXT_PUBLIC_SUPABASE_URL 과
      NEXT_PUBLIC_SUPABASE_ANON_KEY 를 넣고 다시 배포해 주세요. 자세한 방법은 docs/setup.md 에 있어요.
    </FullScreenMessage>
  );
}

/** 불러오는 동안 화면 전체를 가리지 않고 바탕만 보여 준다 */
function Blank() {
  return <div className="min-h-dvh" aria-busy="true" />;
}

/** /login 을 뺀 모든 페이지는 로그인이 필요하다. 로그인하지 않았으면 /login/ 으로 보낸다. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const userId = auth.status === "signed-in" ? auth.userId : null;
  const bootstrap = useBootstrap(userId);

  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/login/");
  }, [auth.status, router]);

  if (auth.status === "unconfigured") return <ConfigMissing />;
  if (auth.status !== "signed-in") return <Blank />;
  if (bootstrap.isPending) return <Blank />;
  if (bootstrap.isError) {
    return (
      <FullScreenMessage title={isSchemaMissing(bootstrap.error) ? "데이터베이스 준비가 안 됐어요" : "불러오지 못했어요"}>
        <p>
          {isSchemaMissing(bootstrap.error)
            ? "Supabase SQL Editor 에서 supabase/telos.sql 을 실행했는지 확인해 주세요."
            : "인터넷 연결을 확인하고 다시 시도해 주세요."}
        </p>
        <Button className="mt-4" onClick={() => void bootstrap.refetch()}>
          다시 시도
        </Button>
      </FullScreenMessage>
    );
  }
  return <>{children}</>;
}
