/**
 * テキスト内容をBlob化し、指定ファイル名でダウンロードする。
 */
export function downloadTextFile(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  downloadBlob(filename, blob);
}

/**
 * バイナリ内容をBlob化し、指定ファイル名でダウンロードする。
 */
export function downloadBinaryFile(filename: string, bytes: Uint8Array, type = "application/octet-stream") {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  downloadBlob(filename, new Blob([buffer], { type }));
}

/**
 * 一時リンクをDOMに置いてクリックする形にし、ブラウザのダウンロード制限を避ける。
 */
function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = sanitizeFilename(filename);
  link.rel = "noopener";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Windowsで使えない文字を避け、プリント名をそのままファイル名にしやすくする。
 */
function sanitizeFilename(filename: string) {
  const safe = filename
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return safe || "lesson-print.txt";
}
