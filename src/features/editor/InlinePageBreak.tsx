import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";

/**
 * 本文内の任意位置でPDF改ページを指定するノード。
 *
 * TipTap上では目印を表示し、Typst変換時にpagebreakへ置き換える。
 */
export const InlinePageBreak = Node.create({
  name: "inlinePageBreak",

  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "span[data-inline-page-break]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-inline-page-break": "true",
        class: "inline-page-break-node",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlinePageBreakView);
  },
});

function InlinePageBreakView({ selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="span"
      className={`inline-page-break-node-view${selected ? " selected" : ""}`}
      contentEditable={false}
    >
      改ページ
    </NodeViewWrapper>
  );
}
