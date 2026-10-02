"use client";

import { useEffect, useRef, useState } from "react";

type ServerStatus = {
  online: boolean;
  host?: string;
  port?: number;
  retrieved_at?: number;
  expires_at?: number;
  version?: { name_clean?: string; name_raw?: string };
  players?: { online?: number; max?: number };
  motd?: { clean?: string };
};
type SecondaryStatus = { online?: boolean; port?: number; version?: string; players?: { online?: number; max?: number }; motd?: { clean?: string[] }; debug?: { cachetime?: number; cacheexpire?: number } };

function decodeMotd(value: string) {
  const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
  return value.replace(/&(?:amp|lt|gt|quot|#39);/g, (match) => entities[match]);
}

async function requestStatus<T>(url: string, signal: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) controller.abort();
  const timer = window.setTimeout(() => controller.abort(), 11000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 429 ? "查询太频繁" : `接口返回 ${response.status}`);
    return await response.json() as T;
  } finally { window.clearTimeout(timer); signal.removeEventListener("abort", cancel); }
}

export default function ServerLookup() {
  const [edition, setEdition] = useState<"java" | "bedrock">("java");
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastAddress, setLastAddress] = useState("");
  const [source, setSource] = useState<"mcstatus" | "mcsrvstat">("mcstatus");
  const [fallbackNote, setFallbackNote] = useState("");
  const pending = useRef<AbortController | null>(null);
  function cancelLookup() {
    const previous = pending.current; pending.current = null; previous?.abort();
    setLoading(false); setResult(null); setError(""); setFallbackNote("");
  }
  useEffect(() => () => { const previous = pending.current; pending.current = null; previous?.abort(); }, []);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    const host = address.trim();
    cancelLookup();
    if (!host) { setError("请先输入要查询的服务器地址。"); setResult(null); return; }
    const port = host.includes(":") ? Number(host.split(":")[1]) : null;
    if (!/^(?=.{1,253}(?::\d{1,5})?$)[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(host) || host.includes("..") || (port !== null && (port < 1 || port > 65535))) {
      setError("请输入服务器域名或 IP，可附加端口，例如 play.example.com:25565。"); setResult(null); return;
    }
    setLoading(true); setError(""); setResult(null); setFallbackNote(""); setSource("mcstatus");
    const controller = new AbortController(); pending.current = controller;
    let primary: ServerStatus | null = null;
    try {
      primary = await requestStatus<ServerStatus>(`https://api.mcstatus.io/v2/status/${edition}/${encodeURIComponent(host)}?query=false`, controller.signal);
      if (typeof primary.online !== "boolean") throw new Error("返回格式有误");
    } catch { primary = null; }
    if (pending.current !== controller || controller.signal.aborted) return;
    if (primary?.online) {
      setResult(primary); setSource("mcstatus"); setLastAddress(host); setLoading(false); pending.current = null; return;
    }
    try {
      const secondary = await requestStatus<SecondaryStatus>(`https://api.mcsrvstat.us/${edition === "bedrock" ? "bedrock/" : ""}3/${encodeURIComponent(host)}`, controller.signal);
      if (pending.current !== controller || controller.signal.aborted) return;
      if (typeof secondary.online !== "boolean") throw new Error("返回格式有误");
      setResult({ online: secondary.online, port: secondary.port, version: { name_clean: secondary.version }, players: secondary.players, motd: { clean: secondary.motd?.clean?.map(decodeMotd).join("\n") }, retrieved_at: secondary.debug?.cachetime ? secondary.debug.cachetime * 1000 : undefined, expires_at: secondary.debug?.cacheexpire ? secondary.debug.cacheexpire * 1000 : undefined });
      setSource("mcsrvstat"); setLastAddress(host);
      if (!secondary.online) setFallbackNote("两家服务都未探测到在线响应；这不一定代表游戏客户端无法连接。");
      else if (primary && !primary.online) setFallbackNote("首个查询源未探测到响应，备用源返回在线。不同服务的探测位置与缓存可能不同。");
    } catch {
      if (pending.current !== controller || controller.signal.aborted) return;
      setError(primary ? "首个查询源未探测到响应，备用源也无法确认。请稍后重试或在游戏客户端连接验证。" : "两家状态接口暂时无法访问，请稍后重试。");
    } finally { if (pending.current === controller) { pending.current = null; setLoading(false); } }
  }

  return <section className="mc-section" id="server" aria-labelledby="server-heading"><div className="mc-section-header"><div><span className="mc-overline">04 / LIVE SIGNAL</span><h2 id="server-heading">服务器状态<span>查询</span></h2></div><span className="mc-section-mark" aria-hidden="true">◈</span></div>
    <p className="mc-section-description">输入地址即可查看 Java 或基岩版服务器的在线状态。首选 mcstatus.io 查询，离线或失败时再用 MCSrvStat.us 核对；两家结果都可能有短暂缓存。</p>
    <div className="mc-lab-grid"><form className="mc-form-panel" onSubmit={lookup}><div className="mc-form-section-label"><span>01</span> 服务器信息</div><div className="mc-dimension-tabs"><button type="button" className={edition === "java" ? "active" : ""} aria-pressed={edition === "java"} onClick={() => { cancelLookup(); setEdition("java"); }}>Java Edition</button><button type="button" className={edition === "bedrock" ? "active" : ""} aria-pressed={edition === "bedrock"} onClick={() => { cancelLookup(); setEdition("bedrock"); }}>Bedrock Edition</button></div><label className="mc-field"><span>服务器地址 <small>HOST : PORT</small></span><input value={address} onChange={(event) => { cancelLookup(); setAddress(event.target.value); }} placeholder="例如 play.example.com" spellCheck={false} autoComplete="off" /></label><button type="submit" className="mc-primary-action" disabled={loading}>{loading ? "正在连接…" : "查询服务器 ↗"}</button><p className="mc-field-hint">Java 默认端口 25565，基岩版默认 19132。查询结果由第三方缓存服务提供，页面不会持续自动刷新。</p></form>
      <aside className="mc-output-panel mc-lookup-panel" aria-live="polite"><div className="mc-output-top"><span><i /> SERVER SIGNAL</span><span>{edition.toUpperCase()}</span></div>{error && <p className="mc-output-warning">⚠ {error}</p>}{result ? <><div className="mc-server-status"><span className={`mc-status-dot${result.online ? " online" : ""}`} /><span>{result.online ? "服务器在线" : "暂未探测到在线响应"}</span></div><strong className="mc-server-address">{lastAddress}</strong>{fallbackNote && <p className="mc-output-warning">{fallbackNote}</p>}{result.online && <><div className="mc-route-stats"><div><span>在线玩家</span><strong>{result.players?.online ?? "—"} <small>/ {result.players?.max ?? "—"}</small></strong></div><div><span>游戏版本</span><strong className="mc-version-value">{result.version?.name_clean ?? result.version?.name_raw ?? "未知"}</strong></div><div><span>端口</span><strong>{result.port ?? "—"}</strong></div></div>{result.motd?.clean && <div className="mc-server-motd"><span>MOTD</span><p>{result.motd.clean}</p></div>}</>}{result.retrieved_at && <p className="mc-output-note">数据获取时间：{new Date(result.retrieved_at).toLocaleString("zh-CN")}{result.expires_at ? ` · 缓存至 ${new Date(result.expires_at).toLocaleTimeString("zh-CN")}` : ""}</p>}</> : !error && <div className="mc-lookup-empty"><span>◇</span><p>信号等待中<br />输入地址，点亮你的服务器。</p></div>}<p className="mc-output-note">数据来源：{source === "mcstatus" ? <a href="https://mcstatus.io/docs" target="_blank" rel="noopener noreferrer">mcstatus.io ↗</a> : <a href="https://api.mcsrvstat.us/" target="_blank" rel="noopener noreferrer">MCSrvStat.us ↗</a>}</p></aside></div>
  </section>;
}
