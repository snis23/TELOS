"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { useDayStartHour } from "@/lib/data/profile";
import { formatStudyDateLong, getStudyDate } from "@/lib/date/study-date";

export function TodayView() {
  const dayStartHour = useDayStartHour();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const studyDate = getStudyDate(now, dayStartHour);
  return (
    <>
      <PageHeader eyebrow={formatStudyDateLong(studyDate)} title="오늘" />
      <div className="card text-13 text-sub">이 화면은 준비 중이에요</div>
    </>
  );
}
