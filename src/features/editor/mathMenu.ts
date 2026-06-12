type MathMenuItem =
  | {
      type?: "command";
      label: string;
      onMenuSelect: (event: { target: EventTarget | undefined }) => void;
    }
  | { type: "divider" }
  | { type: "heading"; label: string }
  | { type: "submenu"; label: string; submenu: readonly MathMenuItem[] };

type MathfieldWithMenu = HTMLElement & {
  insert?: (latex: string, options?: { focus?: boolean }) => boolean;
  macros?: Record<string, string | { def: string; args?: number; expand?: boolean }>;
  menuItems?: readonly MathMenuItem[];
  popoverPolicy?: "auto" | "off";
  smartMode?: boolean;
  value?: string;
};

/**
 * MathLiveのメニュー選択結果を通常のinput/changeとして流し、React側の保存処理に乗せる。
 */
function insertLatex(target: EventTarget | undefined, latex: string) {
  const mathField = target as MathfieldWithMenu | undefined;
  if (!mathField) return;

  if (typeof mathField.insert === "function") {
    mathField.insert(latex, { focus: true });
  } else {
    mathField.value = `${mathField.value ?? ""}${latex}`;
  }

  mathField.dispatchEvent(new Event("input", { bubbles: true }));
  mathField.dispatchEvent(new Event("change", { bubbles: true }));
}

function command(label: string, latex: string): MathMenuItem {
  return {
    label,
    onMenuSelect: ({ target }) => insertLatex(target, latex),
  };
}

const juniorHighMathMenuItems: readonly MathMenuItem[] = [
  {
    type: "submenu",
    label: "計算で使う形",
    submenu: [
      command("2乗  x²", "x^2"),
      command("下付き  x₁", "x_1"),
      command("分数  1/2", "\\frac{1}{2}"),
      command("平方根  √x", "\\sqrt{x}"),
      command("かっこ  (x+1)²", "(x+1)^2"),
    ],
  },
  {
    type: "submenu",
    label: "方程式・関数",
    submenu: [
      command("一次方程式  ax+b=0", "ax+b=0"),
      command("連立方程式  2段", "\\begin{cases}x+y=1\\\\2x-y=3\\end{cases}"),
      command("比例  y=ax", "y=ax"),
      command("一次関数  y=ax+b", "y=ax+b"),
      command("2乗に比例する関数  y=ax²", "y=ax^2"),
      command("反比例  y=a/x", "y=\\frac{a}{x}"),
      command("比  a:b=c:d", "a:b=c:d"),
    ],
  },
  {
    type: "submenu",
    label: "図形",
    submenu: [
      command("角  ∠ABC", "\\angle ABC"),
      command("三角形  △ABC", "\\triangle ABC"),
      command("弧  AB", "\\overset{\\frown}{AB}"),
      command("平行四辺形  ABCD", "\\text{▱}ABCD"),
      command("平行  AB // CD", "AB \\text{ // } CD"),
      command("垂直  AB ⊥ CD", "AB \\perp CD"),
      command("合同  △ABC ≡ △CDF", "\\triangle ABC \\equiv \\triangle CDF"),
      command("相似  △ABC ∽ △DEF", "\\triangle ABC \\text{∽} \\triangle DEF"),
      command("円周率  π", "\\pi"),
      command("度  60°", "60^\\circ"),
    ],
  },
  {
    type: "submenu",
    label: "比較記号",
    submenu: [
      command("等しくない  &#x2260;", "\\not="),
      command("以下  &#x2266;", "\\le"),
      command("以上  &#x2267;", "\\ge"),
      command("プラスマイナス  &#x00b1;", "\\pm"),
      command("およそ等しい  &#x2252;", "≒"),
    ],
  },
];

/**
 * 中学数学でよく使う記号だけに絞ったMathLiveメニューを設定する。
 *
 * MathLiveの初期化タイミングが遅れることがあるため、失敗時はmountイベントで再試行する。
 */
export function configureJuniorHighMathMenu(mathField: HTMLElement | null) {
  const apply = () => {
    const field = mathField as MathfieldWithMenu | null;
    if (!field) return;

    field.macros = {
      ...(field.macros ?? {}),
      arc: { def: "\\overset{\\frown}{#1}", args: 1 },
      overgroup: { def: "\\overset{\\frown}{#1}", args: 1 },
      overparen: { def: "\\overset{\\frown}{#1}", args: 1 },
      parallelogram: "\\text{▱}",
    };
    field.menuItems = juniorHighMathMenuItems;
    field.popoverPolicy = "off";
    field.smartMode = true;
  };

  try {
    apply();
  } catch {
    mathField?.addEventListener("mount", apply, { once: true });
  }
}

/**
 * 入力ゆれを保存前にそろえ、Typst変換側が扱うLaTeXの形を少なくする。
 */
export function normalizeMathEditorLatex(value: string) {
  return value
    .replaceAll(/\\(?:arc|overgroup|overparen)\{\s*\}/g, "")
    .replaceAll(/\\(?:arc|overgroup|overparen)\{([^{}]*)\}/g, "\\overset{\\frown}{$1}")
    .replaceAll(/\\(?:overset|stackrel)\{\\frown\}\{\s*\}/g, "")
    .replaceAll(/\\(?:overset|stackrel)\{⌒\}\{\s*\}/g, "")
    .replaceAll(/\\(?:overset|stackrel)\{\\text\{⌒\}\}\{\s*\}/g, "")
    .replaceAll(/\\text\{⌒\}\s*([A-Z]{1,4})/g, "\\overset{\\frown}{$1}")
    .replaceAll(/⌒\s*([A-Z]{1,4})/g, "\\overset{\\frown}{$1}")
    .replaceAll(/\\parallelogram\{([^{}]*)\}/g, "\\text{▱}$1")
    .replaceAll(/\\parallelogram\s*([A-Z]{1,4})/g, "\\text{▱}$1")
    .replaceAll(/\\parallel\s*ogram\s*([A-Z]{1,4})/g, "\\text{▱}$1")
    .replaceAll("≠", "\\not=")
    .replaceAll("\\ne", "\\not=")
    .replaceAll("\\neq", "\\not=")
    .replaceAll("\\parallel", "\\text{ // }")
    .replaceAll("\\text{//}", "\\text{ // }");
}
