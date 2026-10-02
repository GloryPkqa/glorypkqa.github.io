"use client";

import { useState } from "react";
import useCopyFeedback from "@/lib/useCopyFeedback";
import { versionAtLeast, type McCatalog } from "@/lib/mc/give";
import { makePotionCommand, type PotionEffect } from "@/lib/mc/potion";

type EffectRow = Omit<PotionEffect, "duration" | "level"> & { key: number; duration: number | ""; level: number | "" };
const STARTER_EFFECTS: EffectRow[] = [
  { key: 1, name: "speed", duration: 60, level: 1 },
  { key: 2, name: "strength", duration: 60, level: 1 },
];

export default function EffectTool({ catalog }: { catalog: McCatalog | null }) {
  const [effect, setEffect] = useState("speed");
  const [target, setTarget] = useState("@p");
  const [duration, setDuration] = useState<number | "">(60);
  const [level, setLevel] = useState<number | "">(1);
  const [hideParticles, setHideParticles] = useState(false);
  const [potionMode, setPotionMode] = useState(false);
  const [potionEffects, setPotionEffects] = useState<EffectRow[]>(STARTER_EFFECTS);
  const [nextKey, setNextKey] = useState(3);
  const { copy, copyLabel } = useCopyFeedback();
  const activeEffect = catalog?.effects?.some((entry) => entry.name === effect) ? effect : catalog?.effects?.[0]?.name ?? effect;
  const available = catalog?.effects?.find((entry) => entry.name === activeEffect);
  const selector = target.trim().match(/^@([pares])(\[[^\]]*\])?$/);
  const targetValid = /^[A-Za-z0-9_]{3,16}$/.test(target.trim()) || Boolean(selector
    && (selector[1] !== "s" || versionAtLeast(catalog?.version ?? "26.1", "1.12"))
    && (!potionMode || selector[1] !== "e"));
  const safeDuration = Math.max(1, Math.min(1_000_000, Math.floor(duration || 1)));
  const safeLevel = Math.max(1, Math.min(256, Math.floor(level || 1)));
  const modern = versionAtLeast(catalog?.version ?? "26.1", "1.13");
  const maxPotionLevel = versionAtLeast(catalog?.version ?? "26.1", "1.20.2") ? 256 : 128;
  const visiblePotionEffects = potionEffects.filter((row) => catalog?.effects.some((entry) => entry.name === row.name))
    .map((row) => ({ ...row, level: row.level === "" ? "" as const : Math.min(row.level, maxPotionLevel) }));
  const excludedEffects = potionEffects.length - visiblePotionEffects.length;
  const inputComplete = potionMode ? visiblePotionEffects.every((row) => row.duration !== "" && row.level !== "") : duration !== "" && level !== "";
  const command = !targetValid || !catalog || !inputComplete ? "" : potionMode
    ? makePotionCommand({ version: catalog.version, target: target.trim(), catalog, hideParticles, effects: visiblePotionEffects.map((row) => ({ ...row, duration: Number(row.duration), level: Number(row.level) })) })
    : available ? modern
      ? `/effect give ${target.trim()} minecraft:${activeEffect} ${safeDuration} ${safeLevel - 1} ${hideParticles}`
      : `/effect ${target.trim()} ${available.id} ${safeDuration} ${safeLevel - 1} ${hideParticles}`
    : "";

  function updatePotion(key: number, field: keyof PotionEffect, value: string | number) {
    const safeValue = (field === "level" || field === "duration") && value === "" ? "" : field === "level" ? Math.max(1, Math.min(maxPotionLevel, Math.floor(Number(value) || 1)))
      : field === "duration" ? Math.max(1, Math.min(1_000_000, Math.floor(Number(value) || 1))) : value;
    setPotionEffects((rows) => rows.map((row) => row.key === key ? { ...row, [field]: safeValue } : row));
  }

  function addPotionEffect() {
    const unused = catalog?.effects.find((entry) => !visiblePotionEffects.some((row) => row.name === entry.name));
    if (!unused) return;
    setPotionEffects((rows) => [...rows, { key: nextKey, name: unused.name, duration: 60, level: 1 }]);
    setNextKey((current) => current + 1);
  }

  return <section className="mc-section" id="effects" aria-labelledby="effects-heading"><div className="mc-section-header"><div><span className="mc-overline">07 / ALCHEMY LAB</span><h2 id="effects-heading">状态效果<span>指令生成器</span></h2></div><span className="mc-section-mark" aria-hidden="true">✚</span></div><p className="mc-section-description">选择单个状态效果生成 /effect 指令，或切换到多效果药水，生成可饮用药水的 /give 指令。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel"><div className="mc-form-section-label"><span>01</span> {potionMode ? "药水配置" : "效果配置"}</div><label className="mc-check mc-potion-toggle"><input type="checkbox" checked={potionMode} onChange={(event) => setPotionMode(event.target.checked)} /><span className="mc-check-box" aria-hidden="true" /> 生成多效果药水 <small>切换为 /give</small></label>
      {potionMode ? <><div className="mc-potion-list">{visiblePotionEffects.map((row, index) => <div className="mc-potion-row" key={row.key}><div className="mc-potion-row-heading"><strong>效果 {String(index + 1).padStart(2, "0")}</strong><button type="button" onClick={() => setPotionEffects((rows) => rows.filter((entry) => entry.key !== row.key))} aria-label={`移除效果 ${index + 1}`}>移除 ×</button></div><label className="mc-field"><span>状态效果 <small>EFFECT</small></span><select className="mc-select" value={row.name} onChange={(event) => updatePotion(row.key, "name", event.target.value)}>{catalog?.effects.filter((entry) => entry.name === row.name || !visiblePotionEffects.some((selected) => selected.name === entry.name)).map((entry) => <option key={entry.name} value={entry.name}>{entry.displayNameZh} · {entry.displayName}</option>)}</select></label><div className="mc-field-grid"><label className="mc-field"><span>持续时间（秒）</span><input type="number" min="1" max="1000000" value={row.duration} onChange={(event) => updatePotion(row.key, "duration", event.target.value)} /></label><label className="mc-field"><span>效果等级</span><input type="number" min="1" max={versionAtLeast(catalog?.version ?? "26.1", "1.20.2") ? "256" : "128"} value={row.level} onChange={(event) => updatePotion(row.key, "level", event.target.value)} /></label></div></div>)}</div><button className="mc-potion-add" type="button" onClick={addPotionEffect} disabled={!catalog || visiblePotionEffects.length >= catalog.effects.length}>＋ 添加一种效果</button>{excludedEffects > 0 && <p className="mc-output-warning">当前版本没有 {excludedEffects} 种已选效果，已从本版本的药水命令中排除。</p>}{visiblePotionEffects.length === 0 && <p className="mc-field-hint">添加至少一种当前版本支持的效果。</p>}</> : <><label className="mc-field"><span>状态效果 <small>EFFECT</small></span><select className="mc-select" value={activeEffect} onChange={(event) => setEffect(event.target.value)}>{catalog?.effects?.map((entry) => <option key={entry.name} value={entry.name}>{entry.displayNameZh} · {entry.displayName}</option>)}</select></label><div className="mc-field-grid mc-effect-fields"><label className="mc-field"><span>持续时间（秒）</span><input type="number" min="1" max="1000000" value={duration} onChange={(event) => setDuration(event.target.value === "" ? "" : Number(event.target.value))} /></label><label className="mc-field"><span>效果等级</span><input type="number" min="1" max="256" value={level} onChange={(event) => setLevel(event.target.value === "" ? "" : Number(event.target.value))} /></label></div></>}
      <label className="mc-field mc-potion-target"><span>目标 <small>TARGET</small></span><input value={target} onChange={(event) => setTarget(event.target.value)} spellCheck={false} /></label><label className="mc-check"><input type="checkbox" checked={hideParticles} onChange={(event) => setHideParticles(event.target.checked)} /><span className="mc-check-box" aria-hidden="true" /> 隐藏粒子效果</label><p className="mc-field-hint">界面等级从 1 开始，命令放大器从 0 开始。药水持续时间会换算为游戏刻（每秒 20 刻）；旧版本药水最高支持 128 级。</p></div>
      <aside className="mc-output-panel"><div className="mc-output-top"><span><i /> {potionMode ? "POTION OUTPUT" : "EFFECT OUTPUT"}</span><span>JAVA · {catalog?.version ?? "—"}</span></div>{potionMode ? <div className="mc-effect-display"><span>◈</span><strong>自定义药水</strong><small>{visiblePotionEffects.length} 种状态效果 · 可饮用</small></div> : <div className="mc-effect-display"><span>✚</span><strong>{available?.displayNameZh ?? "选择效果"}</strong><small>{available ? `${available.displayName} · minecraft:${available.name}` : "正在载入数据…"}</small></div>}{potionMode ? <div className="mc-potion-summary">{visiblePotionEffects.map((row) => { const entry = catalog?.effects.find((item) => item.name === row.name); return <div key={row.key}><strong>{entry?.displayNameZh ?? row.name}</strong><span>{entry?.displayName} · {row.level === "" ? "等级待填写" : `${row.level} 级`} · {row.duration === "" ? "时长待填写" : `${row.duration} 秒`}</span></div>; })}</div> : <div className="mc-route-stats"><div><span>等级</span><strong>{level === "" ? "—" : safeLevel}</strong></div><div><span>时长</span><strong>{duration === "" ? "—" : safeDuration} <small>秒</small></strong></div><div><span>粒子</span><strong>{hideParticles ? "隐藏" : "显示"}</strong></div></div>}<div className="mc-code-heading"><span>生成的指令</span><span>COMMAND</span></div><pre className="mc-code-output"><code>{command || "// 等待版本数据或输入有效目标和效果"}</code></pre>{!inputComplete && <p className="mc-output-warning" role="alert">请填写完整的持续时间和效果等级后再复制。</p>}{!targetValid && <p className="mc-output-warning">请输入有效玩家名或目标选择器。</p>}<button className="mc-copy-button" type="button" disabled={!command} onClick={() => void copy(command)}>{copyLabel(command)}</button></aside></div></section>;
}
