import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5">
      <p className="text-13 text-sub">찾는 화면이 없어요</p>
      <Link href="/" className="text-13 text-accent">
        오늘 화면으로 가기
      </Link>
    </div>
  );
}
