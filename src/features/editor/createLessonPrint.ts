import type { BlockType, LessonBlock, LessonPrint } from "../../types/lessonPrint";

export function createId(prefix = "id") {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * 指定された種類のブロックを、エディタで扱える初期値付きで作成する。
 *
 * どのブロックもTipTapが扱える最小docから始め、種類ごとの差分だけを後から足す。
 */
export function createBlock(type: BlockType): LessonBlock {
  const common = {
    id: createId("block"),
    type,
    title: defaultBlockTitle(type),
    content: { type: "doc", content: [{ type: "paragraph" }] },
  };

  if (type === "answer") {
    return { ...common, answerStyle: "lines", width: 100, height: 28 };
  }

  if (type === "formula") {
    return { ...common, latex: "x^2 + 2x + 1 = 0" };
  }

  if (type === "heading") {
    return { ...common, headingLevel: 1 };
  }

  return common;
}

/**
 * 新規プリントを、授業中にすぐ書き始められる最小構成で作成する。
 */
export function createLessonPrint(): LessonPrint {
  const now = new Date().toISOString();

  return {
    id: createId("print"),
    title: "中学校数学プリント",
    subject: "数学",
    grade: "中学",
    unit: "1",
    paperSize: "b5",
    audience: "student",
    blocks: [createBlock("example")],
    typstSource: "",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * ブロック種類に対応する初期タイトルを返す。
 */
function defaultBlockTitle(type: BlockType) {
  const labels: Record<BlockType, string> = {
    heading: "見出し",
    paragraph: "説明",
    definition: "定義",
    theorem: "定理",
    example: "例題",
    exercise: "練習問題",
    answer: "解答欄",
    formula: "数式",
    image: "画像",
  };

  return labels[type];
}
