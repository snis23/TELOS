"use client";

import { useState } from "react";
import { TermReviewDialog } from "@/components/subjects/term-review-dialog";
import { Button } from "@/components/ui/button";
import { useProfile, useTerm } from "@/lib/data/profile";
import { needsTermReview, termLabel } from "@/lib/subjects/subjects";

/** 새 학기가 시작됐거나 입학 연도를 아직 정하지 않았으면 내신 과목 정리를 권한다 */
export function TermBanner({ today }: { today: string }) {
  const { data: profile } = useProfile();
  const term = useTerm(today);
  const [open, setOpen] = useState(false);
  if (!profile) return null;
  const noYear = profile.entry_year == null;
  if (!noYear && !needsTermReview(term, profile.reviewed_term)) return null;
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-item bg-nav-on px-4 py-2.5" role="status">
        <p className="min-w-0 text-13 text-accent-strong">
          {noYear
            ? "입학 연도를 정하고 이번 학기 내신 과목을 추가해 주세요."
            : `${termLabel(term.key)}가 시작됐어요. 내신 과목을 정리해 주세요.`}
        </p>
        <Button className="shrink-0" onClick={() => setOpen(true)}>
          과목 정리
        </Button>
      </div>
      <TermReviewDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
