"use client";

import { requireSupabase } from "@/lib/supabase/client";
import { NOTE_BUCKET } from "./learn";

const LAST_KEY = "telos:file-cleanup";

/**
 * 9.3-3 앱을 열 때 하루 한 번, 완전히 지운 오답의 사진 파일을 Storage 에서 지우고 대기열 행을 없앤다.
 * 실패하면 다음에 다시 한다 (대기열이 그대로 남는다).
 */
export async function cleanupPendingFiles(today: string): Promise<number> {
  try {
    if (window.localStorage.getItem(LAST_KEY) === today) return 0;
  } catch {
    // 무시
  }
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("pending_file_deletions").select("id, storage_path").limit(200);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length) {
    const removed = await supabase.storage.from(NOTE_BUCKET).remove(rows.map((r) => r.storage_path));
    if (removed.error) throw removed.error;
    const del = await supabase
      .from("pending_file_deletions")
      .delete()
      .in(
        "id",
        rows.map((r) => r.id),
      );
    if (del.error) throw del.error;
  }
  try {
    window.localStorage.setItem(LAST_KEY, today);
  } catch {
    // 무시
  }
  return rows.length;
}
