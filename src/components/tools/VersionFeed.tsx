"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Version = { id: string; type: string; releaseTime: string };
type Manifest = { latest: { release: string; snapshot: string }; versions: Version[] };

async function loadManifest(signal?: AbortSignal): Promise<Manifest> {
  const response = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json", { signal });
  if (!response.ok) throw new Error("版本目录暂时无法获取。");
  const data = await response.json() as Manifest;
  if (!data || typeof data.latest?.release !== "string" || !data.latest.release || typeof data.latest.snapshot !== "string" || !Array.isArray(data.versions)
    || data.versions.some((entry) => !entry || typeof entry.id !== "string" || typeof entry.type !== "string" || typeof entry.releaseTime !== "string" || !Number.isFinite(Date.parse(entry.releaseTime)))) throw new Error("版本目录格式无法识别。");
  return data;
}

export default function VersionFeed() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const previous = pending.current; pending.current = null; previous?.abort();
    const controller = new AbortController(); pending.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 10000);
    setLoading(true); setError("");
    try {
      const data = await loadManifest(controller.signal);
      if (pending.current === controller && !controller.signal.aborted) { setManifest(data); setUpdated(new Date()); }
    } catch (caught) {
      if (pending.current !== controller) return;
      setError(timedOut ? "版本目录查询超时，请稍后刷新重试。" : caught instanceof Error ? caught.message : "版本目录暂时无法获取。");
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) { pending.current = null; setLoading(false); }
    }
  }, []);

  useEffect(() => {
    const start = window.setTimeout(() => { void refresh(); }, 0);
    return () => { window.clearTimeout(start); const previous = pending.current; pending.current = null; previous?.abort(); };
  }, [refresh]);
  const recent = manifest?.versions.filter((version) => showSnapshots ? version.type === "release" || version.type === "snapshot" : version.type === "release")
    .sort((first, second) => Date.parse(second.releaseTime) - Date.parse(first.releaseTime)).slice(0, 8) ?? [];

  return <section className="mc-section" id="versions" aria-labelledby="versions-heading"><div className="mc-section-header"><div><span className="mc-overline">06 / RELEASE RADAR</span><h2 id="versions-heading">Java 版本<span>动态</span></h2></div><span className="mc-section-mark" aria-hidden="true">✳</span></div>
    <p className="mc-section-description">直接读取 Mojang 的官方版本目录。页面打开时更新，也可以手动刷新；工具生成器支持的版本以页面顶部列表为准。</p>
    <div className="mc-version-panel"><div className="mc-version-feature"><span>LATEST RELEASE</span><strong>{manifest?.latest.release ?? "—"}</strong><small>最新正式版</small></div><div className="mc-version-feature"><span>LATEST SNAPSHOT</span><strong>{manifest?.latest.snapshot ?? "—"}</strong><small>最新快照</small></div><div className="mc-version-list"><div className="mc-version-list-header"><span>近期版本</span><div><label><input type="checkbox" checked={showSnapshots} onChange={(event) => setShowSnapshots(event.target.checked)} /> 包含快照</label><button type="button" disabled={loading} onClick={() => { void refresh(); }}>{loading ? "正在刷新…" : "刷新 ↻"}</button></div></div>{error && <p className="mc-version-error">{error}</p>}{!manifest && !error && <p className="mc-version-loading">正在连接 Mojang 版本目录…</p>}{recent.map((version) => <div className="mc-version-row" key={version.id}><strong>{version.id}</strong><span>{version.type === "release" ? "正式版" : "快照"}</span><time dateTime={version.releaseTime}>{new Date(version.releaseTime).toLocaleDateString("zh-CN")}</time></div>)}<p className="mc-version-source">{updated ? `页面读取时间：${updated.toLocaleString("zh-CN")} · ` : ""}来源：<a href="https://piston-meta.mojang.com/mc/game/version_manifest_v2.json" target="_blank" rel="noopener noreferrer">Mojang 官方目录 ↗</a></p></div></div>
  </section>;
}
