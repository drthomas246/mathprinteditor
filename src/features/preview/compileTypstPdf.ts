import { loadFonts } from "@myriaddreamin/typst.ts";
import { $typst } from "@myriaddreamin/typst.ts/contrib/all-in-one-lite";
import compilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/wasm?url";

let isConfigured = false;
const japaneseTextFontUrl =
  "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/OTF/Japanese/NotoSerifCJKjp-Regular.otf";

/**
 * ブラウザ上でTypstソースをPDFへ変換する。
 *
 * 画像の仮想ファイル化とWASM初期化をここに閉じ込め、
 * プレビューとPDFダウンロードで同じ変換経路を使う。
 */
export async function compileTypstPdf(source: string) {
  configureTypstCompiler();
  const prepared = await prepareImages(source);
  const output = await $typst.pdf({ mainContent: prepared });

  if (!output) {
    throw new Error("Typst PDF compiler did not return output.");
  }

  if (isUint8Array(output)) {
    return new Uint8Array(output);
  }

  if (isArrayBuffer(output)) {
    return new Uint8Array(output);
  }

  return new Uint8Array(output as unknown as ArrayLike<number>);
}

/**
 * Typstの#imageはファイルパス前提なので、data URLや外部URLを仮想ファイルへ写す。
 */
async function prepareImages(source: string) {
  const imageReferences = [...source.matchAll(/#image\("([^"]+)"/g)];
  const embeddedImageReferences = imageReferences.filter((match) => isDataUrl(match[1]));
  const remoteImageReferences = imageReferences.filter((match) => isRemoteUrl(match[1]));

  if (!embeddedImageReferences.length && !remoteImageReferences.length) {
    return source;
  }

  await $typst.resetShadow();

  let prepared = source;

  for (const [index, match] of embeddedImageReferences.entries()) {
    const dataUrl = match[1];
    const decoded = decodeDataUrl(dataUrl);
    const virtualPath = `/assets/embedded-image-${index}${getMimeExtension(decoded.mimeType)}`;
    await $typst.mapShadow(virtualPath, decoded.bytes);
    prepared = prepared.replaceAll(`"${dataUrl}"`, `"${virtualPath}"`);
  }

  for (const [index, match] of remoteImageReferences.entries()) {
    const originalUrl = match[1];
    const virtualPath = `/assets/remote-image-${index}${getImageExtension(originalUrl)}`;
    let response: Response;

    try {
      response = await fetch(originalUrl);
    } catch (error) {
      throw new Error(
        `画像URLを読み込めませんでした。画像配信元がブラウザからの取得を許可していない可能性があります: ${originalUrl}`,
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new Error(`画像URLを読み込めませんでした: ${originalUrl} (${response.status})`);
    }

    await $typst.mapShadow(virtualPath, new Uint8Array(await response.arrayBuffer()));
    prepared = prepared.replaceAll(`"${originalUrl}"`, `"${virtualPath}"`);
  }

  return prepared;
}

function isDataUrl(value: string) {
  return /^data:image\//i.test(value);
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

/**
 * ブラウザのFileReaderが作るdata URLを、Typstのshadow fileへ渡せるバイト列に戻す。
 */
function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!match) {
    throw new Error("画像データURLの形式を読み取れませんでした。");
  }

  const [, mimeType, isBase64, payload] = match;
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return { bytes, mimeType };
}

function getMimeExtension(mimeType: string) {
  switch (mimeType.toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    default:
      return ".img";
  }
}

function getImageExtension(url: string) {
  const extension = new URL(url).pathname.match(/\.(png|jpe?g|gif|webp|svg)$/i)?.[0];
  return extension?.toLowerCase() ?? ".img";
}

function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

/**
 * WASMと日本語フォントを初回だけ登録し、各プレビュー更新では再初期化しない。
 */
function configureTypstCompiler() {
  if (isConfigured) return;

  $typst.setCompilerInitOptions({
    beforeBuild: [loadFonts([japaneseTextFontUrl], { assets: ["text"] })],
    getModule: async () => {
      const response = await fetch(compilerWasmUrl);
      if (!response.ok) {
        throw new Error(`Failed to load Typst compiler WASM: ${response.status}`);
      }

      return response.arrayBuffer();
    },
  });
  isConfigured = true;
}
