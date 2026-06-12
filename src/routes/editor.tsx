import { Download, Eye, Plus, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { BlockEditor } from "../features/editor/BlockEditor";
import { blockPresets } from "../features/editor/blockPresets";
import { createBlock } from "../features/editor/createLessonPrint";
import { downloadTextFile } from "../features/export/download";
import { generateTypst } from "../features/export/generateTypst";
import { getLessonPrint, saveLessonPrint } from "../features/storage/db";
import type { BlockType, LessonPrint } from "../types/lessonPrint";

export default function EditorRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [print, setPrint] = useState<LessonPrint | null>(null);
  const [status, setStatus] = useState("読み込み中");
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dropTargetBlockId, setDropTargetBlockId] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const hasLoadedRef = useRef(false);
  const lastSavedSnapshotRef = useRef("");
  const latestPrintRef = useRef<LessonPrint | null>(null);
  const saveQueueRef = useRef(Promise.resolve<LessonPrint | null>(null));

  // 初回読み込み中のsetPrintを自動保存対象にしないため、読み込み完了フラグを分ける。
  useEffect(() => {
    if (!id) return;

    void getLessonPrint(id).then((found) => {
      if (!found) {
        navigate("/");
        return;
      }

      latestPrintRef.current = found;
      setPrint(found);
      hasLoadedRef.current = true;
      lastSavedSnapshotRef.current = createSaveSnapshot(found);
      setStatus("保存済み");
    });
  }, [id, navigate]);

  useEffect(() => {
    if (!print || !hasLoadedRef.current) return;
    latestPrintRef.current = print;

    const snapshot = createSaveSnapshot(print);
    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    setStatus("保存中");
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void persistLatestPrint();
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [print]);

  const typst = useMemo(() => (print ? generateTypst(print) : ""), [print]);

  /**
   * 編集中プリントの状態を更新し、自動保存対象として保持する。
   */
  function updatePrint(next: LessonPrint) {
    setStatus("未保存");
    latestPrintRef.current = next;
    setPrint(next);
  }

  /**
   * 最新の編集内容をIndexedDBへ直列保存する。
   */
  async function persistLatestPrint() {
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      const latest = latestPrintRef.current;
      if (!latest) return null;

      const saved = await saveLessonPrint(latest);
      const savedSnapshot = createSaveSnapshot(saved);
      if (latestPrintRef.current && createSaveSnapshot(latestPrintRef.current) === savedSnapshot) {
        latestPrintRef.current = saved;
        lastSavedSnapshotRef.current = savedSnapshot;
        setStatus("保存済み");
      }
      setPrint((current) => {
        if (!current || current.id !== saved.id) return current;
        if (createSaveSnapshot(current) !== savedSnapshot) {
          return {
            ...current,
            typstSource: saved.typstSource,
            updatedAt: saved.updatedAt,
          };
        }
        return saved;
      });
      return saved;
    });

    return saveQueueRef.current;
  }

  /**
   * ドラッグ中のブロックを、ドロップ先ブロックの位置へ移動する。
   */
  function moveBlock(targetBlockId: string) {
    if (!print || !draggingBlockId || draggingBlockId === targetBlockId) return;

    const fromIndex = print.blocks.findIndex((block) => block.id === draggingBlockId);
    const targetIndex = print.blocks.findIndex((block) => block.id === targetBlockId);
    if (fromIndex < 0 || targetIndex < 0) return;

    const blocks = [...print.blocks];
    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(targetIndex, 0, moved);
    updatePrint({ ...print, blocks });
  }

  /**
   * ドラッグ状態とドロップ候補表示をまとめて解除する。
   */
  function finishDragging() {
    setDraggingBlockId(null);
    setDropTargetBlockId(null);
  }

  /**
   * 現在の編集内容を明示的に保存する。
   */
  async function save() {
    if (!print) return;
    latestPrintRef.current = print;
    await persistLatestPrint();
  }

  /**
   * 保留中の保存を確定してからプレビュー画面へ移動する。
   */
  async function saveAndPreview() {
    if (!print) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    latestPrintRef.current = print;
    const saved = await persistLatestPrint();
    if (!saved) return;
    navigate(`/preview/${saved.id}`);
  }

  if (!print) {
    return <div className="page">読み込み中</div>;
  }

  return (
    <div className="page editor-page">
      <header className="page-header">
        <div className="title-fields">
          <input
            value={print.title}
            onChange={(event) => updatePrint({ ...print, title: event.target.value })}
            aria-label="プリント名"
          />
          <div>
            <label className="print-number-field">
              <span>No.</span>
              <input
                type="number"
                min={1}
                step={1}
                value={print.unit}
                onChange={(event) => updatePrint({ ...print, unit: event.target.value })}
                aria-label="プリントNumber"
                placeholder="1"
              />
            </label>
            <select
              value={print.paperSize}
              onChange={(event) =>
                updatePrint({ ...print, paperSize: event.target.value as LessonPrint["paperSize"] })
              }
              aria-label="用紙サイズ"
            >
              <option value="b5">B5</option>
              <option value="a4">A4</option>
            </select>
          </div>
        </div>
        <div className="actions">
          <button
            type="button"
            onClick={() =>
              downloadTextFile(`${print.title}.json`, JSON.stringify(print, null, 2), "application/json")
            }
          >
            <Download size={18} />
            JSON
          </button>
          <button type="button" onClick={() => downloadTextFile(`${print.title}.typ`, typst)}>
            <Download size={18} />
            Typst
          </button>
          <button type="button" onClick={saveAndPreview}>
            <Eye size={18} />
            プレビュー
          </button>
          <button type="button" className="primary" onClick={save}>
            <Save size={18} />
            {status}
          </button>
        </div>
      </header>

      <div className="editor-layout">
        <aside className="block-palette">
          {blockPresets.map((preset) => (
            <button
              key={preset.type}
              type="button"
              className={`block-palette-button block-palette-${preset.type}`}
              onClick={() =>
                updatePrint({
                  ...print,
                  blocks: [...print.blocks, createBlock(preset.type as BlockType)],
                })
              }
            >
              <Plus size={16} />
              <span>{preset.label}</span>
            </button>
          ))}
        </aside>

        <div className="block-list">
          {print.blocks.map((block) => (
            <BlockEditor
              key={block.id}
              block={block}
              isDragging={draggingBlockId === block.id}
              isDropTarget={Boolean(draggingBlockId) && dropTargetBlockId === block.id}
              onChange={(next) =>
                updatePrint({
                  ...print,
                  blocks: print.blocks.map((item) => (item.id === next.id ? next : item)),
                })
              }
              onDelete={() =>
                updatePrint({
                  ...print,
                  blocks: print.blocks.filter((item) => item.id !== block.id),
                })
              }
              onDragStart={() => {
                setDraggingBlockId(block.id);
                setDropTargetBlockId(null);
              }}
              onDragOver={(event) => {
                if (!draggingBlockId || draggingBlockId === block.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetBlockId(block.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                moveBlock(block.id);
                finishDragging();
              }}
              onDragEnd={finishDragging}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * typstSourceとupdatedAtは保存時に変わる派生値なので、差分判定から外す。
 */
function createSaveSnapshot(print: LessonPrint) {
  const { typstSource: _typstSource, updatedAt: _updatedAt, ...content } = print;
  return JSON.stringify(content);
}
