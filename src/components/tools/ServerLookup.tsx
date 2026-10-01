"use client";

import { useState } from "react";

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

export default function ServerLookup() {
  const [edition, setEdition] = useState<"java" | "bedrock">("java");
  const [address, setAddress] = useState("demo.mcstatus.io");
  const [result, setResult] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastAddress, setLastAddress] = useState("");

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    const host = address.trim();
    if (!/^(?=.{1,253}(?::\d{1,5})?$)[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(host) || host.includes("..")) {
      setError("请输入服务器域名或 IP，可附加端口，例如 play.example.com:25565。"); setResult(null); return;
    }
    setLoading(true); setError(""); setResult(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`https://api.mcstatus.io/v2/status/${edition}/${encodeURIComponent(host)}?query=false`, { signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 429 ? "查询太频繁，请稍后重试。" : "接口暂时不可用，请稍后重试。");
      const data = await response.json() as ServerStatus;
      if (typeof data.online !== "boolean") throw new Error("接口返回了无法识别的数据。");
      setResult(data); setLastAddress(host);
    } catch (caught) {
      setError(caught instanceof Error && caught.name === "AbortError" ? "查询超时，请稍后重试。" : caught instanceof Error ? caught.message : "查询失败，请稍后重试。");
    } finally { window.clearTimeout(timeout); setLoading(false); }
  }

  return <section className="mc-section" id="server" aria-labelledby="server-heading"><div className="mc-section-header"><div><span className="mc-overline">04 / LIVE SIGNAL</span><h2 id="server-heading">服务器状态<span>查询</span></h2></div><span className="mc-section-mark" aria-hidden="true">◈</span></div>
    <p className="mc-section-description">输入地址即可查看 Java 或基岩版服务器的在线状态。查询通过 mcstatus.io 的公共接口完成，结果通常会有短暂缓存。</p>
    <div className="mc-lab-grid"><form className="mc-form-panel" onSubmit={lookup}><div className="mc-form-section-label"><span>01</span> 服务器信息</div><div className="mc-dimension-tabs"><button type="button" disabled={loading} className={edition === "java" ? "active" : ""} aria-pressed={edition === "java"} onClick={() => { setEdition("java"); setResult(null); setError(""); }}>Java Edition</button><button type="button" disabled={loading} className={edition === "bedrock" ? "active" : ""} aria-pressed={edition === "bedrock"} onClick={() => { setEdition("bedrock"); setResult(null); setError(""); }}>Bedrock Edition</button></div><label className="mc-field"><span>服务器地址 <small>HOST : PORT</small></span><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="play.example.com" spellCheck={false} autoComplete="off" /></label><button type="submit" className="mc-primary-action" disabled={loading}>{loading ? "正在连接…" : "查询服务器 ↗"}</button><p className="mc-field-hint">Java 默认端口 25565，基岩版默认 19132。查询结果由第三方缓存服务提供，页面不会持续自动刷新。</p></form>
      <aside className="mc-output-panel mc-lookup-panel" aria-live="polite"><div className="mc-output-top"><span><i /> SERVER SIGNAL</span><span>{edition.toUpperCase()}</span></div>{error && <p className="mc-output-warning">⚠ {error}</p>}{result ? <><div className="mc-server-status"><span className={`mc-status-dot${result.online ? " online" : ""}`} /><span>{result.online ? "服务器在线" : "服务器离线或未响应"}</span></div><strong className="mc-server-address">{lastAddress}</strong>{result.online && <><div className="mc-route-stats"><div><span>在线玩家</span><strong>{result.players?.online ?? "—"} <small>/ {result.players?.max ?? "—"}</small></strong></div><div><span>游戏版本</span><strong className="mc-version-value">{result.version?.name_clean ?? result.version?.name_raw ?? "未知"}</strong></div><div><span>端口</span><strong>{result.port ?? "—"}</strong></div></div>{result.motd?.clean && <div className="mc-server-motd"><span>MOTD</span><p>{result.motd.clean}</p></div>}</>}{result.retrieved_at && <p className="mc-output-note">数据获取时间：{new Date(result.retrieved_at).toLocaleString("zh-CN")}{result.expires_at ? ` · 缓存至 ${new Date(result.expires_at).toLocaleTimeString("zh-CN")}` : ""}</p>}</> : !error && <div className="mc-lookup-empty"><span>◇</span><p>信号等待中<br />输入地址，点亮你的服务器。</p></div>}<p className="mc-output-note">数据来源：<a href="https://mcstatus.io/docs" target="_blank" rel="noopener noreferrer">mcstatus.io API ↗</a></p></aside></div>
  </section>;
}
