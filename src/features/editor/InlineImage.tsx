import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";

/**
 * TipTap本文中に画像を埋め込むためのノード。
 *
 * 画像幅はPDF出力時にも使うため、mm指定をdata属性として保持する。
 */
export const InlineImage = Node.create({
  name: "inlineImage",

  group: "inline",
  inline: true,
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute("src") ?? element.getAttribute("data-src") ?? "",
        renderHTML: (attributes) => ({
          src: attributes.src,
          "data-src": attributes.src,
        }),
      },
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("alt") ?? "",
        renderHTML: (attributes) => ({
          alt: attributes.alt,
        }),
      },
      widthMm: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-width-mm"),
        renderHTML: (attributes) => ({
          "data-width-mm": attributes.widthMm,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-inline-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        "data-inline-image": "true",
        class: "inline-image-node",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineImageView);
  },
});

function InlineImageView({ node, selected }: NodeViewProps) {
  const src = String(node.attrs.src ?? "");
  const alt = String(node.attrs.alt ?? "");
  const widthMm = Number(node.attrs.widthMm);
  const style = Number.isFinite(widthMm) && widthMm > 0 ? { width: `${widthMm}mm` } : undefined;

  return (
    <NodeViewWrapper
      as="span"
      className={`inline-image-node-view${selected ? " selected" : ""}`}
      contentEditable={false}
    >
      {src ? <img src={src} alt={alt} style={style} /> : null}
    </NodeViewWrapper>
  );
}
