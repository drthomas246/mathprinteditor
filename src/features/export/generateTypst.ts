import type { LessonBlock, LessonPrint } from "../../types/lessonPrint";

const inlinePageBreakMarker = "\uE001";

/**
 * 編集データから印刷用Typstソースを生成する。
 *
 * ブロック構造・画像・インライン数式をここで1本化し、
 * プレビューとダウンロードで同じ出力を使えるようにする。
 */
export function generateTypst(print: LessonPrint) {
  const paper = print.paperSize === "b5" ? "jis-b5" : "a4";
  let exampleIndex = 0;
  let exerciseIndex = 0;
  const body = print.blocks
    .map((block) => {
      const blockNumber =
        block.type === "example"
          ? ++exampleIndex
          : block.type === "exercise"
            ? ++exerciseIndex
            : 0;
      const content = renderBlock(block, blockNumber);
      if (!content) return "";
      return block.pageBreakBefore ? `#pagebreak()\n\n${content}` : content;
    })
    .filter(Boolean)
    .join("\n\n#v(2em)\n\n");

  return `#import "@preview/showybox:2.0.4": showybox

#let mathbox(title, body) = showybox(
  title-style: (
    color: black,
    boxed-style: (
      anchor: (x: left, y: horizon),
      radius: (top-left: 5pt, bottom-right: 5pt, rest: 0pt),
    ),
  ),
  frame: (
    title-color: white,
    border-color: black,
    radius: (top-left: 10pt, bottom-right: 10pt, rest: 0pt),
  ),
  title: title,
)[#body]

#let answer-line(width: 45mm) = box(
  width: width,
  height: 0.8em,
  stroke: (bottom: 0.8pt + black),
)

#set page(
  paper: "${paper}",
  margin: (x: 18mm, y: 10mm),
)
#set text(font: ("New Computer Modern", "Noto Serif CJK JP"), size: 10.5pt)
#show heading.where(level: 1): it => block(above: 10pt, below: 6pt, text(size: 13pt, weight: "bold", it.body))
#show heading.where(level: 2): it => block(above: 8pt, below: 5pt, text(size: 11.5pt, weight: "bold", it.body))
#show heading.where(level: 3): it => block(above: 6pt, below: 4pt, text(size: 10.5pt, weight: "bold", it.body))

${renderPrintHeader(print)}

${body}

${renderReflectionBox()}
`;
}

function renderPrintHeader(print: LessonPrint) {
  const printNumber = formatPrintNumber(print.unit);
  return `#grid(columns: (1fr, auto), align: (left, center), [
  #text(size: 18pt, weight: "bold")[${escapeTypst(print.title)}]
], [
  #text(size: 14pt)[${escapeTypst(printNumber)}]
])

#v(5mm)

#align(right)[
  #answer-line(width: 20mm) 組
  #answer-line(width: 20mm) 番
  名前 #answer-line(width: 55mm)
]

#v(5mm)

#grid(columns: (auto, 1fr), column-gutter: 5mm, align: horizon, [
  めあて:
], [
  #answer-line(width: 119mm)
])

#v(5mm)`;
}

/**
 * unitは単元名ではなくプリントNo.として扱うため、No.表記へ正規化する。
 */
function formatPrintNumber(value: string) {
  const number = value.trim().replace(/^No\.?\s*/i, "");
  return `No.${number || "1"}`;
}

function renderReflectionBox() {
  return `#v(1fr)

#grid(
  columns: (1fr, 26mm),
  rows: (8mm, 20mm),
  stroke: black + 0.7pt,
  align: center + horizon,
  [わかったこと],
  [A, B, C],
  [],
  [],
)`;
}

function renderBlock(block: LessonBlock, blockNumber: number) {
  const title = escapeTypst(block.title || block.type);
  const text = renderRichText(block.content);

  switch (block.type) {
    case "heading":
      return `${"=".repeat(block.headingLevel ?? 1)} ${text || title}`;
    case "definition":
      return boxBlock("定義", text, block);
    case "theorem":
      return boxBlock("定理", text, block);
    case "example":
      return numberedBlock("例題", blockNumber, title, text, block);
    case "exercise":
      return numberedBlock("練習問題", blockNumber, title, text, block);
    case "answer":
      return renderAnswer(block);
    case "formula":
      return block.latex ? `$ ${latexToTypstMath(block.latex)} $` : "";
    case "image":
      return renderImage(block);
    case "paragraph":
    default:
      return withOptionalImage(text, block);
  }
}

function boxBlock(label: string, text: string, block: LessonBlock) {
  const segments = splitPageBreakContent(text);
  const boxTitle = escapeTypstTextArgument(`${label}: ${block.title || block.type}`);

  return joinWithPageBreaks(
    segments.map((segment, segmentIndex) => {
      const content = withOptionalImageSegment(segment, block, segmentIndex === segments.length - 1);
      return `#mathbox("${boxTitle}")[
  ${content}
]`;
    }),
  );
}

function numberedBlock(label: string, blockNumber: number, title: string, text: string, block: LessonBlock) {
  const contentSegments =
    block.layout === "two-column"
      ? splitTwoColumnPageBreakContent(text, renderRichText(block.rightContent))
      : splitPageBreakContent(text);

  return joinWithPageBreaks(
    contentSegments.map((segment, segmentIndex) => {
      const content = withOptionalImageSegment(segment, block, segmentIndex === contentSegments.length - 1);
      const heading = segmentIndex === 0 ? `*${label} ${blockNumber}: ${title}*\n\n  ` : "";
      return `#block(above: 7pt, below: 7pt)[
  ${heading}${content}
]`;
    }),
  );
}

function renderAnswer(block: LessonBlock) {
  const answerArea = renderAnswerArea(block);
  const answerContent =
    block.layout === "two-column"
      ? `#grid(columns: (1fr, 1fr), gutter: 10pt, [
  ${answerArea}
], [
  ${answerArea}
])`
      : answerArea;

  return withOptionalImage(answerContent, block);
}

function renderAnswerArea(block: LessonBlock) {
  const height = `${block.height ?? 28}mm`;

  return block.answerStyle === "grid"
    ? `#rect(width: 100%, height: ${height}, stroke: (paint: gray, thickness: 0.5pt), fill: none)`
    : block.answerStyle === "box"
      ? `#rect(width: 100%, height: ${height}, stroke: black + 0.7pt)`
      : `#block(width: 100%, height: ${height})[
  #for i in range(3) [#line(length: 100%) #v(7mm)]
]`;
}

function withOptionalImage(content: string, block: LessonBlock) {
  const segments = splitPageBreakContent(content);
  if (segments.length > 1) {
    return joinWithPageBreaks(
      segments.map((segment, segmentIndex) => {
        return withOptionalImageSegment(segment, block, segmentIndex === segments.length - 1);
      }),
    );
  }

  return withOptionalImageSegment(content, block, true);
}

function withOptionalImageSegment(content: string, block: LessonBlock, includeImage: boolean) {
  if (!includeImage) return content;

  const image = renderImage(block, block.imagePosition === "right" ? "100%" : "80%");
  if (!image) return content;
  if (!content.trim()) return image;
  return composeContentAndImage(content, image, block);
}

/**
 * TipTap上の改ページノードは一時マーカーにしてから、ブロック単位でTypst pagebreakへ戻す。
 */
function splitPageBreakContent(content: string) {
  return content.split(inlinePageBreakMarker);
}

function splitTwoColumnPageBreakContent(left: string, right: string) {
  const leftSegments = splitPageBreakContent(left);
  const rightSegments = splitPageBreakContent(right);
  const segmentCount = Math.max(leftSegments.length, rightSegments.length);

  return Array.from({ length: segmentCount }, (_, index) => {
    return renderTwoColumnRichText(leftSegments[index] ?? "", rightSegments[index] ?? "");
  });
}

function joinWithPageBreaks(segments: string[]) {
  return segments.join("\n\n#pagebreak()\n\n");
}

function composeContentAndImage(content: string, image: string, block: LessonBlock) {
  const position = block.imagePosition;
  if (position === "right") {
    const imageColumnWidth = formatImageWidth(block.imageWidthMm) ?? "42%";
    return `#grid(columns: (1fr, ${imageColumnWidth}), gutter: 12pt, [
  ${content}
], [
  ${image}
])`;
  }

  return `${content}

#v(6pt)
${image}`;
}

function renderTwoColumnRichText(left: string, right: string) {
  return `#grid(columns: (1fr, 1fr), gutter: 10pt, [
  ${left || " "}
], [
  ${right || " "}
])`;
}

function renderImage(block: LessonBlock, width = "80%") {
  const source = block.imageDataUrl || block.imageUrl;
  const imageWidth = formatImageWidth(block.imageWidthMm) ?? width;
  return source ? `#image("${escapeTypst(source)}", width: ${imageWidth})` : "";
}

function formatImageWidth(value: unknown) {
  const widthMm = Number(value);
  return Number.isFinite(widthMm) && widthMm > 0 ? `${widthMm}mm` : null;
}

export type InlineSegment =
  | { type: "text"; value: string }
  | { type: "math"; value: string };

/**
 * エクスポート外の表示や検索で使うため、TipTap JSONをプレーンテキストへ戻す。
 *
 * 数式は$...$として残し、画像と改ページは文字にしない。
 */
export function tiptapToPlainText(content: unknown): string {
  if (!content || typeof content !== "object") {
    return "";
  }

  const node = content as {
    attrs?: { latex?: string };
    text?: string;
    type?: string;
    content?: unknown[];
  };

  if (node.type === "inlineMath") {
    return `$${node.attrs?.latex ?? ""}$`;
  }

  if (node.type === "inlineImage") {
    return "";
  }

  if (node.type === "inlinePageBreak") {
    return "";
  }

  const own = node.text ?? "";
  const childText = node.content?.map(tiptapToPlainText).filter(Boolean) ?? [];
  const separator = node.type === "doc" ? "\n\n" : node.type === "paragraph" ? "" : "\n";

  return [own, childText.join(separator)].filter(Boolean).join("");
}

/**
 * AIや旧データ由来の$...$表記を、TipTapノード由来のインライン数式と同じ区分へ分ける。
 */
export function parseInlineMath(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /\$([^$\n]+)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    segments.push({ type: "math", value: match[1].trim() });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: "text", value: text }];
}

function renderInlineTypst(text: string) {
  return parseInlineMath(text)
    .map((segment) => {
      if (segment.type === "math") {
        return `$${latexToTypstMath(segment.value)}$`;
      }

      return escapeTypst(segment.value);
    })
    .join("");
}

/**
 * TipTap JSONをTypst本文へ変換する。未知ノードは子要素だけを残して本文欠落を避ける。
 */
function renderRichText(content: unknown): string {
  if (!content || typeof content !== "object") {
    return "";
  }

  const node = content as {
    attrs?: { alt?: string; latex?: string; src?: string; widthMm?: number | string | null };
    text?: string;
    type?: string;
    content?: unknown[];
  };

  if (node.type === "text") {
    return renderInlineTypst(node.text ?? "");
  }

  if (node.type === "inlineMath") {
    return `$${latexToTypstMath(node.attrs?.latex ?? "")}$`;
  }

  if (node.type === "inlineImage") {
    const source = node.attrs?.src ?? "";
    const width = formatImageWidth(node.attrs?.widthMm) ?? "42%";
    return source ? `#image("${escapeTypst(source)}", width: ${width})` : "";
  }

  if (node.type === "inlinePageBreak") {
    return inlinePageBreakMarker;
  }

  const children = node.content?.map(renderRichText).filter(Boolean) ?? [];
  if (node.type === "doc") {
    return children.join("\n\n");
  }

  if (node.type === "paragraph") {
    return children.join("");
  }

  if (node.type === "bulletList") {
    return renderListItems(node.content, "-");
  }

  if (node.type === "orderedList") {
    return renderListItems(node.content, "+");
  }

  if (node.type === "listItem") {
    return children.join("\n").trim();
  }

  return children.join("\n");
}

function renderListItems(items: unknown[] | undefined, marker: "-" | "+") {
  return (items ?? [])
    .map((item) => {
      const content = renderRichText(item).trim();
      if (!content) return "";
      return `${marker} ${content.replaceAll("\n", "\n  ")}`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * LaTeX断片をTypst数式へ寄せたあと、幾何ラベルだけ人が読める表記に戻す。
 */
function latexToTypstMath(value: string) {
  return formatGeometryLabels(normalizeTypstMathIdentifiers(convertLatexFragment(value.trim())))
    .replaceAll(/\s+/g, " ")
    .trim();
}

/**
 * Typstでは複数文字識別子が1語扱いになるため、英字列は原則1文字ずつに分ける。
 */
function normalizeTypstMathIdentifiers(value: string) {
  return value.replace(/"[^"\\]*(?:\\.[^"\\]*)*"|[^"]+/g, (part) => {
    if (part.startsWith('"')) {
      return part;
    }

    return part
      .replace(/[A-Za-z]+/g, (word) => {
        if (word.length === 1 || preservedMathWords.has(word)) {
          return word;
        }

        return word.split("").join(" ");
      })
      .replace(/(\d)([A-Za-z])/g, "$1 $2")
      .replace(/([A-Za-z])(\d)/g, "$1 $2");
  });
}

/**
 * 中学数学の図形記号はTypstの通常識別子と衝突しやすいので、点名を文字列として固定する。
 */
function formatGeometryLabels(value: string) {
  const label = (letters: string) => `"${letters.replaceAll(/\s+/g, "")}"`;
  const pointLabel = "((?:[A-Z]\\s*){1,4})";

  return value
    .replaceAll("∽", similaritySymbolPlaceholder)
    .replace(new RegExp(`\\u2220\\s*${pointLabel}`, "g"), (_, letters: string) => `∠ ${label(letters)}`)
    .replace(new RegExp(`\\u25b3\\s*${pointLabel}`, "g"), (_, letters: string) => `△ ${label(letters)}`)
    .replace(new RegExp(`\\u2312\\s*${pointLabel}`, "g"), (_, letters: string) => `overparen(${label(letters)})`)
    .replace(new RegExp(`#text\\("⌒"\\)\\s*${pointLabel}`, "g"), (_, letters: string) => {
      return `overparen(${label(letters)})`;
    })
    .replace(new RegExp(`\\u25b1\\s*${pointLabel}`, "g"), (_, letters: string) => {
      return `parallelogram.stroked ${label(letters)}`;
    })
    .replace(new RegExp(`#text\\("▱"\\)\\s*${pointLabel}`, "g"), (_, letters: string) => {
      return `parallelogram.stroked ${label(letters)}`;
    })
    .replace(new RegExp(`parallelogram\\.stroked\\s*${pointLabel}`, "g"), (_, letters: string) => {
      return `parallelogram.stroked ${label(letters)}`;
    })
    .replace(
      new RegExp(`${pointLabel}\\s*\\u2225\\s*${pointLabel}`, "g"),
      (_, left: string, right: string) => `${label(left)} #text("//") ${label(right)}`,
    )
    .replace(
      new RegExp(`${pointLabel}\\s*#text\\("\\s*//\\s*"\\)\\s*${pointLabel}`, "g"),
      (_, left: string, right: string) => `${label(left)} #text("//") ${label(right)}`,
    )
    .replace(
      new RegExp(`${pointLabel}\\s*\\u22a5\\s*${pointLabel}`, "g"),
      (_, left: string, right: string) => `${label(left)} ⊥ ${label(right)}`,
    )
    .replace(new RegExp(`\\u2245\\s*${pointLabel}`, "g"), (_, letters: string) => `≅ ${label(letters)}`)
    .replaceAll(similaritySymbolPlaceholder, similaritySymbolTypst);
}

/**
 * 完全なLaTeXではなく、授業プリントで使う断片だけをTypstへ安全に写す。
 */
function convertLatexFragment(value: string): string {
  const cases = convertLatexCases(value);
  if (cases !== null) return cases;

  let output = "";
  let index = 0;

  while (index < value.length) {
    const current = value[index];

    if (current === "^" || current === "_") {
      // Typstでは複数文字の上下付きに括弧が必要なため、LaTeX引数を読み切って包む。
      const argument = readLatexArgument(value, index + 1);
      output += `${current}(${convertLatexFragment(argument.value)})`;
      index = argument.nextIndex;
      continue;
    }

    if (current !== "\\") {
      output += current;
      index += 1;
      continue;
    }

    const parsed = readLatexCommand(value, index);
    index = parsed.nextIndex;

    if (parsed.command === "frac" || parsed.command === "dfrac" || parsed.command === "tfrac") {
      const numerator = readLatexArgument(value, index);
      const denominator = readLatexArgument(value, numerator.nextIndex);
      output += `frac(${convertLatexFragment(numerator.value)}, ${convertLatexFragment(denominator.value)})`;
      index = denominator.nextIndex;
      continue;
    }

    if (parsed.command === "sqrt") {
      const radicand = readLatexArgument(value, index);
      output += `sqrt(${convertLatexFragment(radicand.value)})`;
      index = radicand.nextIndex;
      continue;
    }

    if (
      parsed.command === "arc" ||
      parsed.command === "overgroup" ||
      parsed.command === "overparen" ||
      parsed.command === "wideparen"
    ) {
      const arc = readLatexArgument(value, index);
      output += `overparen(${formatArcArgument(arc.value)})`;
      index = arc.nextIndex;
      continue;
    }

    if (parsed.command === "overset" || parsed.command === "stackrel") {
      const above = readLatexArgument(value, index);
      const below = readLatexArgument(value, above.nextIndex);
      if (isArcAccent(above.value)) {
        output += below.value.trim() ? `overparen(${formatArcArgument(below.value)})` : "";
      } else {
        output += convertLatexFragment(below.value);
      }
      index = below.nextIndex;
      continue;
    }

    if (parsed.command === "parallelogram") {
      const nextIndex = skipSpaces(value, index);
      if (value[nextIndex] === "{") {
        const parallelogram = readLatexArgument(value, nextIndex);
        output += `parallelogram.stroked ${formatPointLabelArgument(parallelogram.value)}`;
        index = parallelogram.nextIndex;
      } else {
        output += latexCommandMap[parsed.command];
      }
      continue;
    }

    if (parsed.command === "text") {
      const text = readLatexArgument(value, index);
      output += renderTextCommand(text.value);
      index = text.nextIndex;
      continue;
    }

    if (parsed.command === "left" || parsed.command === "right") {
      continue;
    }

    if (parsed.command === "not" && value[index] === "=") {
      output += "≠";
      index += 1;
      continue;
    }

    output += latexCommandMap[parsed.command] ?? parsed.command;
  }

  return output;
}

function escapeTypstTextArgument(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function renderTextCommand(value: string) {
  const trimmed = value.trim();
  if (trimmed === "∽") {
    return similaritySymbolPlaceholder;
  }

  return `#text("${escapeTypstTextArgument(value)}")`;
}

function convertLatexCases(value: string) {
  const match = value.match(/^\\begin\{cases\}([\s\S]*)\\end\{cases\}$/);
  if (!match) return null;

  const rows = match[1]
    .split(/\\\\/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => convertLatexFragment(row));

  return `display(cases(${rows.join(", ")}))`;
}

function readLatexCommand(value: string, startIndex: number) {
  let index = startIndex + 1;
  let command = "";

  while (index < value.length && /[A-Za-z]/.test(value[index])) {
    command += value[index];
    index += 1;
  }

  if (!command && index < value.length) {
    command = value[index];
    index += 1;
  }

  return { command, nextIndex: index };
}

/**
 * \frac{...}{...} のような入れ子も壊さないよう、波括弧の深さを見て引数を読む。
 */
function readLatexArgument(value: string, startIndex: number) {
  let index = skipSpaces(value, startIndex);

  if (value[index] === "{") {
    let depth = 1;
    let cursor = index + 1;

    while (cursor < value.length && depth > 0) {
      if (value[cursor] === "{") depth += 1;
      if (value[cursor] === "}") depth -= 1;
      cursor += 1;
    }

    return {
      value: value.slice(index + 1, cursor - 1),
      nextIndex: cursor,
    };
  }

  if (value[index] === "\\") {
    const command = readLatexCommand(value, index);
    return {
      value: `\\${command.command}`,
      nextIndex: command.nextIndex,
    };
  }

  return {
    value: value[index] ?? "",
    nextIndex: Math.min(index + 1, value.length),
  };
}

function skipSpaces(value: string, startIndex: number) {
  let index = startIndex;
  while (index < value.length && /\s/.test(value[index])) {
    index += 1;
  }
  return index;
}

const latexCommandMap: Record<string, string> = {
  alpha: "alpha",
  beta: "beta",
  gamma: "gamma",
  delta: "delta",
  epsilon: "epsilon",
  theta: "theta",
  lambda: "lambda",
  mu: "mu",
  pi: "pi",
  sigma: "sigma",
  phi: "phi",
  omega: "omega",
  Gamma: "Gamma",
  Delta: "Delta",
  Theta: "Theta",
  Lambda: "Lambda",
  Pi: "Pi",
  Sigma: "Sigma",
  Phi: "Phi",
  Omega: "Omega",
  cdot: " dot ",
  times: " times ",
  div: " div ",
  le: "≦",
  leq: "≦",
  ge: "≧",
  geq: "≧",
  neq: "≠",
  ne: "≠",
  equiv: "≡",
  pm: "±",
  mp: " minus.plus ",
  approx: "≒",
  fallingdotseq: "≒",
  infty: "infinity",
  angle: "∠",
  triangle: "△",
  parallelogram: "parallelogram.stroked",
  parallel: "∥",
  perp: "⊥",
  cong: "≅",
  circ: "degree",
};

const preservedMathWords = new Set([
  "frac",
  "sqrt",
  "cases",
  "display",
  "text",
  "abs",
  "sin",
  "cos",
  "tan",
  "log",
  "ln",
  "lim",
  "min",
  "max",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "theta",
  "lambda",
  "mu",
  "pi",
  "sigma",
  "phi",
  "omega",
  "Gamma",
  "Delta",
  "Theta",
  "Lambda",
  "Pi",
  "Sigma",
  "Phi",
  "Omega",
  "dot",
  "times",
  "div",
  "plus",
  "minus",
  "infinity",
  "degree",
  "overparen",
  "parallelogram",
  "stroked",
]);

const similaritySymbolTypst = "$ ∽ $";
const similaritySymbolPlaceholder = "\uE000";

function formatArcArgument(value: string) {
  const compactPointLabel = value.replaceAll(/\s+/g, "");
  if (/^[A-Z]{1,4}$/.test(compactPointLabel)) {
    return `"${compactPointLabel}"`;
  }

  return convertLatexFragment(value);
}

function isArcAccent(value: string) {
  return /^(?:\\frown|\\text\{⌒\}|⌒)$/.test(value.trim());
}

function formatPointLabelArgument(value: string) {
  const compactPointLabel = value.replaceAll(/\s+/g, "");
  if (/^[A-Z]{1,4}$/.test(compactPointLabel)) {
    return `"${compactPointLabel}"`;
  }

  return convertLatexFragment(value);
}

function escapeTypst(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("#", "\\#")
    .replaceAll("$", "\\$");
}
