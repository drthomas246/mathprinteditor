import { HashRouter, NavLink, Route, Routes } from "react-router";
import { BookOpenText, FileText, Image as ImageIcon, Menu, Sparkles, X } from "lucide-react";
import { useState } from "react";
import AiProblemMakerRoute from "./routes/ai-problem-maker";
import DocumentsRoute from "./routes/documents";
import EditorRoute from "./routes/editor";
import ImageMakerRoute from "./routes/image-maker";
import PreviewRoute from "./routes/preview";

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}

function AppShell() {
  const [isNavOpen, setIsNavOpen] = useState(false);

  /**
   * 狭い画面ではナビが編集面を覆うため、画面遷移時に必ず閉じる。
   */
  function closeNav() {
    setIsNavOpen(false);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <BookOpenText size={24} />
            <span>授業プリント</span>
          </div>
          <button
            type="button"
            className="icon-button menu-toggle"
            aria-label={isNavOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={isNavOpen}
            aria-controls="primary-navigation"
            title={isNavOpen ? "メニューを閉じる" : "メニューを開く"}
            onClick={() => setIsNavOpen((open) => !open)}
          >
            {isNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav id="primary-navigation" className={isNavOpen ? "sidebar-nav is-open" : "sidebar-nav"}>
          <NavLink to="/" end onClick={closeNav}>
            <FileText size={18} />
            一覧
          </NavLink>
          <NavLink to="/ai-problem-maker" onClick={closeNav}>
            <Sparkles size={18} />
            AI問題作成
          </NavLink>
          <NavLink to="/image-maker" onClick={closeNav}>
            <ImageIcon size={18} />
            画像作成
          </NavLink>
        </nav>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<DocumentsRoute />} />
          <Route path="/ai-problem-maker" element={<AiProblemMakerRoute />} />
          <Route path="/image-maker" element={<ImageMakerRoute />} />
          <Route path="/editor/:id" element={<EditorRoute />} />
          <Route path="/preview/:id" element={<PreviewRoute />} />
        </Routes>
      </main>
    </div>
  );
}
