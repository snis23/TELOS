"use client";

import { strToU8, zipSync } from "fflate";
import { NOTE_BUCKET } from "@/lib/data/learn";
import { requireSupabase } from "@/lib/supabase/client";
import { BACKUP_TABLES, type BackupTable } from "@/lib/supabase/database.types";
import { backupFileName, buildBackup, type Backup } from "./backup";

const PAGE = 1000;

async function fetchTable(table: BackupTable): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await requireSupabase()
      .from(table)
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE) break;
  }
  return out;
}

/** 모든 기록(휴지통 포함)과 설정을 백업 객체로 */
export async function collectBackup(): Promise<Backup> {
  const supabase = requireSupabase();
  const { data: profile, error } = await supabase.from("profiles").select("*").maybeSingle();
  if (error) throw error;
  const tables: Backup["tables"] = {};
  for (const t of BACKUP_TABLES) tables[t] = await fetchTable(t);
  return buildBackup(profile, tables);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadJsonBackup(date: string): Promise<Backup> {
  const backup = await collectBackup();
  downloadBlob(new Blob([JSON.stringify(backup, null, 1)], { type: "application/json" }), backupFileName("json", date));
  return backup;
}

/** 오답 사진을 모두 내려받아 zip 하나로 */
export async function downloadPhotoZip(date: string, onProgress: (done: number, total: number) => void): Promise<number> {
  const supabase = requireSupabase();
  const photos = await fetchTable("wrong_note_photos");
  const files: Record<string, Uint8Array> = {};
  let done = 0;
  onProgress(0, photos.length);
  for (const p of photos) {
    const path = String(p.storage_path);
    const { data, error } = await supabase.storage.from(NOTE_BUCKET).download(path);
    if (!error && data) files[path] = new Uint8Array(await data.arrayBuffer());
    done += 1;
    onProgress(done, photos.length);
  }
  if (Object.keys(files).length === 0) files["사진 없음.txt"] = strToU8("내려받을 사진이 없어요");
  // 사진은 이미 압축되어 있어 다시 압축하지 않는다 (level 0)
  const zip = zipSync(files, { level: 0 });
  downloadBlob(new Blob([zip as BlobPart], { type: "application/zip" }), backupFileName("zip", date));
  return Object.keys(files).length;
}
