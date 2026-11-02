import { describe, expect, it } from "vitest";
import { pickNextColor } from "./subject-colors";
import { subjectFormSchema } from "@/lib/validation/subject";

describe("과목", () => {
  it("새 과목 색은 안 쓴 색부터", () => {
    expect(pickNextColor([])).toBe("rose");
    expect(pickNextColor(["rose", "periwinkle"])).toBe("mint");
    expect(pickNextColor(["rose", "periwinkle", "mint", "butter", "lavender", "peach", "sky", "sage"])).toBe("rose");
  });

  it("이름 검증: 1~20자, 중복 불가, 앞뒤 공백 제거", () => {
    const schema = subjectFormSchema(["국어"]);
    expect(schema.safeParse({ name: "  화학Ⅰ ", color_key: "sky" })).toMatchObject({
      success: true,
      data: { name: "화학Ⅰ" },
    });
    expect(schema.safeParse({ name: "국어", color_key: "rose" }).success).toBe(false);
    expect(schema.safeParse({ name: "", color_key: "rose" }).success).toBe(false);
    expect(schema.safeParse({ name: "가".repeat(21), color_key: "rose" }).success).toBe(false);
    expect(schema.safeParse({ name: "물리", color_key: "red" }).success).toBe(false);
  });
});
