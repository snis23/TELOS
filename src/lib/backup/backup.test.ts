import { describe, expect, it } from "vitest";
import { backupDue, backupFileName, buildBackup, checkBackup, upgradeV1 } from "./backup";

describe("백업 (9.5)", () => {
  it("만든 백업은 검사를 통과하고 표별 행 수를 센다", () => {
    const b = buildBackup({ theme: "dark" }, { subjects: [{ id: "a" }, { id: "b" }], tasks: [{ id: "t" }] }, new Date("2026-11-02T00:00:00Z"));
    const r = checkBackup(JSON.stringify(b));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.total).toBe(3);
      expect(r.counts.find((c) => c.table === "subjects")?.rows).toBe(2);
      expect(r.backup.exported_at).toBe("2026-11-02T00:00:00.000Z");
    }
  });

  it("앱 이름·버전·형식이 다르면 거절", () => {
    expect(checkBackup("not json")).toEqual({ ok: false, reason: "JSON 파일이 아니에요" });
    expect(checkBackup('{"app":"other","version":1,"tables":{}}')).toMatchObject({ ok: false, reason: "Telos 백업 파일이 아니에요" });
    expect(checkBackup('{"app":"telos","version":3,"tables":{}}')).toMatchObject({ ok: false });
    expect(checkBackup('{"app":"telos","version":2,"tables":{"users":[]}}')).toMatchObject({ ok: false });
    expect(checkBackup('{"app":"telos","version":2,"tables":{"tasks":{}}}')).toMatchObject({ ok: false });
  });

  it("이전 버전(1) 백업은 지금 구조로 바꿔서 받는다: 성적 표는 버리고 과목·회고·할 일을 옮긴다", () => {
    const v1 = {
      app: "telos",
      version: 1,
      exported_at: "2026-11-01T00:00:00.000Z",
      profile: { theme: "dark" },
      tables: {
        subjects: [
          { id: "k", name: "국어" },
          { id: "s", name: "과학" },
          { id: "t", name: "탐구1" },
          { id: "c", name: "화학Ⅰ" },
        ],
        reflections: [{ id: "r", study_date: "2026-10-31", good: "잘함", bad: "", tomorrow: "내일", condition: 4 }],
        tasks: [
          { id: "a", source: "range" },
          { id: "b", source: "recurrence" },
        ],
        ddays: [{ id: "d", type: "exam" }],
        school_grades: [{ id: "g" }],
      },
    };
    const r = checkBackup(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    const up = upgradeV1(v1);
    expect(up.version).toBe(2);
    expect(up.tables.subjects?.map((s) => [s.name, s.kind, s.archived_at != null])).toEqual([
      ["국어", "mock", false],
      ["통합과학", "mock", false],
      ["탐구1", "mock", true],
      ["화학Ⅰ", "school", false],
    ]);
    expect(up.tables.reflections?.[0].comment).toBe("잘함\n내일");
    expect(up.tables.tasks?.map((t) => t.source)).toEqual(["manual", "recurrence"]);
    expect(up.tables.ddays?.[0].exam_kind).toBe("other");
    expect("school_grades" in up.tables).toBe(false);
  });

  it("30일 안내: 마지막 백업(없으면 계정 만든 날)부터 30일이 넘으면", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    expect(backupDue("2026-10-01T00:00:00Z", "2026-01-01T00:00:00Z", now)).toBe(true);
    expect(backupDue("2026-10-10T00:00:00Z", "2026-01-01T00:00:00Z", now)).toBe(false);
    expect(backupDue(null, "2026-10-20T00:00:00Z", now)).toBe(false);
    expect(backupDue(null, "2026-09-01T00:00:00Z", now)).toBe(true);
  });

  it("파일 이름", () => {
    expect(backupFileName("json", "2026-11-02")).toBe("telos-backup-2026-11-02.json");
    expect(backupFileName("zip", "2026-11-02")).toBe("telos-photos-2026-11-02.zip");
  });
});
