import type { LessonBlock, LessonPrint } from "../../types/lessonPrint";

/**
 * 外部AIやJSONインポートの入力を、アプリが保存できるLessonPrintへ整える。
 *
 * 足りないIDや解答欄を補い、本文中のページ番号・問題番号ラベルを取り除く。
 */
export function normalizeImportedPrint(value: unknown): LessonPrint {
  if (!isRecord(value)) {
    throw new Error("プリントJSONの形式ではありません。");
  }

  if (!Array.isArray(value.blocks)) {
    throw new Error("blocks が見つかりません。");
  }

  const now = new Date().toISOString();
  const blocks = value.blocks.map(normalizeImportedBlock);

  return {
    id: typeof value.id === "string" && value.id ? value.id : crypto.randomUUID(),
    title: typeof value.title === "string" && value.title ? value.title : "読み込んだプリント",
    subject: typeof value.subject === "string" ? value.subject : "数学",
    grade: typeof value.grade === "string" ? value.grade : "",
    unit: typeof value.unit === "string" ? value.unit : "1",
    paperSize: value.paperSize === "a4" ? "a4" : "b5",
    audience: value.audience === "teacher" ? "teacher" : "student",
    blocks: ensureAnswerBlocks(blocks),
    typstSource: typeof value.typstSource === "string" ? value.typstSource : "",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: now,
  };
}

function normalizeImportedBlock(value: unknown, index: number): LessonBlock {
  if (!isRecord(value)) {
    throw new Error(`${index + 1}番目のブロック形式が正しくありません。`);
  }

  if (!isBlockType(value.type)) {
    throw new Error(`${index + 1}番目のブロック type が正しくありません。`);
  }

  const block: LessonBlock = {
    ...value,
    id: typeof value.id === "string" && value.id ? value.id : crypto.randomUUID(),
    type: value.type,
    title: typeof value.title === "string" ? stripSourceLabel(value.title) : "",
    content: isRecord(value.content)
      ? normalizeTipTapContent(value.content)
      : { type: "doc", content: [{ type: "paragraph" }] },
  };

  if (block.type === "answer") {
    return normalizeAnswerBlock(block);
  }

  return block;
}

/**
 * 例題・練習問題の直後にはPDF用の解答欄が必要なので、欠けている分だけ補完する。
 */
function ensureAnswerBlocks(blocks: LessonBlock[]) {
  const output: LessonBlock[] = [];

  blocks.forEach((block, index) => {
    output.push(block);
    if (block.type !== "example" && block.type !== "exercise") return;

    const next = blocks[index + 1];
    if (next?.type === "answer") return;

    output.push(createAnswerBlock());
  });

  return output;
}

function createAnswerBlock(): LessonBlock {
  return normalizeAnswerBlock({
    id: `block-${crypto.randomUUID()}`,
    type: "answer",
    title: "解答欄",
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
}

function normalizeAnswerBlock(block: LessonBlock): LessonBlock {
  return {
    ...block,
    title: block.title || "解答欄",
    answerStyle: "box",
    width: block.width ?? 100,
    height: block.height ?? 20,
  };
}

/**
 * TipTap JSONの構造は保ったまま、textだけを掃除してAI由来の見出し混入を減らす。
 */
function normalizeTipTapContent(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeTipTapContent);
  }

  if (!isRecord(value)) {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    next[key] = key === "text" && typeof child === "string" ? stripSourceLabel(child) : normalizeTipTapContent(child);
  }
  return next;
}

/**
 * AIが本文に混ぜやすい「p.152」「Q1」「TRY」などの出典ラベルを表示用テキストから外す。
 */
function stripSourceLabel(value: string) {
  const title = value.trim();
  const normalized = title
    .replace(
      /^(?:p\.?\s*\d+\s*)?(?:問|問題|練習問題|確認問題|例題|例|Q|TRY|Try|try|トライ|チャレンジ|定義|定理|まとめ)\s*[0-9０-９一二三四五六七八九十]*\s*(?:[:：・.\-ー－]\s*)?/,
      "",
    )
    .replace(/^p\.?\s*\d+\s*(?:[:：・.\-ー－]\s*)?/, "");

  return normalized.trim() || title;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBlockType(value: unknown): value is LessonPrint["blocks"][number]["type"] {
  return (
    value === "heading" ||
    value === "paragraph" ||
    value === "definition" ||
    value === "theorem" ||
    value === "example" ||
    value === "exercise" ||
    value === "answer" ||
    value === "formula" ||
    value === "image"
  );
}
