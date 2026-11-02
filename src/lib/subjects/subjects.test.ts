import { describe, expect, it } from "vitest";
import type { SubjectRow } from "@/lib/supabase/database.types";
import {
  activeSchoolSubjects,
  archivedSubjects,
  mockSubjects,
  needsTermReview,
  pickableSubjects,
  subjectTag,
  subjectsForExam,
  subjectsForNotes,
  termLabel,
  termOf,
} from "./subjects";

const DATES = { sem1_start: "03-01", sem2_start: "08-01" };

let n = 0;
function s(p: Partial<SubjectRow>): SubjectRow {
  n += 1;
  return {
    id: p.id ?? `s${n}`,
    user_id: "u",
    created_at: `2026-01-01T00:00:0${n % 10}Z`,
    updated_at: "",
    deleted_at: null,
    delete_batch_id: null,
    name: p.name ?? `과목${n}`,
    color_key: "rose",
    sort_order: p.sort_order ?? n,
    kind: p.kind ?? "school",
    term: p.term ?? null,
    archived_at: p.archived_at ?? null,
    ...p,
  };
}

describe("학기 계산", () => {
  it("3월부터 1학기, 8월부터 2학기, 1~2월은 지난 학년도 2학기", () => {
    expect(termOf("2026-03-01", DATES, 2025)).toEqual({ schoolYear: 2026, semester: 1, grade: 2, key: "2-1" });
    expect(termOf("2026-07-31", DATES, 2025).key).toBe("2-1");
    expect(termOf("2026-08-01", DATES, 2025).key).toBe("2-2");
    expect(termOf("2027-02-15", DATES, 2025)).toEqual({ schoolYear: 2026, semester: 2, grade: 2, key: "2-2" });
    expect(termOf("2027-03-02", DATES, 2025).key).toBe("3-1");
  });

  it("입학 연도를 모르거나 1~3학년 밖이면 학년 없음", () => {
    expect(termOf("2026-11-03", DATES, null)).toMatchObject({ grade: null, key: null, semester: 2 });
    expect(termOf("2026-11-03", DATES, 2022).key).toBeNull();
  });

  it("학기 시작일을 바꾸면 그 날짜를 따른다", () => {
    expect(termOf("2026-08-10", { sem1_start: "03-02", sem2_start: "08-17" }, 2026).key).toBe("1-1");
  });

  it("정리 창: 이번 학기를 아직 정리하지 않았을 때만", () => {
    const t = termOf("2026-11-03", DATES, 2025);
    expect(needsTermReview(t, null)).toBe(true);
    expect(needsTermReview(t, "2-1")).toBe(true);
    expect(needsTermReview(t, "2-2")).toBe(false);
    expect(needsTermReview(termOf("2026-11-03", DATES, null), null)).toBe(false);
    expect(termLabel("2-1")).toBe("2학년 1학기");
  });
});

describe("과목 목록", () => {
  const list = [
    s({ id: "k", name: "국어", kind: "mock", sort_order: 0 }),
    s({ id: "m", name: "수학", kind: "mock", sort_order: 1 }),
    s({ id: "lit", name: "문학", term: "2-2", sort_order: 10 }),
    s({ id: "old", name: "통합과학1", term: "1-1", archived_at: "2026-08-01T00:00:00Z", sort_order: 5 }),
    s({ id: "gone", name: "지운 과목", deleted_at: "2026-10-01T00:00:00Z" }),
  ];

  it("고르는 목록: 모의고사 과목 다음 지금 내신 과목, 보관·삭제 과목은 빠진다", () => {
    expect(pickableSubjects(list).map((x) => x.id)).toEqual(["k", "m", "lit"]);
    expect(mockSubjects(list).map((x) => x.id)).toEqual(["k", "m"]);
    expect(activeSchoolSubjects(list).map((x) => x.id)).toEqual(["lit"]);
    expect(archivedSubjects(list).map((x) => x.id)).toEqual(["old"]);
  });

  it("시험 종류·오답 종류별 과목", () => {
    expect(subjectsForExam("school", list).map((x) => x.id)).toEqual(["lit"]);
    expect(subjectsForExam("mock", list).map((x) => x.id)).toEqual(["k", "m"]);
    expect(subjectsForExam("other", list).map((x) => x.id)).toEqual(["k", "m", "lit"]);
    expect(subjectsForNotes("school", list).map((x) => x.id)).toEqual(["lit"]);
    expect(subjectsForNotes("mock", list).map((x) => x.id)).toEqual(["k", "m"]);
  });

  it("보관한 내신 과목은 학기 꼬리표로 구분한다", () => {
    expect(subjectTag(list[3])).toBe("1-1");
    expect(subjectTag(list[2])).toBeNull();
    expect(subjectTag(list[0])).toBeNull();
  });
});
