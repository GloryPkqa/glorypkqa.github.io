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

function equippedTextures(player: Player | null) {
  const empty = { skin: "", cape: "" };
  const encoded = player?.properties?.find((entry) => entry.name === "textures")?.value;
  if (!encoded) return empty;
  try {
    const textures = JSON.parse(atob(encoded)) as { textures?: { SKIN?: { url?: string }; CAPE?: { url?: string } } } | null;
    return { skin: textureUrl(textures?.textures?.SKIN?.url), cape: textureUrl(textures?.textures?.CAPE?.url) };
  } catch { return empty; }
}

export default function PlayerLookup() {
  const [query, setQuery] = useState("Pkqa");
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestedQuery, setRequestedQuery] = useState("");
  const [error, setError] = useState("");
  const [failedAvatar, setFailedAvatar] = useState("");
  const [failedSkin, setFailedSkin] = useState("");
  const [failedCape, setFailedCape] = useState("");
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
    setFailedAvatar(""); setFailedSkin(""); setFailedCape("");
    try {
      const response = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(input)}`, { signal: controller.signal });
      if (response.status === 429) throw new Error("查询太频繁，请稍后重试。");
      if (!response.ok) throw new Error("玩家不存在，或接口暂时不可用。");
      const data = await response.json() as PlayerResponse | null;
      const found = data?.data?.player;
      if (typeof found?.id !== "string" || !found.id || typeof found.username !== "string" || !found.username) throw new Error("没有查到这个玩家。");
      if (found.properties !== undefined && (!Array.isArray(found.properties) || found.properties.some((entry) => !entry || typeof entry.name !== "string" || typeof entry.value !== "string"))) throw new Error("玩家接口返回的数据不完整，请稍后重试。");
      if (pending.current === controller && !controller.signal.aborted) setPlayer(found);
    } catch (caught) {
      if (pending.current === controller) setError(caught instanceof Error && caught.name === "AbortError" ? "查询超时，请稍后重试。" : caught instanceof Error && ["查询太频繁，请稍后重试。", "玩家不存在，或接口暂时不可用。", "没有查到这个玩家。", "玩家接口返回的数据不完整，请稍后重试。"].includes(caught.message) ? caught.message : "玩家查询暂时不可用，请稍后重试。");
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

  const textures = equippedTextures(player);
  const avatarUrl = player ? `https://crafthead.net/avatar/${encodeURIComponent(player.id)}/96` : "";
  const skinUrl = textureUrl(player?.skin_texture) || textures.skin;
  const capeUrl = textures.cape;
  const cachedAt = player?.meta?.cached_at;
  const cachedDate = typeof cachedAt === "number" && Number.isFinite(cachedAt) && cachedAt >= 0 ? new Date(cachedAt * 1000) : null;

  return <section className="mc-section" id="player" aria-labelledby="player-heading"><div className="mc-section-header"><div><span className="mc-overline">05 / PLAYER ARCHIVE</span><h2 id="player-heading">玩家 UUID 与<span>皮肤查询</span></h2></div><span className="mc-section-mark" aria-hidden="true">♟</span></div>
    <p className="mc-section-description">输入 Java 版玩家名或 UUID，查询账号 ID、皮肤和已装备的披风。打开页面时自动查询 Pkqa；结果来自 PlayerDB 的缓存接口。</p>
    <div className="mc-lab-grid"><form className="mc-form-panel" onSubmit={lookup}><div className="mc-form-section-label"><span>01</span> 查找玩家</div><label className="mc-field"><span>玩家名或 UUID <small>PLAYER ID</small></span><input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="输入玩家名或 UUID" spellCheck={false} autoComplete="off" /></label><button type="submit" className="mc-primary-action" disabled={loading}>{loading ? "正在查找…" : "查找玩家 ↗"}</button><p className="mc-field-hint">仅查询 Java 版公开账号资料。皮肤由外部服务提供，账号改名或换肤后缓存可能需要一段时间更新。</p></form>
      <aside className="mc-output-panel mc-lookup-panel" aria-live="polite"><div className="mc-output-top"><span><i /> PLAYER PROFILE</span><span>JAVA EDITION</span></div>{error && <p className="mc-output-warning">⚠ {error}</p>}{player ? <><div className="mc-player-profile">{failedAvatar === avatarUrl ? <svg width="96" height="96" viewBox="0 0 96 96" style={{ width: "100%", height: "auto" }} role="img" aria-label={`${player.username} 的头像暂不可用`}><rect x="2" y="2" width="92" height="92" fill="#203b2a" stroke="#a6d59d" strokeWidth="4" /><text x="48" y="65" fill="#e8f3df" fontSize="46" fontFamily="monospace" textAnchor="middle">{player.username.slice(0, 1).toUpperCase()}</text></svg> : <img src={avatarUrl} width="96" height="96" alt={`${player.username} 的 Minecraft 头像`} onError={() => setFailedAvatar(avatarUrl)} />}<div className="mc-player-identity"><span>找到玩家</span><strong>{player.username}</strong><small>JAVA ACCOUNT</small></div><div className="mc-profile-cape">{capeUrl ? skinUrl ? <CapePreview skinUrl={skinUrl} capeUrl={capeUrl} playerName={player.username} /> : <div className="mc-cape-preview">{failedCape === capeUrl ? <span className="mc-profile-cape-empty">披风预览暂不可用</span> : <img src={capeUrl} width="64" height="96" alt={`${player.username} 的已装备披风贴图`} onError={() => setFailedCape(capeUrl)} />}</div> : <span className="mc-profile-cape-empty">未装备披风</span>}</div></div><div className="mc-player-uuid"><span>UUID</span><code>{player.id}</code><button type="button" onClick={() => void copy(player.id)}>{copyLabel(player.id, "复制 UUID ↗")}</button></div>{skinUrl && <div className="mc-skin-link">{failedSkin === skinUrl ? <span className="mc-profile-cape-empty" role="img" aria-label="皮肤预览暂不可用">皮肤预览暂不可用</span> : <img src={skinUrl} width="64" height="64" alt={`${player.username} 的原始皮肤贴图`} onError={() => setFailedSkin(skinUrl)} />}<div><strong>原始皮肤贴图</strong><span>PNG · 原始尺寸</span><a href={skinUrl} target="_blank" rel="noopener noreferrer">打开原图 ↗</a></div></div>}{capeUrl && <p className="mc-output-note">已装备披风以 PlayerDB 最近缓存为准。<a href={capeUrl} target="_blank" rel="noopener noreferrer">打开披风原图 ↗</a></p>}{cachedDate && Number.isFinite(cachedDate.getTime()) && <p className="mc-output-note">资料缓存时间：{cachedDate.toLocaleString("zh-CN")}</p>}</> : !error && <div className="mc-lookup-empty"><span>♙</span><p>{loading ? `正在查找 ${requestedQuery} 的玩家档案…` : "输入玩家名或 UUID 后点击查找"}</p></div>}<p className="mc-output-note">数据来源：<a href="https://playerdb.co/" target="_blank" rel="noopener noreferrer">PlayerDB ↗</a></p></aside></div>
  </section>;
}
