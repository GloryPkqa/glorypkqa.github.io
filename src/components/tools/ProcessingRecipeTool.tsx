"use client";

import { useMemo, useState } from "react";
import { ItemIcon } from "@/components/tools/RecipeTool";
import type { McCatalog, McProcessingRecipe } from "@/lib/mc/give";

type Station = "furnace" | "stonecutting" | "smithing" | "brewing";
const STATIONS: { id: Station; label: string; icon: string }[] = [
  { id: "furnace", label: "熔炼", icon: "♨" }, { id: "stonecutting", label: "切石", icon: "▧" },
  { id: "smithing", label: "锻造", icon: "⚒" }, { id: "brewing", label: "酿造", icon: "⚗" },
];
const COOKING: Record<string, string> = { smelting: "熔炉", blasting: "高炉", smoking: "烟熏炉", campfire_cooking: "营火" };
const BREWING = [
  { base: "水瓶", ingredient: "nether_wart", result: "粗制药水", english: "Awkward Potion" },
  { base: "水瓶", ingredient: "fermented_spider_eye", result: "虚弱药水", english: "Potion of Weakness" },
  { base: "粗制药水", ingredient: "sugar", result: "迅捷药水", english: "Potion of Swiftness" },
  { base: "粗制药水", ingredient: "blaze_powder", result: "力量药水", english: "Potion of Strength" },
  { base: "粗制药水", ingredient: "glistering_melon_slice", result: "治疗药水", english: "Potion of Healing" },
  { base: "粗制药水", ingredient: "magma_cream", result: "抗火药水", english: "Potion of Fire Resistance" },
  { base: "粗制药水", ingredient: "golden_carrot", result: "夜视药水", english: "Potion of Night Vision" },
  { base: "粗制药水", ingredient: "pufferfish", result: "水肺药水", english: "Potion of Water Breathing" },
  { base: "粗制药水", ingredient: "spider_eye", result: "剧毒药水", english: "Potion of Poison" },
  { base: "粗制药水", ingredient: "ghast_tear", result: "再生药水", english: "Potion of Regeneration" },
  { base: "粗制药水", ingredient: "rabbit_foot", result: "跳跃药水", english: "Potion of Leaping" },
  { base: "粗制药水", ingredient: "phantom_membrane", result: "缓降药水", english: "Potion of Slow Falling" },
  { base: "夜视药水", ingredient: "fermented_spider_eye", result: "隐身药水", english: "Potion of Invisibility" },
  { base: "治疗药水", ingredient: "fermented_spider_eye", result: "伤害药水", english: "Potion of Harming" },
  { base: "迅捷药水", ingredient: "fermented_spider_eye", result: "迟缓药水", english: "Potion of Slowness" },
];

function itemIds(value: string | string[] | null) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((entry) => entry.replace(/^minecraft:/, ""));
}

function stationFor(recipe: McProcessingRecipe): Station {
  return recipe.type in COOKING ? "furnace" : recipe.type.startsWith("smithing") ? "smithing" : "stonecutting";
}

export default function ProcessingRecipeTool({ version, catalog }: { version: string; catalog: McCatalog | null }) {
  const [station, setStation] = useState<Station>("furnace");
  const [method, setMethod] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [limit, setLimit] = useState(60);
  const items = useMemo(() => new Map(catalog?.items.map((entry) => [entry.name, entry]) ?? []), [catalog]);
  const name = (value: string | null) => {
    if (!value) return "依底材变化";
    const id = value.replace(/^minecraft:/, "");
    return id.startsWith("#") ? `标签 ${id}` : `${items.get(id)?.displayNameZh ?? id} · ${items.get(id)?.displayName ?? id}`;
  };
  const all = catalog?.processingRecipes ?? [];
  const search = query.trim().toLocaleLowerCase();
  const visible = all.filter((entry) => stationFor(entry) === station && (method === "all" || entry.type === method)).filter((entry) => {
    if (!search) return true;
    const ingredient = [...itemIds(entry.ingredient), ...itemIds(entry.base), ...itemIds(entry.addition), ...itemIds(entry.template)];
    const words = [entry.id, name(entry.result), ...ingredient.map((id) => name(id))].join(" ").toLocaleLowerCase();
    return words.includes(search);
  });
  const active = visible.find((entry) => entry.id === selected) ?? visible[0];
  const brew = BREWING.filter((entry) => items.has(entry.ingredient) && `${entry.base} ${entry.result} ${entry.english} ${name(entry.ingredient)}`.toLocaleLowerCase().includes(search));
  const [selectedBrew, setSelectedBrew] = useState(0);
  const activeBrew = brew[Math.min(selectedBrew, Math.max(brew.length - 1, 0))];

  function icon(id: string) {
    const normalized = id.replace(/^minecraft:/, "");
    return normalized.startsWith("#") ? <span className="mc-recipe-icon-fallback">#</span> : <ItemIcon id={normalized} item={items.get(normalized)} />;
  }

  function ingredient(value: string | string[] | null, label: string) {
    const options = itemIds(value);
    return <div className="mc-process-slot"><span>{label}</span>{options.length ? <><div>{icon(options[0])}<strong>{name(options[0])}</strong></div>{options.length > 1 && <small>或其他 {options.length - 1} 种材料</small>}</> : <div><strong>—</strong></div>}</div>;
  }

  return <section className="mc-section" id="processing" aria-labelledby="processing-heading">
    <div className="mc-section-header"><div><span className="mc-overline">14 / RECIPE ATLAS</span><h2 id="processing-heading">进阶配方<span>查询器</span></h2></div><span className="mc-section-mark" aria-hidden="true">♨</span></div>
    <p className="mc-section-description">切换熔炉、高炉、烟熏炉、营火、切石机、锻造台和酿造台。配方和可选材料按当前 Java 版本筛选。</p>
    <div className="mc-process-tabs" role="group" aria-label="配方设备">{STATIONS.map((entry) => <button type="button" key={entry.id} className={station === entry.id ? "active" : ""} aria-pressed={station === entry.id} onClick={() => { setStation(entry.id); setMethod("all"); setSelected(""); setQuery(""); }}><span>{entry.icon}</span>{entry.label}</button>)}</div>
    <div className="mc-lab-grid"><div className="mc-form-panel"><div className="mc-form-section-label"><span>01</span> 查找配方</div>
      {station === "furnace" && <div className="mc-recipe-subgroups" role="group" aria-label="熔炼设备"><button type="button" className={method === "all" ? "active" : ""} onClick={() => setMethod("all")}>全部</button>{Object.entries(COOKING).map(([id, label]) => <button type="button" key={id} className={method === id ? "active" : ""} onClick={() => setMethod(id)}>{label}</button>)}</div>}
      <label className="mc-field mc-process-search"><span>中文 / English / 物品 ID</span><input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(60); }} placeholder="搜索产物或材料" spellCheck={false} /></label>
      <p className="mc-recipe-count">{station === "brewing" ? brew.length : visible.length} 条配方 · Java {version}</p>
      <div className="mc-process-list">{station === "brewing" ? brew.map((entry, index) => <button type="button" key={`${entry.base}-${entry.ingredient}`} className={activeBrew === entry ? "active" : ""} onClick={() => setSelectedBrew(index)}>{icon(entry.ingredient)}<span><strong>{entry.result}</strong><small>{entry.english} · {entry.base}</small></span><b>↗</b></button>) : visible.slice(0, limit).map((entry) => <button type="button" key={entry.id} className={active === entry ? "active" : ""} onClick={() => setSelected(entry.id)}>{entry.result ? icon(entry.result) : <span className="mc-recipe-icon-fallback">⚒</span>}<span><strong>{entry.result ? name(entry.result).split(" · ")[0] : "盔甲纹饰"}</strong><small>{entry.result ? name(entry.result).split(" · ").slice(1).join(" · ") : "Armor Trim"} · {COOKING[entry.type] ?? (entry.type === "stonecutting" ? "切石机" : "锻造台")}</small></span><b>↗</b></button>)}</div>
      {visible.length > limit && station !== "brewing" && <button type="button" className="mc-recipe-more" onClick={() => setLimit((value) => value + 60)}>显示更多配方 ↓</button>}
      {(station === "brewing" ? !brew.length : !visible.length) && <p className="mc-field-hint">当前版本和搜索条件下没有匹配配方。</p>}
    </div><aside className="mc-output-panel mc-color-output"><div className="mc-output-top"><span><i /> RECIPE DETAIL</span><span>{STATIONS.find((entry) => entry.id === station)?.label} · {version}</span></div>
      {station === "brewing" && activeBrew ? <><div className="mc-process-hero"><ItemIcon id="potion" item={items.get("potion")} size={48} /><div><strong>{activeBrew.result}</strong><small>{activeBrew.english}</small></div></div><div className="mc-process-flow">{ingredient("potion", `基底：${activeBrew.base}`)}<span>＋</span>{ingredient(activeBrew.ingredient, "酿造材料")}<span>→</span><div className="mc-process-slot"><span>结果</span><div><ItemIcon id="potion" item={items.get("potion")} /><strong>{activeBrew.result}</strong></div></div></div><p className="mc-output-note">酿造台需要烈焰粉燃料。此处展示基础药水路线；红石、萤石粉、火药和龙息可用于延长、强化或改变药水形态。</p></> : station !== "brewing" && active ? <><div className="mc-process-hero">{active.result ? icon(active.result) : <span className="mc-recipe-icon-fallback">⚒</span>}<div><strong>{active.result ? name(active.result).split(" · ")[0] : "盔甲纹饰"}</strong><small>{active.id.replaceAll("_", " ")}</small></div><b>× {active.count}</b></div><div className="mc-process-flow">{active.ingredient ? ingredient(active.ingredient, "原料") : <>{active.template && ingredient(active.template, "模板")}{ingredient(active.base, "底材")}{ingredient(active.addition, "添加材料")}</>}<span>→</span><div className="mc-process-slot"><span>产物</span><div>{active.result ? icon(active.result) : <span className="mc-recipe-icon-fallback">⚒</span>}<strong>{name(active.result)}</strong></div></div></div>{active.ticks !== null && <p className="mc-field-hint">加工时间 {active.ticks / 20} 秒 · 经验 {active.xp ?? 0}</p>}{active.type === "smithing_trim" && <p className="mc-field-hint">盔甲纹饰只改变外观，具体结果由所选底材与纹饰材料决定。</p>}<p className="mc-output-note">配方数据：<a href="https://github.com/misode/mcmeta" target="_blank" rel="noopener noreferrer">misode / mcmeta ↗</a>。带 # 的材料代表原版物品标签，可使用标签内的任意物品。</p></> : <div className="mc-lookup-empty"><span>♨</span><p>请选择一条配方查看材料与产物。</p></div>}
    </aside></div>
  </section>;
}
