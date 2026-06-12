import { Download, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { downloadBinaryFile, downloadTextFile } from "../features/export/download";
import { generateTypst } from "../features/export/generateTypst";
import { compileTypstPdf } from "../features/preview/compileTypstPdf";
import { TypstPreview } from "../features/preview/TypstPreview";
import { getLessonPrint } from "../features/storage/db";
import type { LessonPrint } from "../types/lessonPrint";

export default function PreviewRoute() {
  const { id } = useParams();
  const [print, setPrint] = useState<LessonPrint | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfDownloadError, setPdfDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void getLessonPrint(id).then((found) => {
      if (found) setPrint(found);
    });
  }, [id]);

  if (!print) {
    return <div className="page">読み込み中</div>;
  }

  const loadedPrint = print;
  const typst = generateTypst(loadedPrint);

  /**
   * プレビュー表示と同じブラウザTypst経路でPDFを作り、画面確認とダウンロード結果をそろえる。
   */
  async function downloadPdf() {
    setIsDownloadingPdf(true);
    setPdfDownloadError(null);

    try {
      const pdfBytes = await compileTypstPdf(typst);
      downloadBinaryFile(`${loadedPrint.title}.pdf`, pdfBytes, "application/pdf");
    } catch (cause) {
      setPdfDownloadError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  return (
    <div className="page preview-page">
      <header className="page-header">
        <div>
          <h1>Typst プレビュー</h1>
          <p>{loadedPrint.title}</p>
        </div>
        <div className="actions">
          <Link className="button" to={`/editor/${loadedPrint.id}`}>
            <Pencil size={18} />
            編集
          </Link>
          <button type="button" className="primary" onClick={() => downloadTextFile(`${loadedPrint.title}.typ`, typst)}>
            <Download size={18} />
            Typst出力
          </button>
          <button type="button" className="primary" onClick={downloadPdf} disabled={isDownloadingPdf}>
            <Download size={18} />
            {isDownloadingPdf ? "PDF生成中" : "PDF出力"}
          </button>
        </div>
      </header>
      {pdfDownloadError ? <p className="download-error">{pdfDownloadError}</p> : null}
      <TypstPreview print={loadedPrint} />
    </div>
  );
}
