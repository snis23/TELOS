/** 빈 화면: 회색 안내 문구 한 줄과 추가 버튼 (4.2) */
export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="text-13 text-sub">{message}</p>
      {action}
    </div>
  );
}
