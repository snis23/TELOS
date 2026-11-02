import type { Metadata } from "next";
import { DeckPageView } from "@/components/learn/detail-pages";

export const metadata: Metadata = { title: "암기 카드" };

export default function DeckPage() {
  return <DeckPageView />;
}
