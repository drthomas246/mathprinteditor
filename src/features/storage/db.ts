import Dexie, { type EntityTable } from "dexie";
import type { LessonPrint } from "../../types/lessonPrint";
import { createLessonPrint } from "../editor/createLessonPrint";
import { generateTypst } from "../export/generateTypst";

class StudyEditorDatabase extends Dexie {
  prints!: EntityTable<LessonPrint, "id">;

  constructor() {
    super("studyeditor");
    this.version(1).stores({
      prints: "id, title, subject, grade, unit, paperSize, createdAt, updatedAt",
    });
  }
}

export const db = new StudyEditorDatabase();

/**
 * 一覧は最近編集したプリントから見つけやすいよう、updatedAtの降順に統一する。
 */
export async function listLessonPrints() {
  return db.prints.orderBy("updatedAt").reverse().toArray();
}

export async function getLessonPrint(id: string) {
  return db.prints.get(id);
}

/**
 * プリントを保存し、Typstソースと更新日時を同時に再生成する。
 *
 * プレビュー・エクスポートとDB内容のずれを防ぐため、保存時にTypstを作り直す。
 */
export async function saveLessonPrint(print: LessonPrint) {
  const next = {
    ...print,
    typstSource: generateTypst(print),
    updatedAt: new Date().toISOString(),
  };
  await db.prints.put(next);
  return next;
}

export async function createAndSaveLessonPrint() {
  const print = createLessonPrint();
  print.typstSource = generateTypst(print);
  await db.prints.add(print);
  return print;
}

/**
 * 指定IDのプリントを削除する。
 */
export async function deleteLessonPrint(id: string) {
  await db.prints.delete(id);
}

/**
 * TipTap JSONや画像属性を保ったまま、別IDのプリントとして複製する。
 */
export async function duplicateLessonPrint(print: LessonPrint) {
  const now = new Date().toISOString();
  const clone: LessonPrint = {
    ...structuredClone(print),
    id: crypto.randomUUID(),
    title: `${print.title} のコピー`,
    createdAt: now,
    updatedAt: now,
  };
  clone.typstSource = generateTypst(clone);
  await db.prints.add(clone);
  return clone;
}
