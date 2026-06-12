import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { FilePlus2, GripVertical, ImagePlus, Sigma, Trash2 } from "lucide-react";
import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { LessonBlock } from "../../types/lessonPrint";
import { InlineImage } from "./InlineImage";
import { InlineMath } from "./InlineMath";
import { InlinePageBreak } from "./InlinePageBreak";
import { configureJuniorHighMathMenu, normalizeMathEditorLatex } from "./mathMenu";

interface BlockEditorProps {
  block: LessonBlock;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onChange: (block: LessonBlock) => void;
  onDelete: () => void;
  onDragStart?: () => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
}

const blocksWithInlineImages = new Set<LessonBlock["type"]>([
  "paragraph",
  "definition",
  "theorem",
]);
const blocksWithFreeImages = new Set<LessonBlock["type"]>(["example", "exercise"]);

const blocksWithColumnLayout = new Set<LessonBlock["type"]>(["example", "exercise", "answer"]);
const blocksWithInlinePageBreak = new Set<LessonBlock["type"]>(["example", "exercise", "paragraph"]);
const emptyDoc = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * 旧形式のanswer文字列もTipTapで編集できるよう、最小docへ変換する。
 */
function textToDoc(text = "") {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : undefined }],
  };
}

export function BlockEditor({
  block,
  isDragging = false,
  isDropTarget = false,
  onChange,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: BlockEditorProps) {
  const mathRef = useRef<HTMLElement | null>(null);
  const inlineMathRef = useRef<HTMLElement | null>(null);
  const latestBlockRef = useRef(block);
  const latestOnChangeRef = useRef(onChange);
  const [inlineLatex, setInlineLatex] = useState("");
  const [inlineImageWidthMm, setInlineImageWidthMm] = useState(45);
  const [activeEditorSide, setActiveEditorSide] = useState<"left" | "right">("left");

  // TipTapのonUpdateは初期化時のpropsを握りがちなので、保存先だけ常に最新参照へ逃がす。
  useEffect(() => {
    latestBlockRef.current = block;
    latestOnChangeRef.current = onChange;
  }, [block, onChange]);

  const editor = useEditor({
    extensions: [StarterKit, InlineMath, InlineImage, InlinePageBreak],
    content: (block.type === "answer" ? (block.answerContent ?? textToDoc(block.answer)) : block.content) as never,
    immediatelyRender: false,
    onUpdate({ editor: tiptap }) {
      const latestBlock = latestBlockRef.current;
      latestOnChangeRef.current(
        latestBlock.type === "answer"
          ? {
              ...latestBlock,
              answer: tiptap.getText(),
              answerContent: tiptap.getJSON(),
            }
          : {
              ...latestBlock,
              content: tiptap.getJSON(),
            },
      );
    },
  });

  const rightEditor = useEditor({
    extensions: [StarterKit, InlineMath, InlineImage, InlinePageBreak],
    content: (block.type === "answer"
      ? (block.rightAnswerContent ?? textToDoc(block.rightAnswer))
      : (block.rightContent ?? emptyDoc)) as never,
    immediatelyRender: false,
    onUpdate({ editor: tiptap }) {
      const latestBlock = latestBlockRef.current;
      latestOnChangeRef.current(
        latestBlock.type === "answer"
          ? {
              ...latestBlock,
              rightAnswer: tiptap.getText(),
              rightAnswerContent: tiptap.getJSON(),
            }
          : {
              ...latestBlock,
              rightContent: tiptap.getJSON(),
            },
      );
    },
  });

  useEffect(() => {
    if (!editor) return;

    // 外側の状態が変わったときだけTipTapへ反映し、入力中のカーソル移動や二重保存を避ける。
    const current = JSON.stringify(editor.getJSON());
    const nextContent = block.type === "answer" ? (block.answerContent ?? textToDoc(block.answer)) : block.content;
    const next = JSON.stringify(nextContent);
    if (current !== next) {
      editor.commands.setContent(nextContent as never, { emitUpdate: false });
    }
  }, [block.answer, block.answerContent, block.content, block.type, editor]);

  useEffect(() => {
    if (!rightEditor) return;

    // 2段組の右側も左側と同じ同期規則にして、片側だけ古い内容に戻る事故を防ぐ。
    const current = JSON.stringify(rightEditor.getJSON());
    const nextContent =
      block.type === "answer" ? (block.rightAnswerContent ?? textToDoc(block.rightAnswer)) : (block.rightContent ?? emptyDoc);
    const next = JSON.stringify(nextContent);
    if (current !== next) {
      rightEditor.commands.setContent(nextContent as never, { emitUpdate: false });
    }
  }, [block.rightAnswer, block.rightAnswerContent, block.rightContent, block.type, rightEditor]);

  useEffect(() => {
    const mathField = mathRef.current as (HTMLElement & { value?: string }) | null;
    if (!mathField) return;

    configureJuniorHighMathMenu(mathField);

    // MathLiveは独自要素なので、Reactのvalue制御ではなくイベントで同期する。
    const normalizedLatex = normalizeMathEditorLatex(block.latex ?? "");
    if (mathField.value !== normalizedLatex) {
      mathField.value = normalizedLatex;
    }

    const handleInput = () => {
      const normalizedValue = normalizeMathEditorLatex(mathField.value ?? "");
      if (mathField.value !== normalizedValue) {
        mathField.value = normalizedValue;
      }
      onChange({ ...latestBlockRef.current, latex: normalizedValue });
    };
    mathField.addEventListener("input", handleInput);
    mathField.addEventListener("change", handleInput);

    return () => {
      mathField.removeEventListener("input", handleInput);
      mathField.removeEventListener("change", handleInput);
    };
  }, [block.latex, onChange]);

  useEffect(() => {
    const mathField = inlineMathRef.current as (HTMLElement & { value?: string }) | null;
    if (!mathField) return;

    configureJuniorHighMathMenu(mathField);

    const normalizedLatex = normalizeMathEditorLatex(inlineLatex);
    if (mathField.value !== normalizedLatex) {
      mathField.value = normalizedLatex;
    }

    const handleInput = () => {
      const normalizedValue = normalizeMathEditorLatex(mathField.value ?? "");
      if (mathField.value !== normalizedValue) {
        mathField.value = normalizedValue;
      }
      setInlineLatex(normalizedValue);
    };

    mathField.addEventListener("input", handleInput);
    mathField.addEventListener("change", handleInput);

    return () => {
      mathField.removeEventListener("input", handleInput);
      mathField.removeEventListener("change", handleInput);
    };
  }, [inlineLatex]);

  const isFormula = block.type === "formula";
  const isAnswer = block.type === "answer";
  const isImage = block.type === "image";
  const canUseRichText = !isFormula && !isAnswer && !isImage;
  const canAttachImage = blocksWithInlineImages.has(block.type);
  const canInsertFreeImage = blocksWithFreeImages.has(block.type);
  const canUseColumnLayout = blocksWithColumnLayout.has(block.type);
  const canInsertPageBreak = blocksWithInlinePageBreak.has(block.type);
  const isTwoColumn = block.layout === "two-column";

  /**
   * 現在フォーカスしている本文エディタへインライン数式を挿入する。
   */
  function insertInlineMath(latex = inlineLatex) {
    const targetEditor = activeEditorSide === "right" ? rightEditor : editor;
    if (!targetEditor || !latex.trim()) return;

    targetEditor
      .chain()
      .focus()
      .insertContent([
        { type: "inlineMath", attrs: { latex: latex.trim() } },
        { type: "text", text: " " },
      ] as never)
      .run();
  }

  /**
   * 現在フォーカスしている本文エディタへPDF用の改ページ目印を挿入する。
   */
  function insertInlinePageBreak() {
    const targetEditor = activeEditorSide === "right" ? rightEditor : editor;
    if (!targetEditor) return;

    targetEditor
      .chain()
      .focus()
      .insertContent([
        { type: "inlinePageBreak" },
        { type: "text", text: " " },
      ] as never)
      .run();
  }

  /**
   * 選択した画像をdata URL化し、現在の本文位置へインライン画像として挿入する。
   */
  function insertInlineImage(file: File) {
    const targetEditor = activeEditorSide === "right" ? rightEditor : editor;
    if (!targetEditor) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      // PDFへそのまま渡せるよう、外部URLではなくdata URLを本文ノードに保存する。
      targetEditor
        .chain()
        .focus()
        .insertContent([
          {
            type: "inlineImage",
            attrs: { src: reader.result, alt: file.name, widthMm: inlineImageWidthMm },
          },
          { type: "text", text: " " },
        ] as never)
        .run();
    });
    reader.readAsDataURL(file);
  }

  /**
   * ファイル入力を毎回リセットし、同じ画像を続けて選び直せるようにする。
   */
  function handleInlineImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      insertInlineImage(file);
    }
  }

  /**
   * ブロックに添付する画像をローカル保存できるdata URLへ変換する。
   */
  function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      // ブロック画像もローカル保存できるよう、ファイル名とdata URLを分けて保持する。
      onChange({
        ...latestBlockRef.current,
        imageDataUrl: reader.result,
        imageUrl: file.name,
      });
    });
    reader.readAsDataURL(file);
  }

  /**
   * ブロック画像の配置・ファイル・幅を編集するコントロールを描画する。
   */
  function renderImageControls(showPosition: boolean) {
    return (
      <div className="image-editor">
        <div className="image-options">
          {showPosition ? (
            <label>
              挿入先
              <select
                value={block.imagePosition ?? "bottom"}
                onChange={(event) =>
                  onChange({ ...block, imagePosition: event.target.value as LessonBlock["imagePosition"] })
                }
              >
                <option value="bottom">文字の下側</option>
                <option value="right">文字の右側</option>
              </select>
            </label>
          ) : null}
          <label>
            画像ファイル
            <input type="file" accept="image/*" onChange={handleImageFileChange} aria-label="画像ファイル" />
          </label>
          <label>
            幅(mm)
            <input
              type="number"
              min={5}
              max={180}
              value={block.imageWidthMm ?? ""}
              onChange={(event) => {
                const nextWidth = event.target.value ? Number(event.target.value) : undefined;
                onChange({ ...block, imageWidthMm: nextWidth });
              }}
              placeholder="例: 60"
              aria-label="画像幅(mm)"
            />
          </label>
        </div>
        {block.imageDataUrl ? <img src={block.imageDataUrl} alt="" /> : null}
      </div>
    );
  }

  /**
   * リッチテキスト本文へ数式・改ページ・画像を挿入するツールバーを描画する。
   */
  function renderRichTextToolbar() {
    return (
      <div className="rich-text-toolbar">
        <div className="inline-math-toolbar">
          <label className="inline-math-input">
            <span>
              <Sigma size={16} />
              文中数式
            </span>
            <math-field ref={inlineMathRef} className="inline-toolbar-math-field" />
          </label>
          <button type="button" onClick={() => insertInlineMath()}>
            挿入
          </button>
        </div>
        {canInsertPageBreak ? (
          <button type="button" className="inline-page-break-button" onClick={insertInlinePageBreak}>
            <FilePlus2 size={17} />
            改ページ
          </button>
        ) : null}
        {canInsertFreeImage ? (
          <div className="inline-image-tools">
            <label className="inline-image-width">
              幅(mm)
              <input
                type="number"
                min={5}
                max={180}
                value={inlineImageWidthMm}
                onChange={(event) => setInlineImageWidthMm(Number(event.target.value) || 45)}
                aria-label="文中画像幅(mm)"
              />
            </label>
            <label className="button inline-file-button">
              <ImagePlus size={17} />
              画像
              <input type="file" accept="image/*" onChange={handleInlineImageFileChange} />
            </label>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section
      className={`block-editor block-${block.type}${isDragging ? " is-dragging" : ""}${
        isDropTarget ? " is-drop-target" : ""
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="block-toolbar">
        <button
          type="button"
          className="icon-button drag-handle"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", block.id);
            onDragStart?.();
          }}
          onDragEnd={onDragEnd}
          title="並べ替え"
          aria-label="並べ替え"
        >
          <GripVertical size={18} aria-hidden />
        </button>
        <input
          value={block.title}
          onChange={(event) => onChange({ ...block, title: event.target.value })}
          aria-label="ブロック名"
        />
        {block.type === "heading" && (
          <select
            value={block.headingLevel ?? 1}
            onChange={(event) =>
              onChange({ ...block, headingLevel: Number(event.target.value) as 1 | 2 | 3 })
            }
            aria-label="見出しレベル"
          >
            <option value={1}>大</option>
            <option value={2}>中</option>
            <option value={3}>小</option>
          </select>
        )}
        {canUseColumnLayout ? (
          <select
            value={block.layout ?? "single"}
            onChange={(event) =>
              onChange({ ...block, layout: event.target.value as LessonBlock["layout"] })
            }
            aria-label="段組"
            title="段組"
          >
            <option value="single">1段</option>
            <option value="two-column">左右2段</option>
          </select>
        ) : null}
        <label className="page-break-toggle">
          <input
            type="checkbox"
            checked={Boolean(block.pageBreakBefore)}
            onChange={(event) => onChange({ ...block, pageBreakBefore: event.target.checked })}
          />
          改ページ
        </label>
        <button type="button" className="icon-button danger" onClick={onDelete} title="削除">
          <Trash2 size={17} />
        </button>
      </div>

      {isFormula ? (
        <div className="formula-editor">
          <math-field ref={mathRef} className="math-field" />
          <label>
            <span>
              <Sigma size={16} />
              LaTeX
            </span>
            <input
              value={block.latex ?? ""}
              onChange={(event) => onChange({ ...block, latex: event.target.value })}
              placeholder="x^2 + 2x + 1 = 0"
              aria-label="LaTeX"
            />
          </label>
          <div className="formula-snippets">
            {[
              "x^2 + 2x + 1 = 0",
              "\\frac{a}{b}",
              "\\sqrt{x}",
              "\\angle ABC = 60^\\circ",
              "\\overset{\\frown}{AB}",
              "\\text{▱}ABCD",
            ].map(
              (latex) => (
                <button key={latex} type="button" onClick={() => onChange({ ...block, latex })}>
                  {latex}
                </button>
              ),
            )}
          </div>
        </div>
      ) : isAnswer ? (
        <>
          {renderRichTextToolbar()}
          {isTwoColumn && canUseColumnLayout ? (
            <div className="answer-teacher-columns">
              <label>
                <span>左段の教師用解答</span>
                <EditorContent
                  editor={editor}
                  className="tiptap-surface answer-teacher-editor"
                  onFocusCapture={() => setActiveEditorSide("left")}
                />
              </label>
              <label>
                <span>右段の教師用解答</span>
                <EditorContent
                  editor={rightEditor}
                  className="tiptap-surface answer-teacher-editor"
                  onFocusCapture={() => setActiveEditorSide("right")}
                />
              </label>
            </div>
          ) : (
            <EditorContent
              editor={editor}
              className="tiptap-surface answer-teacher-editor"
              onFocusCapture={() => setActiveEditorSide("left")}
            />
          )}
          <div className="answer-options">
            <select
              value={block.answerStyle ?? "lines"}
              onChange={(event) =>
                onChange({ ...block, answerStyle: event.target.value as LessonBlock["answerStyle"] })
              }
              aria-label="解答欄の種類"
            >
              <option value="lines">横線</option>
              <option value="box">記述ボックス</option>
              <option value="grid">方眼</option>
            </select>
            <label>
              高さ(mm)
              <input
                type="number"
                min={12}
                max={120}
                value={block.height ?? 28}
                onChange={(event) => onChange({ ...block, height: Number(event.target.value) })}
                aria-label="解答欄の高さ(mm)"
              />
            </label>
          </div>
        </>
      ) : isImage ? (
        renderImageControls(false)
      ) : (
        <>
          {canUseRichText ? (
            renderRichTextToolbar()
          ) : null}
          {isTwoColumn && canUseColumnLayout ? (
            <div className="column-editors">
              <label>
                <span>左段</span>
                <EditorContent
                  editor={editor}
                  className="tiptap-surface"
                  onFocusCapture={() => setActiveEditorSide("left")}
                />
              </label>
              <label>
                <span>右段</span>
                <EditorContent
                  editor={rightEditor}
                  className="tiptap-surface"
                  onFocusCapture={() => setActiveEditorSide("right")}
                />
              </label>
            </div>
          ) : (
            <EditorContent
              editor={editor}
              className="tiptap-surface"
              onFocusCapture={() => setActiveEditorSide("left")}
            />
          )}
          {canAttachImage ? renderImageControls(true) : null}
        </>
      )}
    </section>
  );
}
