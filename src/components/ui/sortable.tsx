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
import { restrictToHorizontalAxis, restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
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
  wholeItem = false,
  onHold,
}: {
  items: readonly T[];
  onReorder: (ids: string[]) => void;
  children: (item: T, handle: React.ReactNode) => React.ReactNode;
  axis?: "vertical" | "horizontal" | "free";
  /** 손잡이 대신 항목 전체를 끈다 (터치는 길게 누른 뒤) */
  wholeItem?: boolean;
  /** 길게 누르고 움직이지 않고 놓았을 때 (터치) */
  onHold?: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((i) => i.id);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      if (Math.hypot(event.delta.x, event.delta.y) < 6) onHold?.(String(active.id));
      return;
    }
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
      modifiers={
        axis === "vertical"
          ? [restrictToVerticalAxis, restrictToParentElement]
          : axis === "horizontal"
            ? [restrictToHorizontalAxis]
            : [restrictToParentElement]
      }
      accessibility={{
        screenReaderInstructions: { draggable: "Space 로 집고 화살표로 옮긴 뒤 Space 로 놓아요" },
      }}
    >
      <SortableContext items={ids} strategy={axis === "horizontal" ? horizontalListSortingStrategy : verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableRow key={item.id} id={item.id} wholeItem={wholeItem} inline={axis === "horizontal"}>
            {(handle) => children(item, handle)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
  wholeItem,
  inline,
}: {
  id: string;
  children: (handle: React.ReactNode) => React.ReactNode;
  wholeItem?: boolean;
  inline?: boolean;
}) {
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
  if (wholeItem) {
    // 안에 버튼이 있으므로 감싸는 요소는 버튼 역할을 하지 않는다
    const { role: _role, tabIndex: _tab, "aria-pressed": _pressed, "aria-roledescription": _desc, ...rest } = attributes;
    void _role;
    void _tab;
    void _pressed;
    void _desc;
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={cn("relative", inline && "shrink-0", isDragging && "z-10 opacity-80")}
        {...rest}
        {...listeners}
      >
        {children(null)}
      </div>
    );
  }
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", inline && "shrink-0", isDragging && "z-10 opacity-80")}
    >
      {children(handle)}
    </div>
  );
}
