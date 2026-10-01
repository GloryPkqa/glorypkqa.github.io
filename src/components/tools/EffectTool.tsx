"use client";

import { useState } from "react";
import { versionAtLeast, type McCatalog } from "@/lib/mc/give";

export default function EffectTool({ catalog }: { catalog: McCatalog | null }) {
  const [effect, setEffect] = useState("speed");
  const [target, setTarget] = useState("@p");
  const [duration, setDuration] = useState(60);
  const [level, setLevel] = useState(1);
  const [hideParticles, setHideParticles] = useState(false);
  const [copied, setCopied] = useState(false);
  const activeEffect = catalog?.effects?.some((entry) => entry.name === effect) ? effect : catalog?.effects?.[0]?.name ?? effect;
  const available = catalog?.effects?.find((entry) => entry.name === activeEffect);
  const targetValid = /^(@[pares](\[[^\]]*\])?|[A-Za-z0-9_]{3,16})$/.test(target.trim());
  const safeDuration = Math.max(1, Math.min(1_000_000, Math.floor(duration || 1)));
  const safeLevel = Math.max(1, Math.min(256, Math.floor(level || 1)));
  const modern = versionAtLeast(catalog?.version ?? "26.1", "1.13");
  const command = available && targetValid ? modern
    ? `/effect give ${target.trim()} minecraft:${activeEffect} ${safeDuration} ${safeLevel - 1} ${hideParticles}`
    : `/effect ${target.trim()} ${available.id} ${safeDuration} ${safeLevel - 1} ${hideParticles}` : "";

  async function copy() { if (!command) return; try { await navigator.clipboard.writeText(command); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); } }

  return <section className="mc-section" id="effects" aria-labelledby="effects-heading"><div className="mc-section-header"><div><span className="mc-overline">07 / ALCHEMY LAB</span><h2 id="effects-heading">状态效果<span>指令生成器</span></h2></div><span className="mc-section-mark" aria-hidden="true">✚</span></div><p className="mc-section-description">从当前版本的效果目录中选择效果，设定目标、持续时间和等级，生成 Java 版 /effect 指令。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel"><div className="mc-form-section-label"><span>01</span> 效果配置</div><label className="mc-field"><span>状态效果 <small>EFFECT</small></span><select className="mc-select" value={activeEffect} onChange={(event) => setEffect(event.target.value)}>{catalog?.effects?.map((entry) => <option key={entry.name} value={entry.name}>{entry.displayNameZh} · {entry.displayName}</option>)}</select></label><div className="mc-field-grid mc-effect-fields"><label className="mc-field"><span>目标 <small>TARGET</small></span><input value={target} onChange={(event) => setTarget(event.target.value)} spellCheck={false} /></label><label className="mc-field"><span>持续时间（秒）</span><input type="number" min="1" max="1000000" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label><label className="mc-field"><span>效果等级</span><input type="number" min="1" max="256" value={level} onChange={(event) => setLevel(Number(event.target.value))} /></label></div><label className="mc-check"><input type="checkbox" checked={hideParticles} onChange={(event) => setHideParticles(event.target.checked)} /><span className="mc-check-box" aria-hidden="true" /> 隐藏粒子效果</label><p className="mc-field-hint">界面显示的等级从 1 开始，指令放大器从 0 开始。例如等级 II 会写成放大器 1。</p></div>
      <aside className="mc-output-panel"><div className="mc-output-top"><span><i /> EFFECT OUTPUT</span><span>JAVA · {catalog?.version ?? "—"}</span></div><div className="mc-effect-display"><span>✚</span><strong>{available?.displayNameZh ?? "选择效果"}</strong><small>{available ? `${available.displayName} · minecraft:${available.name}` : "正在载入数据…"}</small></div><div className="mc-route-stats"><div><span>等级</span><strong>{safeLevel}</strong></div><div><span>时长</span><strong>{safeDuration} <small>秒</small></strong></div><div><span>粒子</span><strong>{hideParticles ? "隐藏" : "显示"}</strong></div></div><div className="mc-code-heading"><span>生成的指令</span><span>COMMAND</span></div><pre className="mc-code-output"><code>{command || "// 等待版本数据或输入有效目标"}</code></pre>{!targetValid && <p className="mc-output-warning">请输入有效玩家名或目标选择器。</p>}<button className="mc-copy-button" type="button" disabled={!command} onClick={copy}>{copied ? "已复制 ✓" : "复制指令 ↗"}</button></aside></div></section>;
}
