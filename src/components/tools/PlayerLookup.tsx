"use client";
/* eslint-disable @next/next/no-img-element -- Public Minecraft texture URLs are shown directly in a static export. */

import { useState } from "react";

type Player = { username: string; id: string; raw_id?: string; skin_texture?: string; avatar?: string; meta?: { cached_at?: number } };
type PlayerResponse = { code?: string; data?: { player?: Player } };

export default function PlayerLookup() {
  const [query, setQuery] = useState("Notch");
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    const input = query.trim();
    if (!/^([A-Za-z0-9_]{3,16}|[a-fA-F0-9-]{32,36})$/.test(input)) { setError("请输入 3–16 位 Java 玩家名，或 32/36 位 UUID。"); setPlayer(null); return; }
    setLoading(true); setError(""); setPlayer(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(input)}`, { signal: controller.signal });
      if (response.status === 429) throw new Error("查询太频繁，请稍后重试。");
      if (!response.ok) throw new Error("玩家不存在，或接口暂时不可用。");
      const data = await response.json() as PlayerResponse;
      if (!data.data?.player?.id || !data.data.player.username) throw new Error("没有查到这个玩家。");
      setPlayer(data.data.player);
    } catch (caught) { setError(caught instanceof Error && caught.name === "AbortError" ? "查询超时，请稍后重试。" : caught instanceof Error ? caught.message : "查询失败，请稍后重试。"); }
    finally { window.clearTimeout(timeout); setLoading(false); }
  }

  async function copy() { if (!player) return; try { await navigator.clipboard.writeText(player.id); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); } }
  const skinUrl = player?.skin_texture && /^https:\/\/textures\.minecraft\.net\/texture\/[a-f0-9]+$/i.test(player.skin_texture) ? player.skin_texture : "";

  return <section className="mc-section" id="player" aria-labelledby="player-heading"><div className="mc-section-header"><div><span className="mc-overline">05 / PLAYER ARCHIVE</span><h2 id="player-heading">玩家 UUID 与<span>皮肤查询</span></h2></div><span className="mc-section-mark" aria-hidden="true">♟</span></div>
    <p className="mc-section-description">输入 Java 版玩家名或 UUID，查询账号 ID 与公开皮肤贴图。结果来自 PlayerDB 的缓存接口。</p>
    <div className="mc-lab-grid"><form className="mc-form-panel" onSubmit={lookup}><div className="mc-form-section-label"><span>01</span> 查找玩家</div><label className="mc-field"><span>玩家名或 UUID <small>PLAYER ID</small></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Notch" spellCheck={false} autoComplete="off" /></label><button type="submit" className="mc-primary-action" disabled={loading}>{loading ? "正在查找…" : "查找玩家 ↗"}</button><p className="mc-field-hint">仅查询 Java 版公开账号资料。皮肤由外部服务提供，账号改名或换肤后缓存可能需要一段时间更新。</p></form>
      <aside className="mc-output-panel mc-lookup-panel" aria-live="polite"><div className="mc-output-top"><span><i /> PLAYER PROFILE</span><span>JAVA EDITION</span></div>{error && <p className="mc-output-warning">⚠ {error}</p>}{player ? <><div className="mc-player-profile"><img src={`https://crafthead.net/avatar/${encodeURIComponent(player.id)}/96`} width="96" height="96" alt={`${player.username} 的 Minecraft 头像`} /><div><span>找到玩家</span><strong>{player.username}</strong><small>JAVA ACCOUNT</small></div></div><div className="mc-player-uuid"><span>UUID</span><code>{player.id}</code><button type="button" onClick={copy}>{copied ? "已复制 ✓" : "复制 UUID ↗"}</button></div>{skinUrl && <div className="mc-skin-link"><img src={skinUrl} width="64" height="64" alt={`${player.username} 的原始皮肤贴图`} /><div><strong>原始皮肤贴图</strong><span>PNG · 原始尺寸</span><a href={skinUrl} target="_blank" rel="noopener noreferrer">打开原图 ↗</a></div></div>}{player.meta?.cached_at && <p className="mc-output-note">资料缓存时间：{new Date(player.meta.cached_at * 1000).toLocaleString("zh-CN")}</p>}</> : !error && <div className="mc-lookup-empty"><span>♙</span><p>玩家档案等待中<br />输入名字，找回那张熟悉的皮肤。</p></div>}<p className="mc-output-note">数据来源：<a href="https://playerdb.co/" target="_blank" rel="noopener noreferrer">PlayerDB ↗</a></p></aside></div>
  </section>;
}
