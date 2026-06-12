import { useEffect, useMemo, useState } from "react";
import type { LessonPrint } from "../../types/lessonPrint";
import { generateTypst } from "../export/generateTypst";
import { compileTypstPdf } from "./compileTypstPdf";

interface TypstPreviewProps {
  print: LessonPrint;
}

export function TypstPreview({ print }: TypstPreviewProps) {
  const source = useMemo(() => generateTypst(print), [print]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("Typstをコンパイル中");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let nextUrl: string | null = null;

    setStatus("Typstをコンパイル中");
    // sourceが変わるたびに古いObject URLを破棄し、PDF Blobのメモリが残り続けないようにする。
    setError(null);
    setPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    void compileTypstPdf(source)
      .then((pdfBytes) => {
        if (disposed) return;
        const pdfBuffer = pdfBytes.buffer.slice(
          pdfBytes.byteOffset,
          pdfBytes.byteOffset + pdfBytes.byteLength,
        ) as ArrayBuffer;
        const blob = new Blob([pdfBuffer], { type: "application/pdf" });
        nextUrl = URL.createObjectURL(blob);
        setPdfUrl(nextUrl);
        setStatus("PDFプレビュー");
      })
      .catch((cause: unknown) => {
        if (disposed) return;
        setStatus("コンパイルエラー");
        setError(formatCompileError(cause));
      });

    return () => {
      disposed = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [source]);

  return (
    <div className="preview-grid">
      <section className="pdf-preview-panel">
        <div className="preview-status">{status}</div>
        {pdfUrl ? (
          <iframe className="pdf-frame" src={`${pdfUrl}#view=FitH&toolbar=0`} title={`${print.title} PDF preview`} />
        ) : (
          <div className="pdf-placeholder">
            {error ? <pre>{error}</pre> : <span>PDFを生成しています</span>}
          </div>
        )}
      </section>
      <pre className="code-preview">{source}</pre>
    </div>
  );
}

/**
 * よく起きるブラウザ側の失敗は、編集で直せる原因が分かる文面に置き換える。
 */
function formatCompileError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause);

  if (message.includes("画像URLを読み込めませんでした")) {
    return [
      message,
      "",
      "この画像配信元はブラウザからの直接取得を許可していない可能性があります。",
      "エディタの画像ブロックで画像ファイルを選択すると、PDFに埋め込めます。",
    ].join("\n");
  }

  if (message === "Failed to fetch") {
    return [
      "Typstコンパイル中のfetchに失敗しました。",
      "WASM、フォント、または外部画像の読み込みで失敗している可能性があります。",
      "画像URLを使っている場合は、画像ファイルを選択して埋め込んでください。",
    ].join("\n");
  }

  if (message.includes("font") || message.includes("Font")) {
    return [
      message,
      "",
      "ブラウザ内Typstコンパイル用のフォント設定が必要です。",
    ].join("\n");
  }

  return message;
}
