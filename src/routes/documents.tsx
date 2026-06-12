import { Copy, FilePlus2, Search, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { normalizeImportedPrint } from "../features/storage/importLessonPrint";
import {
  createAndSaveLessonPrint,
  deleteLessonPrint,
  duplicateLessonPrint,
  listLessonPrints,
  saveLessonPrint,
} from "../features/storage/db";
import type { LessonPrint } from "../types/lessonPrint";

export default function DocumentsRoute() {
  const navigate = useNavigate();
  const [prints, setPrints] = useState<LessonPrint[]>([]);
  const [query, setQuery] = useState("");
  const [importError, setImportError] = useState("");

  /**
   * 作成・削除・複製の後はIndexedDBを読み直し、一覧と保存済みデータを一致させる。
   */
  async function refresh() {
    setPrints(await listLessonPrints());
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    // タイトル以外に学年やNo.でも探せるよう、一覧表示で見える項目をまとめて検索する。
    const needle = query.trim().toLowerCase();
    if (!needle) return prints;
    return prints.filter((print) =>
      [print.title, print.subject, print.grade, print.unit].join(" ").toLowerCase().includes(needle),
    );
  }, [prints, query]);

  /**
   * 新規プリントを保存してから編集画面へ移動する。
   */
  async function createPrint() {
    const print = await createAndSaveLessonPrint();
    navigate(`/editor/${print.id}`);
  }

  /**
   * JSONファイルを読み込み、アプリ用に正規化して保存する。
   */
  async function importJsonFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const print = normalizeImportedPrint(parsed);
      const saved = await saveLessonPrint(print);
      setImportError("");
      await refresh();
      navigate(`/editor/${saved.id}`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "JSONを読み込めませんでした。");
    }
  }

  return (
    <div className="page documents-page">
      <header className="page-header">
        <div>
          <h1>プリント一覧</h1>
          <p>IndexedDB に保存された教材プリントデータ</p>
        </div>
        <div className="header-actions">
          <label className="button import-button">
            <Upload size={18} />
            JSONを開く
            <input type="file" accept="application/json,.json" onChange={importJsonFile} />
          </label>
          <button type="button" className="primary" onClick={createPrint}>
            <FilePlus2 size={18} />
            新規作成
          </button>
        </div>
      </header>

      {importError ? <p className="import-error">{importError}</p> : null}

      <label className="search-box">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="検索" />
      </label>

      <div className="print-table">
        {filtered.map((print) => (
          <article key={print.id} className="print-row">
            <Link to={`/editor/${print.id}`}>
              <strong>{print.title}</strong>
              <span>
                {print.grade} / {print.subject} / {print.unit}
              </span>
            </Link>
            <time>{new Date(print.updatedAt).toLocaleString("ja-JP")}</time>
            <button
              type="button"
              className="icon-button"
              title="複製"
              onClick={async () => {
                await duplicateLessonPrint(print);
                await refresh();
              }}
            >
              <Copy size={17} />
            </button>
            <button
              type="button"
              className="icon-button danger"
              title="削除"
              onClick={async () => {
                await deleteLessonPrint(print.id);
                await refresh();
              }}
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
