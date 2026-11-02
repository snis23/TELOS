"use client";

import { useOnline } from "@/lib/use-online";

/** 10.1 연결 끊김: 화면 위에 얇은 안내 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="alert" className="sticky top-0 z-40 bg-warn-bg px-5 py-1.5 text-center text-12 text-warn-ink">
      인터넷 연결이 끊겼어요. 연결되면 다시 저장해요
    </div>
  );
}
