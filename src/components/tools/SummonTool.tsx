"use client";

import { useState } from "react";
import useCopyFeedback from "@/lib/useCopyFeedback";
import type { McCatalog } from "@/lib/mc/give";

type Point = [string, string, string];

export default function SummonTool({ version, catalog }: { version: string; catalog: McCatalog | null }) {
  const [entity, setEntity] = useState("zombie");
  const [positionMode, setPositionMode] = useState<"here" | "absolute">("here");
  const [point, setPoint] = useState<Point>(["0", "64", "0"]);
  const { copy, isCopied } = useCopyFeedback();

  const entityId = entity.trim().toLowerCase().replace(/^minecraft:/, "");
  const matching = catalog?.entities?.find((entry) => entry.name === entityId);
  const eggId = `${entityId}_spawn_egg`;
  const hasEgg = !!catalog?.items.some((entry) => entry.name === eggId);
  const positionValid = positionMode === "here" || point.every((value) => /^-?\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)));
  const position = positionMode === "here" ? "~ ~ ~" : point.join(" ");
  const summon = matching && positionValid ? `/summon minecraft:${entityId} ${position}` : "";
  const egg = matching && hasEgg ? `/give @p minecraft:${eggId} 1` : "";

  return <section className="mc-section" id="summon" aria-labelledby="summon-heading">
    <div className="mc-section-header"><div><span className="mc-overline">12 / CREATURE FORGE</span><h2 id="summon-heading">实体召唤与刷怪蛋<span>指令生成器</span></h2></div><span className="mc-section-mark" aria-hidden="true">♞</span></div>
    <p className="mc-section-description">从当前 Java 版本的生物与可召唤实体目录中选择目标。可在当前位置或指定绝对坐标召唤；有对应刷怪蛋的实体还能生成物品指令。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel">
      <div className="mc-form-section-label"><span>01</span> 选择实体</div>
      <label className="mc-field"><span>实体 ID <small>ENTITY</small></span><input list="mc-entity-list" value={entity} onChange={(event) => setEntity(event.target.value)} spellCheck={false} autoComplete="off" placeholder="zombie" /><datalist id="mc-entity-list">{catalog?.entities?.map((entry) => <option key={entry.name} value={entry.name} label={entry.displayName} />)}</datalist><em>{!catalog ? "正在载入实体数据…" : !catalog.entities ? "实体数据未更新，请刷新页面后重试" : matching ? `${matching.displayName} · minecraft:${matching.name}` : "请选择当前版本目录中的实体 ID"}</em></label>
      <div className="mc-form-section-label"><span>02</span> 召唤位置</div>
      <div className="mc-dimension-tabs" role="group" aria-label="召唤位置模式"><button type="button" className={positionMode === "here" ? "active" : ""} aria-pressed={positionMode === "here"} onClick={() => setPositionMode("here")}>当前位置 ~ ~ ~</button><button type="button" className={positionMode === "absolute" ? "active" : ""} aria-pressed={positionMode === "absolute"} onClick={() => setPositionMode("absolute")}>指定绝对坐标</button></div>
      {positionMode === "absolute" && <div className="mc-coordinate-grid">{(["X", "Y", "Z"] as const).map((axis, index) => <label className="mc-field" key={axis}><span>{axis}</span><input type="number" step="1" value={point[index]} onChange={(event) => setPoint(point.map((value, i) => i === index ? event.target.value : value) as Point)} /></label>)}</div>}
      <p className="mc-field-hint">当前位置使用相对坐标，执行指令的玩家或命令方块是坐标基准。指定坐标时请输入整数。刷怪蛋仅对当前物品目录中存在对应物品的实体开放。</p>
    </div><aside className="mc-output-panel mc-color-output"><div className="mc-output-top"><span><i /> SUMMON OUTPUT</span><span>JAVA · {version}</span></div>
      <div className="mc-effect-display"><span aria-hidden="true">♞</span><strong>{matching?.displayName ?? "选择实体"}</strong><small>{matching ? `minecraft:${matching.name}` : "minecraft:..."}</small></div>
      {!positionValid && <p className="mc-output-warning">X、Y、Z 都需要填写有效整数。</p>}
      {[{ id: "summon", label: "召唤实体", value: summon }, { id: "egg", label: "获取刷怪蛋", value: egg }].map((entry) => <div className="mc-color-result" key={entry.id}><div className="mc-code-heading"><span>{entry.label}</span><span>COMMAND</span></div><pre className="mc-code-output"><code>{entry.value || (entry.id === "egg" && matching ? "// 此实体没有对应刷怪蛋" : "// 选择实体并填写有效坐标")}</code></pre><button className="mc-copy-button" type="button" disabled={!entry.value} onClick={() => copy(entry.value)}>{isCopied(entry.value) ? "已复制 ✓" : "复制指令 ↗"}</button></div>)}
      <p className="mc-output-note">目录来自构建时的版本数据。个别实体可能受世界环境、难度或服务器规则限制；请在对应游戏版本中验证。</p>
    </aside></div>
  </section>;
}
