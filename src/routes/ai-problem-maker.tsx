import { Clipboard, ExternalLink, FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { saveLessonPrint } from "../features/storage/db";
import { normalizeImportedPrint } from "../features/storage/importLessonPrint";

type OutputTarget = "summary" | "definition" | "theorem" | "example" | "q" | "try" | "exercise";
type HintLevel = "ヒント多め" | "ヒント少なめ" | "ヒントなし";

const outputTargetLabels: Record<OutputTarget, string> = {
  summary: "まとめ",
  definition: "定義",
  theorem: "定理",
  example: "例題",
  q: "Q",
  try: "TRY",
  exercise: "練習問題",
};

const allOutputTargets: OutputTarget[] = ["summary", "definition", "theorem", "example", "q", "try", "exercise"];

export default function AiProblemMakerRoute() {
  const navigate = useNavigate();
  const [grade, setGrade] = useState("中学3年");
  const [pageRange, setPageRange] = useState("p.");
  const [printNumber, setPrintNumber] = useState("1");
  const [hintLevel, setHintLevel] = useState<HintLevel>("ヒント少なめ");
  const [includeExampleHints, setIncludeExampleHints] = useState(true);
  const [outputTargets, setOutputTargets] = useState<OutputTarget[]>(allOutputTargets);
  const [aiAnswer, setAiAnswer] = useState("");
  const [status, setStatus] = useState("");
  const [importError, setImportError] = useState("");

  const prompt = useMemo(
    () => buildPrompt({ grade, pageRange, printNumber, hintLevel, includeExampleHints, outputTargets }),
    [grade, pageRange, printNumber, hintLevel, includeExampleHints, outputTargets],
  );

  /**
   * 生成したプロンプトを外部AIへ貼り付けられるようクリップボードへコピーする。
   */
  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setStatus("コピーしました");
    window.setTimeout(() => setStatus(""), 1600);
  }

  /**
   * 出力対象のチェック状態を切り替え、少なくとも1種類は残す。
   */
  function toggleOutputTarget(target: OutputTarget) {
    setOutputTargets((current) => {
      if (current.includes(target)) {
        const next = current.filter((item) => item !== target);
        return next.length ? next : current;
      }
      return [...current, target];
    });
  }

  /**
   * AIの返答をJSONとして取り込み、正規化してから編集画面へ送る。
   */
  async function importAiAnswer() {
    try {
      const parsed = JSON.parse(extractJson(aiAnswer)) as unknown;
      const print = normalizeImportedPrint(parsed);
      const saved = await saveLessonPrint(print);
      setImportError("");
      navigate(`/editor/${saved.id}`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "AIの返答をJSONとして取り込めませんでした。");
    }
  }

  return (
    <div className="page ai-maker-page">
      <header className="page-header">
        <div>
          <h1>AI問題作成</h1>
          <p>教科書PDFからプリントJSONを作成</p>
        </div>
        <a className="button" href="https://notebooklm.google.com/" target="_blank" rel="noreferrer">
          <ExternalLink size={18} />
          GoodnoteLMを開く
        </a>
      </header>

      <div className="ai-maker-layout">
        <section className="ai-control-panel">
          <label>
            学年
            <select value={grade} onChange={(event) => setGrade(event.target.value)}>
              <option value="中学1年">中学1年</option>
              <option value="中学2年">中学2年</option>
              <option value="中学3年">中学3年</option>
            </select>
          </label>

          <label>
            対象ページ
            <input value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="p.24-p.31" />
          </label>

          <label>
            プリントNo.
            <input value={printNumber} onChange={(event) => setPrintNumber(event.target.value)} placeholder="1" />
          </label>

          <label>
            難易度
            <select value={hintLevel} onChange={(event) => setHintLevel(event.target.value as HintLevel)}>
              <option value="ヒント多め">ヒント多め</option>
              <option value="ヒント少なめ">ヒント少なめ</option>
              <option value="ヒントなし">ヒントなし</option>
            </select>
          </label>

          <fieldset>
            <legend>例題のヒント</legend>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={includeExampleHints}
                onChange={(event) => setIncludeExampleHints(event.target.checked)}
              />
              例題にヒントを入れる
            </label>
          </fieldset>

          <fieldset>
            <legend>出力対象</legend>
            {allOutputTargets.map((target) => (
              <label key={target} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={outputTargets.includes(target)}
                  onChange={() => toggleOutputTarget(target)}
                />
                {outputTargetLabels[target]}
              </label>
            ))}
          </fieldset>
        </section>

        <section className="ai-work-panel">
          <div className="panel-heading">
            <h2>プロンプト</h2>
            <button type="button" className="primary" onClick={copyPrompt}>
              <Clipboard size={18} />
              コピー
            </button>
          </div>
          {status ? <p className="copy-status">{status}</p> : null}
          <textarea className="prompt-output" value={prompt} readOnly />

          <div className="panel-heading">
            <h2>解答を貼付ける欄</h2>
            <button type="button" className="primary" onClick={importAiAnswer}>
              <FileDown size={18} />
              実行
            </button>
          </div>
          {importError ? <p className="import-error">{importError}</p> : null}
          <textarea
            className="ai-answer-input"
            value={aiAnswer}
            onChange={(event) => setAiAnswer(event.target.value)}
            placeholder="AIが出力したJSONを貼り付け"
          />
        </section>
      </div>
    </div>
  );
}

/**
 * プロンプトは貼り付けやすさを優先し、選択された出力対象だけを短いルールに展開する。
 */
function buildPrompt({
  grade,
  pageRange,
  printNumber,
  hintLevel,
  includeExampleHints,
  outputTargets,
}: {
  grade: string;
  pageRange: string;
  printNumber: string;
  hintLevel: HintLevel;
  includeExampleHints: boolean;
  outputTargets: OutputTarget[];
}) {
  const selectedTargets = outputTargets.map((target) => outputTargetLabels[target]).join("、");
  const normalizedPrintNumber = printNumber.trim() || "1";
  const normalizedPageRange = pageRange.trim() || "未指定";
  const exampleSources = [
    outputTargets.includes("example") ? "例題" : "",
    outputTargets.includes("q") ? "Q" : "",
    outputTargets.includes("try") ? "TRY" : "",
  ].filter(Boolean);
  const blockRules = [
    outputTargets.includes("summary") ? '- まとめ: type "paragraph"' : "",
    outputTargets.includes("definition") ? '- 定義: type "definition"' : "",
    outputTargets.includes("theorem") ? '- 定理・性質・公式: type "theorem"' : "",
    exampleSources.length ? `- ${exampleSources.join("・")}: type "example"` : "",
    outputTargets.includes("exercise") ? '- 問・練習問題: type "exercise"' : "",
    '- type "example" と type "exercise" の直後には必ず type "answer" を追加',
  ]
    .filter(Boolean)
    .join("\n");

  return `教科書PDFの指定ページから、授業プリントアプリ用JSONを1つだけ作成してください。説明文やMarkdownは不要です。JSONのみ出力してください。

条件:
- 学年: ${grade}
- 対象ページ: ${normalizedPageRange}
- プリントNo: ${normalizedPrintNumber}
- 出力対象: ${selectedTargets}
- ヒント量: ${hintLevel}
- 例題のヒント: ${includeExampleHints ? "入れる" : "入れない"}

JSON形式:
{
  "id": "print-UUID",
  "title": "プリント名",
  "subject": "数学",
  "grade": "${grade}",
  "unit": "${normalizedPrintNumber}",
  "paperSize": "b5",
  "audience": "student",
  "blocks": [],
  "typstSource": "",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}

blocks:
${blockRules}

各block:
{
  "id": "block-UUID",
  "type": "paragraph|definition|theorem|example|exercise|answer",
  "title": "内容名だけ",
  "content": { "type": "doc", "content": [{ "type": "paragraph", "content": [] }] },
  "layout": "single",
  "pageBreakBefore": false
}

重要ルール:
- 出力対象に選ばれていない種類は出力しない。例: Qだけ未選択ならQは出力しない。
- 選ばれた例題、Q、TRY、Try、トライ、チャレンジ型の解説つき問題は、練習問題ではなく type "example" として出力する。
- type "example" のヒントは「例題のヒント」の指定に従う。入れない場合、例題本文にヒント文を含めない。
- ページ番号・問題番号・例番号はJSONのどこにも出力しない。
- titleに「p.152」「問2」「Q1」「TRY」「例2」「例題」「定義」「定理」「まとめ」などの接頭辞を入れない。
- 本文にも「p.152 例 2：」「p.119 Q1：」「TRY 1：」などを書かない。内容本文から始める。
- titleは内容名だけ。
- 解答欄は { "type": "answer", "title": "解答欄", "answerStyle": "box", "width": 100, "height": 20 } を基本にする。
- textは { "type": "text", "text": "..." }。
- 数式は必ず { "type": "inlineMath", "attrs": { "latex": "..." } } に分ける。
- 平行は // 禁止。必ず "\\\\parallel"。例: "DE \\\\parallel BC"。
- 垂直は "\\\\perp"、角は "\\\\angle ABC"、三角形は "\\\\triangle ABC"、弧は "\\\\overset{\\\\frown}{AB}"。
- 分数は "\\\\frac{1}{2}" のように必ず波括弧を使う。
- latexに $, #, [, ], // を含めない。\\\\quad, \\\\left, \\\\right も使わない。
- ヒントは指定量に従い、問題と同じ記号・アルファベットを使う。数式が必要ならinlineMathにする。
- 最後に全inlineMath.attrs.latexを点検し、//や未閉じの括弧があれば修正する。`;
}

/**
 * AIが説明文を前後に付けても、最初の{から最後の}までをJSON候補として扱う。
 */
function extractJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("AIの返答欄が空です。");
  }

  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error("JSONオブジェクトが見つかりません。");
  }

  return withoutFence.slice(firstBrace, lastBrace + 1);
}
