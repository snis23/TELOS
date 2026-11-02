import { DAY_MIN } from "./time";

/**
 * 5.11 시간 보기 (10분 단위 격자): 1시간이 한 줄, 하루 기준 시각부터 24줄.
 * 블록이 한 시간을 넘으면 다음 줄에 이어서 그리고, 겹치면 칸을 나눠 나란히 그린다.
 */

export type Block = { id: string; start: number; end: number };

export type Segment = {
  id: string;
  row: number;
  /** 줄 안에서의 시작·끝 (0~60분) */
  from: number;
  to: number;
  first: boolean;
  last: boolean;
};

/** 블록을 줄(시간)별 조각으로 */
export function segmentsOf(block: Block): Segment[] {
  const out: Segment[] = [];
  const start = Math.max(0, block.start);
  const end = Math.min(DAY_MIN, block.end);
  if (end <= start) return out;
  for (let row = Math.floor(start / 60); row * 60 < end; row += 1) {
    const from = Math.max(start, row * 60) - row * 60;
    const to = Math.min(end, (row + 1) * 60) - row * 60;
    out.push({ id: block.id, row, from, to, first: row * 60 + from === start, last: row * 60 + to === end });
  }
  return out;
}

export type Lane = { lane: number; lanes: number };

/** 겹치는 블록끼리 칸을 나눈다 (겹치는 묶음마다 필요한 칸 수) */
export function assignLanes(blocks: readonly Block[]): Map<string, Lane> {
  const sorted = [...blocks].filter((b) => b.end > b.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const result = new Map<string, Lane>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const c of cluster) result.set(c.id, { lane: c.lane, lanes });
    cluster = [];
    laneEnds = [];
  };

  for (const b of sorted) {
    if (b.start >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex((end) => end <= b.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.end);
    } else {
      laneEnds[lane] = b.end;
    }
    cluster.push({ id: b.id, lane });
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  flush();
  return result;
}

/** 시간 블록이 차시와 정확히 맞으면 그 차시에 배정, 벗어나면 배정만 푼다 (5.11 두 보기의 연결) */
export function matchSlot<S extends { id: string; start_min: number; end_min: number }>(
  start: number,
  end: number,
  slots: readonly S[],
): S | null {
  return slots.find((s) => s.start_min === start && s.end_min === end) ?? null;
}

/** 끌어서 옮기기: 잡은 위치를 유지한 채 10분 칸에 맞추고 하루 안으로 */
export function moveBlock(block: Block, pointerMin: number, grabOffset: number): { start: number; end: number } {
  const length = block.end - block.start;
  let start = Math.round((pointerMin - grabOffset) / 10) * 10;
  start = Math.min(Math.max(0, start), DAY_MIN - length);
  return { start, end: start + length };
}

/** 끝을 끌어 길이 바꾸기: 최소 10분 */
export function resizeBlock(block: Block, pointerMin: number): { start: number; end: number } {
  const end = Math.min(DAY_MIN, Math.max(block.start + 10, Math.round(pointerMin / 10) * 10));
  return { start: block.start, end };
}

/** 실제 공부한 시간 막대 (줄 아래 3px): 기록을 줄 조각으로 */
export function studyBars(
  intervals: readonly { start: number; end: number; subjectId: string | null }[],
): { row: number; from: number; to: number; subjectId: string | null }[] {
  return intervals.flatMap((iv, i) =>
    segmentsOf({ id: String(i), start: iv.start, end: iv.end }).map((s) => ({
      row: s.row,
      from: s.from,
      to: s.to,
      subjectId: iv.subjectId,
    })),
  );
}
