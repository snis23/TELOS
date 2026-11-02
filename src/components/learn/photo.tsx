"use client";

import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useInView, useSignedUrl } from "@/lib/data/learn";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { SubjectColorKey } from "@/lib/design/subject-colors";

/** 오답 사진: 화면에 보일 때만 서명된 URL 을 받아 그린다. 불러오는 동안 과목 태그 바탕 + 사진 아이콘 */
export function NotePhoto({
  path,
  color,
  alt,
  className,
  thumb,
}: {
  path: string | null;
  color?: SubjectColorKey;
  alt: string;
  className?: string;
  thumb?: boolean;
}) {
  const [ref, visible] = useInView<HTMLDivElement>();
  const { data: url } = useSignedUrl(path, visible);
  return (
    <div ref={ref} data-subject={color} className={cn("relative overflow-hidden rounded-input bg-s-tag", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- 서명된 URL 이라 next/image 최적화를 쓸 수 없다
        <img src={url} alt={alt} loading="lazy" className={cn("size-full", thumb ? "object-cover" : "object-contain")} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-s-tag-ink">
          <ImageIcon size={thumb ? ICON_SIZE.inline : ICON_SIZE.tab} strokeWidth={ICON_STROKE} aria-hidden />
        </span>
      )}
    </div>
  );
}
