"use client";
/* eslint-disable @next/next/no-img-element -- Fallback uses the public cape texture URL. */

import { useEffect, useRef, useState } from "react";

export default function CapePreview({ skinUrl, capeUrl, playerName }: { skinUrl: string; capeUrl: string; playerName: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failedResource, setFailedResource] = useState("");
  const [failedFallbackResource, setFailedFallbackResource] = useState("");
  const resource = `${skinUrl}\n${capeUrl}`;
  const failed = failedResource === resource;

  useEffect(() => {
    let disposed = false;
    let viewer: import("skinview3d").SkinViewer | undefined;
    let resizeObserver: ResizeObserver | undefined;
    const release = () => {
      resizeObserver?.disconnect(); resizeObserver = undefined;
      viewer?.dispose(); viewer = undefined;
    };
    void (async () => {
      try {
        const { SkinViewer } = await import("skinview3d");
        if (disposed || !canvas.current || !frame.current) return;
        viewer = new SkinViewer({ canvas: canvas.current, width: frame.current.clientWidth, height: frame.current.clientHeight, renderPaused: true });
        viewer.playerObject.rotation.y = Math.PI;
        viewer.zoom = 0.85;
        resizeObserver = new ResizeObserver(() => {
          if (!viewer || !frame.current) return;
          viewer.width = frame.current.clientWidth;
          viewer.height = frame.current.clientHeight;
          viewer.render();
        });
        resizeObserver.observe(frame.current);
        await Promise.all([viewer.loadSkin(skinUrl), viewer.loadCape(capeUrl)]);
        if (!disposed) { viewer.render(); setFailedResource(""); setFailedFallbackResource(""); }
      } catch {
        release();
        if (!disposed) { setFailedResource(resource); setFailedFallbackResource(""); }
      }
    })();
    return () => { disposed = true; release(); };
  }, [skinUrl, capeUrl, resource]);

  return <div className="mc-cape-preview" ref={frame} aria-label={`${playerName} 当前装备的披风`}><canvas hidden={failed} ref={canvas} role="img" aria-label={`${playerName} 的 3D 人物背面与披风`} />{failed && (failedFallbackResource === resource ? <span className="mc-profile-cape-empty">披风预览暂不可用</span> : <img src={capeUrl} width="64" height="96" alt={`${playerName} 的披风贴图`} onError={() => setFailedFallbackResource(resource)} />)}</div>;
}
