"use client";

import Link from "next/link";

export default function FocusPage() {
  return (
    <div data-theme="dark" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg text-ink">
      <p className="text-13 text-sub">집중 모드는 준비 중이에요</p>
      <Link href="/" className="text-13 text-accent">
        나가기
      </Link>
    </div>
  );
}
