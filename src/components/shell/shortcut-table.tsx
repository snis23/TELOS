import { SHORTCUT_ROWS } from "@/lib/shortcuts/keys";

/**
 * 4.3 단축키 표: PC 레이아웃에서만 본문 맨 아래에 작게 보여 준다.
 * 선택·클릭·탭 이동이 되지 않게 한다.
 */
export function ShortcutTable() {
  const rows = SHORTCUT_ROWS.filter((row) => row.ready);
  return (
    <div
      data-testid="shortcut-table"
      className="mt-12 hidden cursor-default grid-cols-4 gap-x-6 gap-y-2 border-t border-line pt-4 select-none pointer-events-none pc:grid"
    >
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <span className="flex shrink-0 items-center gap-1">
            {row.keys.map((key) => (
              <kbd key={key} className="key-chip">
                {key}
              </kbd>
            ))}
          </span>
          <span className="text-11 text-sub">{row.label}</span>
        </div>
      ))}
    </div>
  );
}
