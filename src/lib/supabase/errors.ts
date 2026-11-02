type MaybePgError = { code?: unknown; message?: unknown } | null | undefined;

function codeOf(error: unknown): string | undefined {
  const code = (error as MaybePgError)?.code;
  return typeof code === "string" ? code : undefined;
}

/** 고유 제약 위반 (예: 같은 이름의 과목) */
export function isUniqueViolation(error: unknown): boolean {
  return codeOf(error) === "23505";
}

/** 테이블이나 함수가 아직 없음: SQL 을 실행하지 않았을 때 */
export function isSchemaMissing(error: unknown): boolean {
  const code = codeOf(error);
  return code === "PGRST202" || code === "PGRST205" || code === "42P01" || code === "42883";
}

/** 네트워크 문제로 요청 자체가 실패했는지 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message = (error as MaybePgError)?.message;
  return typeof message === "string" && /fetch|network/i.test(message);
}
