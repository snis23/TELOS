"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { DeckDetail } from "./decks-screen";
import { NoteDetail } from "./note-detail";

function Back({ label }: { label: string }) {
  return (
    <Link href="/learn/" className="mb-4 inline-flex items-center gap-1 text-13 text-accent">
      <ChevronLeft size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
      {label}
    </Link>
  );
}

function NoteInner() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  return (
    <>
      <Back label="오답노트" />
      <div className="card">{id ? <NoteDetail noteId={id} onDeleted={() => router.push("/learn/")} /> : null}</div>
    </>
  );
}

function DeckInner() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  return (
    <>
      <Back label="암기 카드" />
      <div className="card">{id ? <DeckDetail deckId={id} onDeleted={() => router.push("/learn/")} /> : null}</div>
    </>
  );
}

/** 폰·패드 세로의 오답 상세 (/learn/note/?id=) */
export function NotePageView() {
  return (
    <Suspense fallback={null}>
      <NoteInner />
    </Suspense>
  );
}

/** 폰·패드 세로의 암기 카드 묶음 상세 (/learn/deck/?id=) */
export function DeckPageView() {
  return (
    <Suspense fallback={null}>
      <DeckInner />
    </Suspense>
  );
}
