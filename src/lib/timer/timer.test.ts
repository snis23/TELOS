import { describe, expect, it } from "vitest";
import { getStudyDate } from "@/lib/date/study-date";
import { computeDailyStats, splitByStudyDate } from "@/lib/stats/daily";
import { formatDurationKo, formatHM, formatHMS, formatHMSShort } from "./format";
import { clockToInstant, isLongRunning, napSummary, studySecondsBySubject } from "./sessions";

const now = new Date("2026-11-02T12:00:00Z"); // 한국 21:00

describe("타이머 표시", () => {
  it("형식", () => {
    expect(formatHMS(3723)).toBe("01:02:03");
    expect(formatHMSShort(9250)).toBe("2:34:10");
    expect(formatHM(9250)).toBe("2:34");
    expect(formatDurationKo(35 * 60)).toBe("35분");
    expect(formatDurationKo(65 * 60)).toBe("1시간 5분");
    expect(formatDurationKo(120 * 60)).toBe("2시간");
  });
});

describe("타이머 기록의 하루 나누기 (5.4)", () => {
  it("하루 기준 시각을 넘긴 기록은 두 날짜로", () => {
    const parts = splitByStudyDate("2026-11-01T20:30:00Z", "2026-11-01T21:30:00Z", 6, now, getStudyDate);
    // 한국 05:30~06:30 → 11-01 에 30분, 11-02 에 30분
    expect(parts).toEqual([
      { date: "2026-11-01", seconds: 1800 },
      { date: "2026-11-02", seconds: 1800 },
    ]);
  });

  it("오늘 순공은 오늘 몫만, 쪽잠은 빼고", () => {
    const sessions = [
      { kind: "study" as const, subject_id: "m", started_at: "2026-11-01T20:30:00Z", ended_at: "2026-11-01T21:30:00Z", deleted_at: null },
      { kind: "study" as const, subject_id: "k", started_at: "2026-11-02T10:00:00Z", ended_at: null, deleted_at: null },
      { kind: "nap" as const, subject_id: null, started_at: "2026-11-02T05:00:00Z", ended_at: "2026-11-02T05:20:00Z", deleted_at: null },
      { kind: "study" as const, subject_id: "k", started_at: "2026-11-02T03:00:00Z", ended_at: "2026-11-02T04:00:00Z", deleted_at: "x" },
    ];
    const r = studySecondsBySubject(sessions, "2026-11-02", 6, now);
    expect(r.bySubject.get("m")).toBe(1800);
    expect(r.bySubject.get("k")).toBe(7200); // 켜진 기록은 지금까지
    expect(r.total).toBe(9000);
    expect(napSummary(sessions, "2026-11-02", 6, now)).toEqual({ seconds: 1200, count: 1 });
  });

  it("통계 계산 (SQL compute_daily_stats 와 같은 규칙)", () => {
    const rows = computeDailyStats({
      studyDate: "2026-11-01",
      dayStartHour: 6,
      sessions: [
        { kind: "study", subject_id: "m", started_at: "2026-11-01T20:30:00Z", ended_at: "2026-11-01T21:30:00Z" },
        { kind: "nap", subject_id: null, started_at: "2026-11-01T04:00:00Z", ended_at: "2026-11-01T04:20:00Z" },
      ],
      tasks: [
        { id: "a", study_date: "2026-11-01", done_at: "x" },
        { id: "b", study_date: "2026-11-02", done_at: null },
      ],
      deferrals: [{ id: "d1", task_id: "b", from_date: "2026-11-01" }],
      now,
    });
    expect(rows).toContainEqual(expect.objectContaining({ subject_id: "m", study_seconds: 1800 }));
    expect(rows.find((r) => r.subject_id === null)).toMatchObject({
      nap_seconds: 1200,
      nap_count: 1,
      planned_tasks: 2,
      done_tasks: 1,
      deferred_events: 1,
    });
  });

  it("켜진 기록 하나 제한은 DB 부분 고유 인덱스가 지킨다: 3시간 넘으면 확인", () => {
    expect(isLongRunning({ started_at: "2026-11-02T08:59:00Z", ended_at: null }, now)).toBe(true);
    expect(isLongRunning({ started_at: "2026-11-02T09:01:00Z", ended_at: null }, now)).toBe(false);
    expect(isLongRunning({ started_at: "2026-11-02T08:00:00Z", ended_at: "2026-11-02T09:00:00Z" }, now)).toBe(false);
  });

  it("기록 수정: 기준 시각보다 이른 시각은 다음 날 새벽", () => {
    expect(clockToInstant("2026-11-02", "19:40", 6).toISOString()).toBe("2026-11-02T10:40:00.000Z");
    expect(clockToInstant("2026-11-02", "01:30", 6).toISOString()).toBe("2026-11-02T16:30:00.000Z");
  });
});
