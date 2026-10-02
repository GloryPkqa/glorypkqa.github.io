"use client";
/* eslint-disable @next/next/no-img-element -- Public Minecraft texture URLs are shown directly in a static export. */

import { useCallback, useEffect, useRef, useState } from "react";
import useCopyFeedback from "@/lib/useCopyFeedback";
import CapePreview from "@/components/tools/CapePreview";

type Player = { username: string; id: string; raw_id?: string; skin_texture?: string; avatar?: string; properties?: { name: string; value: string }[]; meta?: { cached_at?: number } };
type PlayerResponse = { code?: string; data?: { player?: Player } };

function textureUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/^http:\/\//i, "https://");
  return /^https:\/\/textures\.minecraft\.net\/texture\/[a-f0-9]+$/i.test(normalized) ? normalized : "";
}

function equippedCape(player: Player | null) {
  const encoded = player?.properties?.find((entry) => entry.name === "textures")?.value;
  if (!encoded) return "";
  try {
    const textures = JSON.parse(atob(encoded)) as { textures?: { CAPE?: { url?: string } } };
    return textureUrl(textures.textures?.CAPE?.url);
  } catch { return ""; }
}

export default function PlayerLookup() {
  const [query, setQuery] = useState("Pkqa");
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestedQuery, setRequestedQuery] = useState("");
  const [error, setError] = useState("");
  const { copy, copyLabel } = useCopyFeedback();
  const pending = useRef<AbortController | null>(null);
  const autoStart = useRef<number | null>(null);

  const lookupPlayer = useCallback(async (input: string) => {
    if (autoStart.current !== null) { window.clearTimeout(autoStart.current); autoStart.current = null; }
    const previous = pending.current;
    pending.current = null;
    previous?.abort();

    if (!/^([A-Za-z0-9_]{3,16}|[a-fA-F0-9]{32}|[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})$/.test(input)) {
      setError("请输入 3–16 位 Java 玩家名，或 32/36 位 UUID。"); setPlayer(null); setLoading(false); return;
    }
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setRequestedQuery(input); setLoading(true); setError(""); setPlayer(null);
    try {
      const response = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(input)}`, { signal: controller.signal });
      if (response.status === 429) throw new Error("查询太频繁，请稍后重试。");
      if (!response.ok) throw new Error("玩家不存在，或接口暂时不可用。");
      const data = await response.json() as PlayerResponse;
      if (typeof data.data?.player?.id !== "string" || !data.data.player.id || typeof data.data.player.username !== "string" || !data.data.player.username) throw new Error("没有查到这个玩家。");
      if (data.data.player.properties !== undefined && (!Array.isArray(data.data.player.properties) || data.data.player.properties.some((entry) => !entry || typeof entry.name !== "string" || typeof entry.value !== "string"))) throw new Error("玩家接口返回的数据不完整，请稍后重试。");
      if (pending.current === controller && !controller.signal.aborted) setPlayer(data.data.player);
    } catch (caught) {
      if (pending.current === controller) setError(caught instanceof Error && caught.name === "AbortError" ? "查询超时，请稍后重试。" : caught instanceof Error ? caught.message : "查询失败，请稍后重试。");
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) { pending.current = null; setLoading(false); }
    }
  }, []);

  useEffect(() => {
    const start = window.setTimeout(() => { void lookupPlayer("Pkqa"); }, 0);
    autoStart.current = start;
    return () => { window.clearTimeout(start); const previous = pending.current; pending.current = null; previous?.abort(); };
  }, [lookupPlayer]);

  function lookup(event: React.FormEvent) { event.preventDefault(); void lookupPlayer(query.trim()); }
  function changeQuery(value: string) {
    if (autoStart.current !== null) { window.clearTimeout(autoStart.current); autoStart.current = null; }
    // A changed name is a new search draft; an older response must not replace it.
    const previous = pending.current;
    pending.current = null;
    previous?.abort();
    setQuery(value); setLoading(false); setPlayer(null); setError("");
  }

  const skinUrl = textureUrl(player?.skin_texture);
  const capeUrl = equippedCape(player);

  return <section className="mc-section" id="player" aria-labelledby="player-heading"><div className="mc-section-header"><div><span className="mc-overline">05 / PLAYER ARCHIVE</span><h2 id="player-heading">玩家 UUID 与<span>皮肤查询</span></h2></div><span className="mc-section-mark" aria-hidden="true">♟</span></div>
    <p className="mc-section-description">输入 Java 版玩家名或 UUID，查询账号 ID、皮肤和已装备的披风。打开页面时自动查询 Pkqa；结果来自 PlayerDB 的缓存接口。</p>
    <div className="mc-lab-grid"><form className="mc-form-panel" onSubmit={lookup}><div className="mc-form-section-label"><span>01</span> 查找玩家</div><label className="mc-field"><span>玩家名或 UUID <small>PLAYER ID</small></span><input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="输入玩家名或 UUID" spellCheck={false} autoComplete="off" /></label><button type="submit" className="mc-primary-action" disabled={loading}>{loading ? "正在查找…" : "查找玩家 ↗"}</button><p className="mc-field-hint">仅查询 Java 版公开账号资料。皮肤由外部服务提供，账号改名或换肤后缓存可能需要一段时间更新。</p></form>
      <aside className="mc-output-panel mc-lookup-panel" aria-live="polite"><div className="mc-output-top"><span><i /> PLAYER PROFILE</span><span>JAVA EDITION</span></div>{error && <p className="mc-output-warning">⚠ {error}</p>}{player ? <><div className="mc-player-profile"><img src={`https://crafthead.net/avatar/${encodeURIComponent(player.id)}/96`} width="96" height="96" alt={`${player.username} 的 Minecraft 头像`} /><div className="mc-player-identity"><span>找到玩家</span><strong>{player.username}</strong><small>JAVA ACCOUNT</small></div><div className="mc-profile-cape">{capeUrl && skinUrl ? <CapePreview skinUrl={skinUrl} capeUrl={capeUrl} playerName={player.username} /> : <span className="mc-profile-cape-empty">未装备披风</span>}</div></div><div className="mc-player-uuid"><span>UUID</span><code>{player.id}</code><button type="button" onClick={() => void copy(player.id)}>{copyLabel(player.id, "复制 UUID ↗")}</button></div>{skinUrl && <div className="mc-skin-link"><img src={skinUrl} width="64" height="64" alt={`${player.username} 的原始皮肤贴图`} /><div><strong>原始皮肤贴图</strong><span>PNG · 原始尺寸</span><a href={skinUrl} target="_blank" rel="noopener noreferrer">打开原图 ↗</a></div></div>}{capeUrl && <p className="mc-output-note">已装备披风以 PlayerDB 最近缓存为准。<a href={capeUrl} target="_blank" rel="noopener noreferrer">打开披风原图 ↗</a></p>}{player.meta?.cached_at && <p className="mc-output-note">资料缓存时间：{new Date(player.meta.cached_at * 1000).toLocaleString("zh-CN")}</p>}</> : !error && <div className="mc-lookup-empty"><span>♙</span><p>{loading ? `正在查找 ${requestedQuery} 的玩家档案…` : "输入玩家名或 UUID 后点击查找"}</p></div>}<p className="mc-output-note">数据来源：<a href="https://playerdb.co/" target="_blank" rel="noopener noreferrer">PlayerDB ↗</a></p></aside></div>
  </section>;
}
