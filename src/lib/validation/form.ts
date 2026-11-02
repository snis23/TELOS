import type { z } from "zod";

/** zod 결과를 입력칸별 첫 오류 문구로 바꾼다 */
export function fieldErrors<T>(result: z.ZodSafeParseResult<T>): Partial<Record<string, string>> {
  if (result.success) return {};
  const errors: Partial<Record<string, string>> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
