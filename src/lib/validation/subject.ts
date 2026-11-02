import { z } from "zod";
import { SUBJECT_COLOR_KEYS } from "@/lib/design/subject-colors";

/** 과목 이름: 1~20자 (DB: subjects_name_check) */
export const SUBJECT_NAME_MAX = 20;

export function subjectFormSchema(existingNames: readonly string[]) {
  const taken = new Set(existingNames);
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, "과목 이름을 입력해 주세요")
      .max(SUBJECT_NAME_MAX, `${SUBJECT_NAME_MAX}자 이내로 써 주세요`)
      .refine((name) => !taken.has(name), "이미 있는 과목 이름이에요"),
    color_key: z.enum(SUBJECT_COLOR_KEYS, { error: "색을 골라 주세요" }),
  });
}
