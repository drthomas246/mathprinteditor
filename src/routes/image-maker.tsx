import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as GeogebraModule from "react-geogebra";
import type { Props as GeogebraProps } from "react-geogebra";
import { Download, RotateCcw } from "lucide-react";

type GeogebraApplet = {
  evalCommand: (command: string) => void;
  reset: () => void;
};

type GeogebraExport = ComponentType<GeogebraProps> | { default?: GeogebraExport };

/**
 * react-geogebraのビルド形式差を吸収し、default exportでも名前付き相当でも動かす。
 */
function resolveGeogebraComponent(moduleExport: GeogebraExport): ComponentType<GeogebraProps> {
  if (typeof moduleExport === "function") {
    return moduleExport;
  }

  if (moduleExport.default) {
    return resolveGeogebraComponent(moduleExport.default);
  }

  throw new Error("react-geogebra component export could not be resolved.");
}

const Geogebra = resolveGeogebraComponent(GeogebraModule as GeogebraExport);

type Dimensions = {
  width: number;
  height: number;
};

declare global {
  interface Window {
    imageMakerGeoGebra?: GeogebraApplet;
  }
}

export default function ImageMakerRoute() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    // GeoGebraは固定ピクセル指定なので、親要素の実寸を測って余白なく表示する。
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(640, Math.floor(entry.contentRect.width));
      const height = Math.max(480, Math.floor(entry.contentRect.height));

      setDimensions((current) => {
        if (current && Math.abs(current.width - width) < 4 && Math.abs(current.height - height) < 4) {
          return current;
        }

        return { width, height };
      });
    });

    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const handleReady = useCallback(() => {
    setReady(true);
  }, []);

  /**
   * GeoGebra上の作図状態を初期化する。
   */
  const handleReset = () => {
    window.imageMakerGeoGebra?.reset();
  };

  /**
   * GeoGebra側の組み込みExportImageを使い、作図状態をそのままPNGにする。
   */
  const handleDownload = () => {
    window.imageMakerGeoGebra?.evalCommand('ExportImage("filename", "geogebra-export.png", "type", "png")');
  };

  return (
    <div className="page image-maker-page">
      <header className="page-header">
        <div>
          <h1>画像作成</h1>
          <p>GeoGebraで図形やグラフを作成します。</p>
        </div>
        <div className="actions">
          <button type="button" onClick={handleReset} disabled={!ready}>
            <RotateCcw size={18} />
            リセット
          </button>
          <button type="button" className="primary" onClick={handleDownload} disabled={!ready}>
            <Download size={18} />
            PNG保存
          </button>
        </div>
      </header>

      <section className="geogebra-workspace" aria-label="GeoGebra">
        <div ref={frameRef} className="geogebra-frame">
          {dimensions ? (
            <Geogebra
              id="imageMakerGeoGebra"
              appName="classic"
              appletOnLoad={handleReady}
              width={dimensions.width}
              height={dimensions.height}
              showMenuBar
              showToolBar
              showAlgebraInput
              showToolBarHelp
              enableFileFeatures
              enableRightClick
              enableShiftDragZoom
              showResetIcon
              language="ja"
              reloadOnPropChange
              LoadComponent={() => <div className="geogebra-loading">GeoGebraを読み込んでいます</div>}
            />
          ) : (
            <div className="geogebra-loading">GeoGebraを読み込んでいます</div>
          )}
        </div>
      </section>
    </div>
  );
}
