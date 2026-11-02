import { PageHeader } from "./page-header";

/** 아직 만들지 않은 화면 */
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="card text-13 text-sub">이 화면은 준비 중이에요</div>
    </>
  );
}
