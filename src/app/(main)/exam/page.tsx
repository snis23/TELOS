import type { Metadata } from "next";
import { ExamView } from "@/components/exam/exam-view";

export const metadata: Metadata = { title: "시험" };

export default function ExamPage() {
  return <ExamView />;
}
