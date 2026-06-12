# StudyEditor

StudyEditor は、授業用プリントをブラウザ上で作成し、Typst/PDF に出力するための教材編集アプリです。数学プリントを想定しており、本文編集、数式、解答欄、図版、AI 生成 JSON の取り込みを扱えます。

## 主な機能

- プリント一覧の作成、検索、複製、削除
- ブロック単位のプリント編集
  - 見出し
  - 本文
  - 定義
  - 定理
  - 例題
  - 練習問題
  - 解答欄
  - 数式
  - 画像
- TipTap ベースの本文編集とインライン数式編集
- B5/A4 の Typst 出力
- ブラウザ内 Typst プレビューと PDF ダウンロード
- JSON エクスポート/インポート
- 外部 AI に貼り付ける作問プロンプトの生成と、AI が返した JSON の取り込み
- GeoGebra を使った図版作成と PNG 保存
- IndexedDB によるローカル保存

## 技術構成

- React 19
- TypeScript
- Vite Plus
- React Router
- Dexie / IndexedDB
- TipTap
- MathLive
- Typst browser compiler
- GeoGebra
- lucide-react

## セットアップ

このプロジェクトは pnpm 11 系を前提にしています。

```powershell
pnpm install
```

環境によって証明書まわりでインストールに失敗する場合は、次のように実行します。

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npx.cmd pnpm@11.0.9 install
```

## 開発サーバー

```powershell
pnpm dev
```

Vite Plus の開発サーバーが起動します。

## ビルド

```powershell
pnpm build
```

内部では TypeScript のビルドチェックと Vite Plus の production build を実行します。

```powershell
tsc -b
vp build
```

このプロジェクトでは `vp start` は使いません。確認には `vp build`、開発には `vp dev`、ビルド済み成果物の確認には `vp preview` を使います。

## プレビュー

```powershell
pnpm preview
```

ビルド済みのアプリを確認します。

## 使い方

1. 一覧画面で新規プリントを作成します。
2. 編集画面でタイトル、No.、用紙サイズを設定します。
3. 左側のブロックパレットから本文、例題、練習問題、解答欄などを追加します。
4. 必要に応じて JSON や Typst ファイルをダウンロードします。
5. プレビュー画面で Typst/PDF の出力を確認します。
6. PDF 出力ボタンからプリントを保存します。

## AI 作問フロー

`AI問題作成` 画面では、外部 AI ツールに渡すための短い作問プロンプトを生成します。

1. 学年、対象ページ、プリント No.、出力対象を指定します。
2. プロンプトをコピーして外部 AI に貼り付けます。
3. AI が返した JSON をアプリ側に貼り付けます。
4. インポートすると、通常のプリントとして保存され、編集画面に移動します。

AI からの JSON は取り込み時に正規化されます。`unit` は単元名ではなくプリント No. として扱います。Q や TRY は UI 上では個別に選べますが、取り込み後は例題系ブロックとして整理されます。

## データと出力

- プリントデータはブラウザの IndexedDB に保存されます。
- JSON 出力はバックアップや別ブラウザへの移動に使えます。
- Typst 出力は `.typ` として保存できます。
- PDF 出力はブラウザ内の Typst compiler で生成します。

## 開発メモ

- Typst 出力の中心は `src/features/export/generateTypst.ts` です。
- PDF プレビューは `src/features/preview/compileTypstPdf.ts` と `src/features/preview/TypstPreview.tsx` が担当します。
- AI JSON の取り込み正規化は `src/features/storage/importLessonPrint.ts` で行います。
- 保存処理は `src/features/storage/db.ts` の `saveLessonPrint` を経由します。
- 画像/図版は編集ブロックとして扱い、GeoGebra で作った PNG も教材に利用できます。

## ライセンス

MIT License

Copyright (c) 2026 Yamahara Yoshihiro
