import { describe, expect, it } from "vitest";
import { subjectInsights, weakSubjects } from "./insights";

const today = "2026-11-15";
const road = (subject_id: string, study_date: string, done: boolean) => ({ subject_id, study_date, done_at: done ? "x" : null, deleted_at: null });

describe("개선이 필요한 과목", () => {
  it("로드맵 실현률·미루기·공부 비중·오답으로 저조한 과목을 고르고 이유와 개선점을 붙인다", () => {
    const list = subjectInsights({
      subjectIds: ["m", "k", "e"],
      today,
      roadmap: [
        road("m", "2026-11-10", false),
        road("m", "2026-11-11", false),
        road("m", "2026-11-12", true),
        road("k", "2026-11-10", true),
        road("k", "2026-11-11", true),
        road("m", "2026-11-15", false), // 오늘은 세지 않는다
        road("m", "2026-10-01", false), // 기간 밖
      ],
      tasks: [],
      deferrals: [
        { subject_id: "m", from_date: "2026-11-10" },
        { subject_id: "m", from_date: "2026-11-11" },
        { subject_id: "m", from_date: "2026-11-12" },
      ],
      stats: [
        { subject_id: "k", study_date: "2026-11-10", study_seconds: 36000 },
        { subject_id: "m", study_date: "2026-11-10", study_seconds: 600 },
      ],
      notes: Array.from({ length: 6 }, () => ({ subject_id: "e", solved_at: null, deleted_at: null })),
    });
    const weak = weakSubjects(list);
    expect(weak.map((w) => w.subjectId)).toEqual(["m", "e"]);
    const m = weak[0];
    expect(m).toMatchObject({ roadmapDue: 3, roadmapDone: 1, deferrals: 3 });
    expect(m.reasons).toEqual(["로드맵 계획 실현률 33% (3개 중 1개)", "최근 14일 동안 3번 미룸", "공부 시간 비중 2%"]);
    expect(m.tips.length).toBe(3);
    expect(weak[1].reasons).toEqual(["다시 풀 오답 6개"]);
    expect(list.find((x) => x.subjectId === "k")?.reasons).toEqual([]);
  });

  it("기록이 적으면 판단하지 않는다", () => {
    const list = subjectInsights({
      subjectIds: ["m"],
      today,
      roadmap: [road("m", "2026-11-10", false)],
      tasks: [{ subject_id: "m", study_date: "2026-11-10", done_at: null, deleted_at: null }],
      deferrals: [],
      stats: [],
      notes: [],
    });
    expect(weakSubjects(list)).toEqual([]);
  });
});
