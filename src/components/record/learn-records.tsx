"use client";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { SubjectDot } from "@/components/ui/subject-dot";
import { useCards, useDecks, useNotes } from "@/lib/data/learn";
import { useSubjectMap } from "@/lib/data/subjects";
import { addDays } from "@/lib/date/days";
import { getStudyDate } from "@/lib/date/study-date";
import { useDayStartHour } from "@/lib/data/profile";
import { subjectTag } from "@/lib/subjects/subjects";

/** 오답·암기 기록: 과목별 오답(전체, 다시 풀 문제, 최근 30일 추가·해결), 암기 카드 묶음별 외운 비율 */
export function LearnRecords({ today }: { today: string }) {
  const dayStartHour = useDayStartHour();
  const { data: notes } = useNotes();
  const { data: decks } = useDecks();
  const { data: cards } = useCards();
  const subjects = useSubjectMap();
  const since = addDays(today, -30);
  const studyDate = (iso: string) => getStudyDate(new Date(iso), dayStartHour);

  const bySubject = new Map<string, { total: number; open: number; added: number; solved: number }>();
  for (const n of notes ?? []) {
    const r = bySubject.get(n.subject_id) ?? { total: 0, open: 0, added: 0, solved: 0 };
    r.total += 1;
    if (!n.solved_at) r.open += 1;
    if (studyDate(n.created_at) >= since) r.added += 1;
    if (n.solved_at && studyDate(n.solved_at) >= since) r.solved += 1;
    bySubject.set(n.subject_id, r);
  }
  const rows = [...bySubject.entries()].sort((a, b) => b[1].open - a[1].open);

  return (
    <>
      <Card title="오답노트">
        {rows.length === 0 ? (
          <EmptyState message="아직 기록한 오답이 없어요" />
        ) : (
          <table className="w-full text-13">
            <thead>
              <tr className="text-left text-11 text-sub">
                <th className="py-1 font-normal">과목</th>
                <th className="py-1 text-right font-normal">전체</th>
                <th className="py-1 text-right font-normal">다시 풀 문제</th>
                <th className="py-1 text-right font-normal">30일 추가</th>
                <th className="py-1 text-right font-normal">30일 해결</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([id, r]) => {
                const s = subjects.get(id);
                return (
                  <tr key={id} className="border-t border-line">
                    <td className="py-2">
                      <span className="flex items-center gap-2 text-ink-2">
                        {s ? <SubjectDot color={s.color_key} /> : null}
                        {s?.name ?? "지운 과목"}
                        {s && subjectTag(s) ? <span className="text-11 text-sub">{subjectTag(s)}</span> : null}
                      </span>
                    </td>
                    <td className="num py-2 text-right">{r.total}</td>
                    <td className="num py-2 text-right font-medium text-urgent-ink">{r.open}</td>
                    <td className="num py-2 text-right">{r.added}</td>
                    <td className="num py-2 text-right text-ok-ink">{r.solved}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="암기 카드">
        {(decks ?? []).length === 0 ? (
          <EmptyState message="아직 암기 카드가 없어요" />
        ) : (
          <ul className="flex flex-col gap-3">
            {(decks ?? []).map((d) => {
              const list = (cards ?? []).filter((c) => c.deck_id === d.id);
              const known = list.filter((c) => c.known).length;
              const s = d.subject_id ? subjects.get(d.subject_id) : undefined;
              return (
                <li key={d.id} className="flex flex-col gap-1.5" data-subject={s?.color_key}>
                  <p className="flex items-center gap-2 text-13 text-ink-2">
                    {s ? <SubjectDot color={s.color_key} /> : null}
                    <span className="flex-1 truncate">{d.title}</span>
                    <span className="num text-12 text-sub">
                      외움 {known}/{list.length}
                    </span>
                  </p>
                  <ProgressBar value={list.length ? known / list.length : 0} label={`${d.title} 외운 비율`} tone={s ? "subject" : "accent"} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
