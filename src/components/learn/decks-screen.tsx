"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/select";
import { SubjectTag } from "@/components/ui/tag";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { newId, useTableMutations } from "@/lib/data/crud";
import { useCards, useDecks } from "@/lib/data/learn";
import { useSubjectMap, useSubjects } from "@/lib/data/subjects";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { BACK_MAX, FRONT_MAX, parseBulkCards, studyOrder } from "@/lib/learn/cards";
import type { FlashCardRow, FlashDeckRow } from "@/lib/supabase/database.types";
import { useLayout } from "@/lib/use-layout";

const decksKey = ["flash_decks", "all", "sort_order", false] as const;
const cardsKey = ["flash_cards", "all", "sort_order", false] as const;

/** 7.4 암기 카드: 묶음을 과목별로. 패드 가로·PC 는 목록 + 상세 2열 */
export function DecksScreen() {
  const router = useRouter();
  const layout = useLayout();
  const twoColumns = layout === "land" || layout === "pc";
  const { data: decks } = useDecks();
  const { data: cards } = useCards();
  const { data: subjects } = useSubjects();
  const subjectMap = useSubjectMap();
  const deckMut = useTableMutations("flash_decks");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<FlashDeckRow | "new" | null>(null);

  const list = decks ?? [];
  const groups = [
    ...(subjects ?? []).map((s) => ({ key: s.id, subject: s, decks: list.filter((d) => d.subject_id === s.id) })),
    { key: "none", subject: null, decks: list.filter((d) => !d.subject_id || !subjectMap.has(d.subject_id)) },
  ].filter((g) => g.decks.length);

  const open = (d: FlashDeckRow) => (twoColumns ? setSelected(d.id) : router.push(`/learn/deck/?id=${d.id}`));

  const deckList = (
    <div className="flex flex-col gap-4">
      {groups.length === 0 ? <EmptyState message="아직 암기 카드 묶음이 없어요" /> : null}
      {groups.map((g) => (
        <section key={g.key} aria-label={g.subject?.name ?? "과목 없음"}>
          <h3 className="mb-1">{g.subject ? <SubjectTag name={g.subject.name} color={g.subject.color_key} /> : <span className="text-12 text-sub">과목 없음</span>}</h3>
          <ul className="flex flex-col">
            {g.decks.map((d) => {
              const deckCards = (cards ?? []).filter((c) => c.deck_id === d.id);
              const known = deckCards.filter((c) => c.known).length;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => open(d)}
                    aria-current={selected === d.id ? "true" : undefined}
                    className={cn("flex min-h-11 w-full items-center gap-2 rounded-input px-2 text-left", selected === d.id && "bg-surface-2")}
                  >
                    <span className="min-w-0 flex-1 truncate text-13 text-ink-2">{d.title}</span>
                    <span className="num text-11 text-sub">
                      {known}/{deckCards.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-18 font-semibold">암기 카드</h2>
        <Button pill onClick={() => setEditing("new")}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          묶음 추가
        </Button>
      </div>
      {twoColumns ? (
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-8">
          <div className="card">{deckList}</div>
          <div className="card">{selected ? <DeckDetail deckId={selected} onDeleted={() => setSelected(null)} /> : <p className="text-13 text-sub">묶음을 골라요</p>}</div>
        </div>
      ) : (
        <div className="card">{deckList}</div>
      )}
      {editing ? (
        <DeckDialog
          deck={editing === "new" ? null : editing}
          subjects={(subjects ?? []).map((s) => ({ value: s.id, label: s.name }))}
          onClose={() => setEditing(null)}
          onSubmit={(v) => {
            if (editing === "new") {
              const id = newId();
              deckMut.insert.mutate({ rows: [{ id, ...v, sort_order: list.length }], appendTo: decksKey });
              if (twoColumns) setSelected(id);
            } else deckMut.update.mutate({ ids: [editing.id], patch: v });
          }}
        />
      ) : null}
    </div>
  );
}

function DeckDialog({
  deck,
  subjects,
  onClose,
  onSubmit,
}: {
  deck: FlashDeckRow | null;
  subjects: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (v: { title: string; subject_id: string | null }) => void;
}) {
  const [title, setTitle] = useState(deck?.title ?? "");
  const [subjectId, setSubjectId] = useState(deck?.subject_id ?? "");
  const [error, setError] = useState<string | undefined>();
  return (
    <Dialog
      open
      onClose={onClose}
      title={deck ? "묶음 수정" : "묶음 추가"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={() => {
              const t = title.trim();
              if (!t) return setError("제목을 입력해 주세요");
              if (t.length > 60) return setError("60자 이내로 써 주세요");
              onSubmit({ title: t, subject_id: subjectId || null });
              onClose();
            }}
          >
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="제목" value={title} onChange={(e) => setTitle(e.target.value)} error={error} autoFocus />
        <SelectField label="과목" value={subjectId} onChange={setSubjectId} options={[{ value: "", label: "없음" }, ...subjects]} />
      </div>
    </Dialog>
  );
}

/** 묶음 상세: 카드 목록, 추가(한 장 / 여러 장), 외우기 */
export function DeckDetail({ deckId, onDeleted }: { deckId: string; onDeleted?: () => void }) {
  const { data: decks } = useDecks();
  const { data: cards } = useCards();
  const subjects = useSubjectMap();
  const deckMut = useTableMutations("flash_decks");
  const cardMut = useTableMutations("flash_cards");
  const [cardDialog, setCardDialog] = useState<FlashCardRow | "new" | null>(null);
  const [bulk, setBulk] = useState(false);
  const [studying, setStudying] = useState(false);
  const [editDeck, setEditDeck] = useState(false);
  const deck = (decks ?? []).find((d) => d.id === deckId);
  if (!deck) return <p className="text-13 text-sub">묶음을 찾을 수 없어요</p>;
  const deckCards = (cards ?? []).filter((c) => c.deck_id === deck.id);
  const subject = deck.subject_id ? subjects.get(deck.subject_id) : undefined;
  const known = deckCards.filter((c) => c.known).length;

  return (
    <article className="flex flex-col gap-4" aria-label={deck.title} data-testid="deck-detail">
      <header className="flex items-center gap-2">
        {subject ? <SubjectTag name={subject.name} color={subject.color_key} /> : null}
        <h3 className="min-w-0 flex-1 truncate text-14 font-semibold">{deck.title}</h3>
        <IconButton aria-label="묶음 수정" onClick={() => setEditDeck(true)}>
          <Pencil size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
        </IconButton>
        <IconButton
          aria-label="묶음 삭제"
          onClick={() => {
            deckMut.trash.mutate({ id: deck.id });
            onDeleted?.();
          }}
        >
          <Trash2 size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
        </IconButton>
      </header>
      <p className="num text-12 text-sub">
        외움 {known} / {deckCards.length}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setStudying(true)} disabled={deckCards.length === 0}>
          외우기
        </Button>
        <Button variant="secondary" onClick={() => setCardDialog("new")}>
          카드 추가
        </Button>
        <Button variant="secondary" onClick={() => setBulk(true)}>
          여러 장 한 번에
        </Button>
      </div>
      {deckCards.length === 0 ? (
        <EmptyState message="아직 카드가 없어요" />
      ) : (
        <ul className="flex flex-col">
          {deckCards.map((c) => (
            <li key={c.id} className="flex min-h-11 items-center gap-3 border-b border-line py-1 last:border-b-0">
              <button type="button" onClick={() => setCardDialog(c)} className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate text-13 text-ink-2">{c.front}</span>
                <span className="truncate text-12 text-sub">{c.back}</span>
              </button>
              <span className={cn("shrink-0 text-11", c.known ? "text-ok-ink" : "text-sub")}>{c.known ? "외움" : "모름"}</span>
            </li>
          ))}
        </ul>
      )}

      {cardDialog ? (
        <CardDialog
          card={cardDialog === "new" ? null : cardDialog}
          onClose={() => setCardDialog(null)}
          onSubmit={(v) =>
            cardDialog === "new"
              ? cardMut.insert.mutate({ rows: [{ id: newId(), deck_id: deck.id, ...v, sort_order: deckCards.length }], appendTo: cardsKey })
              : cardMut.update.mutate({ ids: [cardDialog.id], patch: v })
          }
          onDelete={
            cardDialog !== "new"
              ? () => {
                  cardMut.trash.mutate({ id: cardDialog.id });
                  setCardDialog(null);
                }
              : undefined
          }
        />
      ) : null}
      {bulk ? (
        <BulkDialog
          onClose={() => setBulk(false)}
          onSubmit={(list) =>
            cardMut.insert.mutate({
              rows: list.map((c, i) => ({ id: newId(), deck_id: deck.id, ...c, sort_order: deckCards.length + i })),
              appendTo: cardsKey,
            })
          }
        />
      ) : null}
      {studying ? (
        <StudyDialog cards={deckCards} title={deck.title} onClose={() => setStudying(false)} onMark={(c, k) => cardMut.update.mutate({ ids: [c.id], patch: { known: k } })} />
      ) : null}
      {editDeck ? (
        <DeckDialog
          deck={deck}
          subjects={[...subjects.values()].map((s) => ({ value: s.id, label: s.name }))}
          onClose={() => setEditDeck(false)}
          onSubmit={(v) => deckMut.update.mutate({ ids: [deck.id], patch: v })}
        />
      ) : null}
    </article>
  );
}

function CardDialog({
  card,
  onClose,
  onSubmit,
  onDelete,
}: {
  card: FlashCardRow | null;
  onClose: () => void;
  onSubmit: (v: { front: string; back: string }) => void;
  onDelete?: () => void;
}) {
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [errors, setErrors] = useState<{ front?: string; back?: string }>({});
  const submit = () => {
    const e: { front?: string; back?: string } = {};
    if (!front.trim()) e.front = "앞면을 입력해 주세요";
    else if (front.trim().length > FRONT_MAX) e.front = `${FRONT_MAX}자 이내로 써 주세요`;
    if (!back.trim()) e.back = "뒷면을 입력해 주세요";
    else if (back.trim().length > BACK_MAX) e.back = `${BACK_MAX}자 이내로 써 주세요`;
    setErrors(e);
    if (e.front || e.back) return;
    onSubmit({ front: front.trim(), back: back.trim() });
    onClose();
  };
  const area = "rounded-input bg-surface-2 px-3 py-2 text-13 text-ink outline-none focus-visible:outline-2 focus-visible:outline-check";
  return (
    <Dialog
      open
      onClose={onClose}
      title={card ? "카드 수정" : "카드 추가"}
      footer={
        <>
          {onDelete ? (
            <Button variant="danger" className="mr-auto" onClick={onDelete}>
              삭제
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>저장</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-12 text-sub">앞면</span>
          <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} className={area} autoFocus />
          {errors.front ? <span className="text-12 text-urgent-ink">{errors.front}</span> : null}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-12 text-sub">뒷면</span>
          <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} className={area} />
          {errors.back ? <span className="text-12 text-urgent-ink">{errors.back}</span> : null}
        </label>
      </div>
    </Dialog>
  );
}

/** 여러 장 한 번에: 한 줄에 "앞면 | 뒷면". 틀린 줄은 몇 번째 줄인지 알려 준다 */
function BulkDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (cards: { front: string; back: string }[]) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const { cards, errorLines } = parseBulkCards(text);
    if (errorLines.length) return setError(`${errorLines.join(", ")}번째 줄의 형식을 확인해 주세요 (앞면 | 뒷면)`);
    if (cards.length === 0) return setError("카드를 한 줄 이상 써 주세요");
    onSubmit(cards);
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="여러 장 한 번에 추가"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>추가</Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-12 text-sub">한 줄에 한 장씩: 앞면 | 뒷면</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"apple | 사과\nbanana | 바나나"}
          className="rounded-input bg-surface-2 px-3 py-2 text-13 text-ink outline-none focus-visible:outline-2 focus-visible:outline-check"
          autoFocus
        />
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-12 text-urgent-ink">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

/** 외우기 화면: 가운데 카드, 누르면 뒤집기, "모름" / "외웠음", 위에 "12 / 30". 모름 카드를 먼저 섞어서 */
function StudyDialog({
  cards,
  title,
  onClose,
  onMark,
}: {
  cards: FlashCardRow[];
  title: string;
  onClose: () => void;
  onMark: (card: FlashCardRow, known: boolean) => void;
}) {
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [order, setOrder] = useState(() => studyOrder(cards, false));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = order[index];

  const restart = (only: boolean) => {
    setOnlyUnknown(only);
    setOrder(studyOrder(cards, only));
    setIndex(0);
    setFlipped(false);
  };
  const mark = (known: boolean) => {
    if (!card) return;
    onMark(card, known);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  return (
    <Dialog open onClose={onClose} title={`${title} 외우기`}>
      <div className="flex flex-col items-center gap-4 pb-2">
        <div className="flex w-full items-center justify-between">
          <span className="num text-13 text-sub" data-testid="study-progress">
            {Math.min(index + 1, order.length)} / {order.length}
          </span>
          <label className="flex items-center gap-2 text-12 text-ink-2">
            <input type="checkbox" checked={onlyUnknown} onChange={(e) => restart(e.target.checked)} className="size-4 accent-check" />
            모름만 보기
          </label>
        </div>
        {card ? (
          <>
            <button
              type="button"
              onClick={() => setFlipped(!flipped)}
              aria-label={flipped ? "앞면 보기" : "뒷면 보기"}
              className="flex min-h-48 w-full items-center justify-center rounded-card bg-timer-bg p-6 text-center text-18 whitespace-pre-wrap"
            >
              {flipped ? card.back : card.front}
            </button>
            <p className="text-11 text-sub">{flipped ? "뒷면" : "앞면 · 누르면 뒤집어요"}</p>
            <div className="grid w-full grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => mark(false)}>
                모름
              </Button>
              <Button onClick={() => mark(true)}>외웠음</Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-14">{order.length ? "한 바퀴 다 봤어요" : "볼 카드가 없어요"}</p>
            <Button variant="secondary" onClick={() => restart(onlyUnknown)}>
              다시 보기
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
