"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileArchive, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { checkBackup, TABLE_LABELS, type BackupCheck } from "@/lib/backup/backup";
import { downloadJsonBackup, downloadPhotoZip } from "@/lib/backup/export";
import { useProfile, useUpdateProfile } from "@/lib/data/profile";
import { useToday } from "@/lib/data/today";
import { formatClock, formatMonthDay } from "@/lib/date/days";
import { getStudyDate } from "@/lib/date/study-date";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { requireSupabase } from "@/lib/supabase/client";

/** 9.5 데이터 백업: JSON 내려받기, 사진 zip, JSON 복원(확인), 마지막 백업 시각 */
export function BackupCard() {
  const today = useToday();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [checked, setChecked] = useState<Extract<BackupCheck, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportJson = async () => {
    setBusy("모든 기록을 모으는 중");
    setError(null);
    try {
      await downloadJsonBackup(today);
      updateProfile.mutate({ last_backup_at: new Date().toISOString() });
      toast.show({ message: "모든 기록을 내려받았어요" });
    } catch {
      setError("기록을 내려받지 못했어요. 연결을 확인하고 다시 시도해 주세요");
    } finally {
      setBusy(null);
    }
  };

  const exportZip = async () => {
    setError(null);
    try {
      const n = await downloadPhotoZip(today, (done, total) => setBusy(`사진 ${done}/${total}`));
      toast.show({ message: `사진 ${n}장을 내려받았어요` });
    } catch {
      setError("사진을 내려받지 못했어요. 다시 시도해 주세요");
    } finally {
      setBusy(null);
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError("파일을 읽지 못했어요. 다시 골라 주세요");
      return;
    }
    const r = checkBackup(text);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setError(null);
    setChecked(r);
  };

  const restore = async () => {
    if (!checked) return;
    const backup = checked.backup;
    setChecked(null);
    setBusy("복원 전에 지금 기록을 내려받는 중");
    try {
      await downloadJsonBackup(today);
      setBusy("복원하는 중");
      const { error: e } = await requireSupabase().rpc("restore_backup", { p_backup: backup });
      if (e) throw e;
      await queryClient.invalidateQueries();
      toast.show({ message: "백업 파일로 복원했어요" });
    } catch {
      setError("복원하지 못했어요. 지금 기록은 그대로예요");
    } finally {
      setBusy(null);
    }
  };

  const last = profile?.last_backup_at;
  return (
    <Card title="백업">
      <div id="backup" className="flex flex-col gap-4">
        <p className="text-12 text-sub">
          {last ? `마지막 백업: ${formatMonthDay(getStudyDate(new Date(last)))} ${formatClock(last)}` : "아직 백업한 적이 없어요"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void exportJson()} disabled={Boolean(busy)}>
            <Download size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
            모든 기록 JSON 내려받기
          </Button>
          <Button variant="secondary" onClick={() => void exportZip()} disabled={Boolean(busy)}>
            <FileArchive size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
            사진 zip 내려받기
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={Boolean(busy)}>
            <Upload size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
            JSON으로 복원하기
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="백업 파일 고르기"
            data-testid="restore-input"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {busy ? (
          <p role="status" className="num text-12 text-sub">
            {busy}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-12 text-urgent-ink">
            {error}
          </p>
        ) : null}
        <p className="text-12 text-sub">오래 쉬기 전(방학 등)에는 JSON과 사진 zip을 함께 내려받아 두세요.</p>
      </div>

      {checked ? (
        <Dialog
          open
          onClose={() => setChecked(null)}
          title="이 백업으로 복원할까요?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setChecked(null)}>
                취소
              </Button>
              <Button variant="danger" onClick={() => void restore()}>
                복원하기
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-13">
            <p className="rounded-input bg-urgent-bg px-3 py-2 text-urgent-ink">
              지금 기록이 백업 파일 내용으로 바뀌어요. 복원하기 직전에 지금 기록을 JSON으로 한 번 내려받아요.
            </p>
            <p className="text-ink-2">
              백업 날짜: {formatMonthDay(getStudyDate(new Date(checked.backup.exported_at)))} {formatClock(checked.backup.exported_at)} · 모두{" "}
              <span className="num">{checked.total}</span>행
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-12 text-ink-2" data-testid="restore-counts">
              {checked.counts
                .filter((c) => c.rows > 0)
                .map((c) => (
                  <li key={c.table} className="flex justify-between">
                    <span>{TABLE_LABELS[c.table]}</span>
                    <span className="num">{c.rows}</span>
                  </li>
                ))}
            </ul>
          </div>
        </Dialog>
      ) : null}
    </Card>
  );
}
