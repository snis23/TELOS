import type { Metadata } from "next";
import { NotePageView } from "@/components/learn/detail-pages";

export const metadata: Metadata = { title: "오답" };

export default function NotePage() {
  return <NotePageView />;
}
