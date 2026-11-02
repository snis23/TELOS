import { cn } from "@/lib/cn";

type PageHeaderProps = {
  title: string;
  /** 제목 위 작은 줄 (날짜 등) */
  eyebrow?: React.ReactNode;
  /** 제목 아래 작은 줄 */
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, eyebrow, sub, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 flex items-end justify-between gap-4 pad:mb-8", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-12 text-sub">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {sub ? <div className="mt-1 text-12 text-sub">{sub}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
