export type BlockType =
  | "heading"
  | "paragraph"
  | "definition"
  | "theorem"
  | "example"
  | "exercise"
  | "answer"
  | "formula"
  | "image";

export type AnswerStyle = "lines" | "box" | "grid";
export type HeadingLevel = 1 | 2 | 3;
export type ImagePosition = "right" | "bottom";
export type BlockLayout = "single" | "two-column";
export type PaperSize = "b5" | "a4";
export type Audience = "student" | "teacher";

/**
 * 1つの授業プリントを構成する編集ブロック。
 *
 * TipTapのJSONや画像データURLなど保存形式が混在するため、
 * 表示・保存・Typst変換側で必要な項目をここに集約する。
 */
export interface LessonBlock {
  id: string;
  type: BlockType;
  title: string;
  content: unknown;
  rightContent?: unknown;
  latex?: string;
  answer?: string;
  rightAnswer?: string;
  answerContent?: unknown;
  rightAnswerContent?: unknown;
  answerStyle?: AnswerStyle;
  width?: number;
  height?: number;
  headingLevel?: HeadingLevel;
  layout?: BlockLayout;
  imageUrl?: string;
  imageDataUrl?: string;
  imagePosition?: ImagePosition;
  imageWidthMm?: number;
  pageBreakBefore?: boolean;
}

/**
 * IndexedDBに保存するプリント本体。
 *
 * unitは単元名ではなく印刷物のNo.として扱う。
 */
export interface LessonPrint {
  id: string;
  title: string;
  subject: string;
  grade: string;
  unit: string;
  paperSize: PaperSize;
  audience: Audience;
  blocks: LessonBlock[];
  typstSource: string;
  createdAt: string;
  updatedAt: string;
}

export type LessonPrintSummary = Pick<
  LessonPrint,
  "id" | "title" | "subject" | "grade" | "unit" | "paperSize" | "createdAt" | "updatedAt"
>;
