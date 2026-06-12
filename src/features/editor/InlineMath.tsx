import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { configureJuniorHighMathMenu, normalizeMathEditorLatex } from "./mathMenu";

/**
 * TipTap本文中に埋め込む数式ノード。
 *
 * atomとして扱い、本文編集とMathLive編集が互いにカーソルを壊さないようにする。
 */
export const InlineMath = Node.create({
  name: "inlineMath",

  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex") ?? "",
        renderHTML: (attributes) => ({
          "data-latex": attributes.latex,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-inline-math]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-inline-math": "true",
        class: "inline-math-node",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView);
  },
});

function InlineMathView({ node, updateAttributes, selected }: NodeViewProps) {
  const mathRef = useRef<HTMLElement | null>(null);
  const latex = String(node.attrs.latex ?? "");

  useEffect(() => {
    const mathField = mathRef.current as (HTMLElement & { value?: string }) | null;
    if (!mathField) return;

    configureJuniorHighMathMenu(mathField);

    // 表示値と保存値を同じ正規化ルールに通し、エディタ間の表記ゆれを避ける。
    const normalizedLatex = normalizeMathEditorLatex(latex);
    if (mathField.value !== normalizedLatex) {
      mathField.value = normalizedLatex;
    }

    const handleInput = () => {
      const normalizedValue = normalizeMathEditorLatex(mathField.value ?? "");
      if (mathField.value !== normalizedValue) {
        mathField.value = normalizedValue;
      }
      updateAttributes({ latex: normalizedValue });
    };

    mathField.addEventListener("input", handleInput);
    mathField.addEventListener("change", handleInput);

    return () => {
      mathField.removeEventListener("input", handleInput);
      mathField.removeEventListener("change", handleInput);
    };
  }, [latex, updateAttributes]);

  return (
    <NodeViewWrapper
      as="span"
      className={`inline-math-node-view${selected ? " selected" : ""}`}
      contentEditable={false}
    >
      <math-field ref={mathRef} className="inline-math-field" />
    </NodeViewWrapper>
  );
}
