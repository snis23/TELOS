"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { cn } from "@/lib/cn";

/**
 * 끌어서 순서 바꾸기 (@dnd-kit). 마우스는 손잡이를 끌고, 터치 기기는 길게 누른 뒤 끈다.
 * 키보드: 손잡이에서 Space 로 집고 ↑↓ 로 옮긴 뒤 Space 로 놓는다.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  children,
  axis = "vertical",
}: {
  items: readonly T[];
  onReorder: (ids: string[]) => void;
  children: (item: T, handle: React.ReactNode) => React.ReactNode;
  axis?: "vertical" | "free";
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((i) => i.id);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      modifiers={axis === "vertical" ? [restrictToVerticalAxis, restrictToParentElement] : [restrictToParentElement]}
      accessibility={{
        screenReaderInstructions: { draggable: "Space 로 집고 화살표로 옮긴 뒤 Space 로 놓아요" },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableRow key={item.id} id={item.id}>
            {(handle) => children(item, handle)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label="끌어서 순서 바꾸기"
      className="hit inline-flex size-7 shrink-0 touch-none items-center justify-center rounded-input text-sub hover:bg-surface-2 hover:text-ink"
      {...attributes}
      {...listeners}
    >
      <GripVertical size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-80")}
    >
      {children(handle)}
    </div>
  );
}
