"use client";

import Link from "next/link";
import { backupDue } from "@/lib/backup/backup";
import { useProfile } from "@/lib/data/profile";

/** 9.5 마지막 백업 후 30일이 지나면 오늘 화면에 작은 안내 */
export function BackupReminder() {
  const { data: profile } = useProfile();
  if (!profile || !backupDue(profile.last_backup_at, profile.created_at)) return null;
  return (
    <p className="-mt-2 mb-4 text-12 text-sub pad:mb-6" data-testid="backup-reminder">
      마지막 백업 후 30일이 지났어요{" "}
      <Link href="/settings/#backup" className="font-medium text-accent">
        백업하기
      </Link>
    </p>
  );
}
