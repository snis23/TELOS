"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { requireSupabase } from "@/lib/supabase/client";
import { useTableMutations } from "./crud";
import { useAllRows } from "./queries";

export const NOTE_BUCKET = "wrong-notes";
const SIGNED_URL_SECONDS = 60 * 60;

export function useNotes() {
  return useAllRows("wrong_notes", { orderBy: "created_at" });
}
export function useNotePhotos() {
  return useAllRows("wrong_note_photos", { orderBy: "sort_order" });
}
export function useMockRounds() {
  return useAllRows("mock_rounds", { orderBy: "created_at" });
}
export function useNoteMutations() {
  return useTableMutations("wrong_notes");
}
export function useDecks() {
  return useAllRows("flash_decks", { orderBy: "sort_order" });
}
export function useCards() {
  return useAllRows("flash_cards", { orderBy: "sort_order" });
}

/** 비공개 버킷의 사진: 서명된 URL 로만 표시 (2장). 화면에 보일 때만 불러온다 (10.1 성능) */
export function useSignedUrl(path: string | null, visible: boolean) {
  return useQuery({
    queryKey: ["signed-url", path],
    enabled: Boolean(path) && visible,
    staleTime: (SIGNED_URL_SECONDS - 300) * 1000,
    gcTime: SIGNED_URL_SECONDS * 1000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().storage.from(NOTE_BUCKET).createSignedUrl(path as string, SIGNED_URL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** 요소가 화면에 들어왔는지 (한 번 보이면 계속 true) */
export function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 지원하지 않는 브라우저는 바로 보여 준다
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

/** 과목별 단원 (내신 오답노트를 단원으로 나눈다) */
export function useUnits() {
  return useAllRows("units", { orderBy: "sort_order" });
}
export function useUnitMutations() {
  return useTableMutations("units");
}
