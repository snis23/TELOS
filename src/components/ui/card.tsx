import { cn } from "@/lib/cn";
import { CardErrorBoundary } from "./error-boundary";

type CardProps = {
  title?: string;
  /** 제목 오른쪽 버튼 자리 */
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** 카드: 테두리·그림자 없이 흰 바탕 (3장). 오류가 나도 이 카드만 대체한다 (10.1). */
export function Card({ title, actions, className, children }: CardProps) {
  return (
    <section className={cn("card", className)} aria-label={title}>
      {title || actions ? (
        <header className="mb-4 flex min-h-8 items-center justify-between gap-3">
          {title ? <h2 className="text-14 font-semibold">{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      <CardErrorBoundary>{children}</CardErrorBoundary>
    </section>
  );
}
