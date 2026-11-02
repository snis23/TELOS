import { describe, expect, it } from "vitest";
import { backupDue, backupFileName, buildBackup, checkBackup } from "./backup";

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
    expect(checkBackup('{"app":"telos","version":2,"tables":{}}')).toMatchObject({ ok: false });
    expect(checkBackup('{"app":"telos","version":1,"tables":{"users":[]}}')).toMatchObject({ ok: false });
    expect(checkBackup('{"app":"telos","version":1,"tables":{"tasks":{}}}')).toMatchObject({ ok: false });
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
