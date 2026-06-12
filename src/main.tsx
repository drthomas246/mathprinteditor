import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "mathlive";
import "mathlive/fonts.css";
import "./styles.css";
import App from "./App";

// ブラウザ拡張由来の既知ノイズだけを抑制し、アプリ本体の例外は開発者に見える状態を保つ。
window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason);

  if (
    message.includes(
      "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received",
    )
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
