import type { BlockPreset } from "../../types/editor";

// エディタ左側の追加パレットに出すブロック候補。表示順も授業プリントの自然な作成順に寄せる。
export const blockPresets: BlockPreset[] = [
  { type: "heading", label: "見出し", description: "単元や節の区切り" },
  { type: "definition", label: "定義", description: "用語や概念の説明" },
  { type: "theorem", label: "定理", description: "性質や公式の提示" },
  { type: "example", label: "例題", description: "解き方を示す問題" },
  { type: "exercise", label: "練習問題", description: "生徒が解く問題" },
  { type: "answer", label: "解答欄", description: "横線・枠・方眼" },
  { type: "formula", label: "数式", description: "MathLiveで入力" },
  { type: "paragraph", label: "段落", description: "補足説明や導入文" },
  { type: "image", label: "画像", description: "図や写真のURL" },
];
