"use client";
/* eslint-disable @next/next/no-img-element -- Item renders are served by a third-party Minecraft image API. */

import { useMemo, useState } from "react";
import type { McCatalog, McItem } from "@/lib/mc/give";

const GROUPS = [
  { id: "all", label: "全部", categories: [] },
  { id: "build", label: "建造", categories: ["building", "coloured", "natural"] },
  { id: "gear", label: "装备", categories: ["combat", "tools"] },
  { id: "survival", label: "生存", categories: ["food", "ingredients", "plants"] },
  { id: "devices", label: "机关", categories: ["redstone", "functional"] },
  { id: "other", label: "其他", categories: ["music", "misc", "spawn_eggs"] },
] as const;
const SUBCATEGORY_NAMES: Record<string, string> = {
  building: "建筑方块", coloured: "彩色装饰", natural: "自然材料", combat: "武器与护甲", tools: "工具",
  food: "食物", ingredients: "合成材料", plants: "植物", redstone: "红石", functional: "功能方块",
  music: "音乐", misc: "杂项", spawn_eggs: "生物蛋",
};

export function ItemIcon({ id, item, size = 36 }: { id: string; item?: McItem; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = item?.icon ? `https://blockrender.dev/render/item/${encodeURIComponent(id)}.png?size=64` : item?.iconUrl;
  if (!url || failed) return <span className="mc-recipe-icon-fallback" aria-hidden="true">{id.includes("chest") ? "▤" : id.includes("statue") ? "♟" : "▦"}</span>;
  return <img src={url} width={size} height={size} loading="lazy" decoding="async" alt="" onError={() => setFailed(true)} />;
}

export default function RecipeTool({ version, catalog }: { version: string; catalog: McCatalog | null }) {
  const [item, setItem] = useState("diamond_pickaxe");
  const [variant, setVariant] = useState(0);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [limit, setLimit] = useState(48);
  const itemId = item.trim().toLowerCase().replace(/^minecraft:/, "");
  const itemMap = useMemo(() => new Map(catalog?.items.map((entry) => [entry.name, entry]) ?? []), [catalog]);
  const craftable = useMemo(() => catalog?.items.filter((entry) => !!catalog.recipes?.[entry.name]?.length) ?? [], [catalog]);
  const activeGroup = GROUPS.find((entry) => entry.id === group) ?? GROUPS[0];
  const search = query.trim().toLocaleLowerCase();
  const filtered = craftable.filter((entry) => {
    if (search) return `${entry.name} ${entry.displayName} ${entry.displayNameZh}`.toLocaleLowerCase().includes(search);
    if (group !== "all" && !(activeGroup.categories as readonly string[]).includes(entry.category)) return false;
    return subcategory === "all" || entry.category === subcategory;
  });
  const itemData = itemMap.get(itemId);
  const recipes = catalog?.recipes?.[itemId] ?? [];
  const index = Math.min(variant, Math.max(0, recipes.length - 1));
  const recipe = recipes[index];
  const shape = recipe?.shape?.flatMap((row, rowIndex) => row.map((ingredient, columnIndex) => ({ ingredient, position: rowIndex * 3 + columnIndex + 1 }))) ?? [];

  function selectItem(id: string) { setItem(id); setVariant(0); }

  function ingredient(id: string, key: string) {
    const entry = itemMap.get(id);
    return <div className="mc-recipe-ingredient" key={key} title={`${entry?.displayNameZh ?? id} · ${entry?.displayName ?? id}`}><ItemIcon key={id} id={id} item={entry} size={34} /><strong>{entry?.displayNameZh ?? id}</strong><small>{entry?.displayName ?? id}</small></div>;
  }

  return <section className="mc-section" id="recipes" aria-labelledby="recipes-heading">
    <div className="mc-section-header"><div><span className="mc-overline">10 / CRAFTING TABLE</span><h2 id="recipes-heading">工作台配方<span>查询器</span></h2></div><span className="mc-section-mark" aria-hidden="true">⊞</span></div>
    <p className="mc-section-description">按大类、小类或中英文名称浏览合成产物。点选带图标的物品卡片，查看九宫格与替代配方。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel"><div className="mc-form-section-label"><span>01</span> 查找产物</div>
      <label className="mc-field"><span>搜索名称或物品 ID <small>中文 / ENGLISH</small></span><input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(48); }} spellCheck={false} autoComplete="off" placeholder="例如：钻石镐 / Diamond Pickaxe" /></label>
      <div className="mc-recipe-groups" role="group" aria-label="配方大类">{GROUPS.map((entry) => <button key={entry.id} type="button" className={group === entry.id ? "active" : ""} aria-pressed={group === entry.id} onClick={() => { setGroup(entry.id); setSubcategory("all"); setQuery(""); setLimit(48); }}>{entry.label}<small>{entry.id === "all" ? craftable.length : craftable.filter((item) => (entry.categories as readonly string[]).includes(item.category)).length}</small></button>)}</div>
      {group !== "all" && <div className="mc-recipe-subgroups" role="group" aria-label="配方小类"><button type="button" className={subcategory === "all" ? "active" : ""} aria-pressed={subcategory === "all"} onClick={() => { setSubcategory("all"); setLimit(48); }}>全部</button>{activeGroup.categories.map((category) => <button type="button" key={category} className={subcategory === category ? "active" : ""} aria-pressed={subcategory === category} onClick={() => { setSubcategory(category); setLimit(48); }}>{SUBCATEGORY_NAMES[category] ?? category}</button>)}</div>}
      <p className="mc-recipe-count">{search ? "全目录搜索" : `${activeGroup.label}${subcategory !== "all" ? ` / ${SUBCATEGORY_NAMES[subcategory]}` : ""}`} · {filtered.length} 种可合成物品</p>
      <div className="mc-recipe-browser">{filtered.slice(0, limit).map((entry) => <button type="button" key={entry.name} className={itemId === entry.name ? "active" : ""} aria-pressed={itemId === entry.name} onClick={() => selectItem(entry.name)}><ItemIcon id={entry.name} item={entry} /><strong>{entry.displayNameZh}</strong><small>{entry.displayName}</small></button>)}</div>
      {!filtered.length && <p className="mc-field-hint">这个范围没有收录的工作台配方，试试其他分类或搜索词。</p>}
      {filtered.length > limit && <button type="button" className="mc-recipe-more" onClick={() => setLimit((previous) => previous + 48)}>显示更多物品 ↓</button>}
      <div className="mc-form-section-label"><span>02</span> 当前产物</div><label className="mc-field"><span>物品 ID <small>可直接输入</small></span><input list="mc-recipe-item-list" value={item} onChange={(event) => selectItem(event.target.value)} spellCheck={false} autoComplete="off" /><datalist id="mc-recipe-item-list">{craftable.map((entry) => <option key={entry.name} value={entry.name} label={`${entry.displayNameZh} · ${entry.displayName}`} />)}</datalist><em>{itemData ? `${itemData.displayNameZh} · ${itemData.displayName}` : "请选择当前版本中的有效物品 ID"}</em></label>
      {recipe && <div className="mc-recipe-variant"><span>配方 {index + 1} / {recipes.length}</span><div><button type="button" disabled={index === 0} onClick={() => setVariant(index - 1)} aria-label="上一个配方">←</button><button type="button" disabled={index >= recipes.length - 1} onClick={() => setVariant(index + 1)} aria-label="下一个配方">→</button></div></div>}
      <p className="mc-field-hint">这里展示数据源收录的工作台配方；熔炉、切石机、锻造台、酿造台不在此列。数据源可能遗漏部分新配方。</p>
    </div><aside className="mc-output-panel mc-color-output"><div className="mc-output-top"><span><i /> CRAFTING PREVIEW</span><span>JAVA · {version}</span></div>
      {recipe ? <><div className="mc-recipe-result"><ItemIcon key={itemId} id={itemId} item={itemData} size={46} /><div><strong>{itemData?.displayNameZh ?? itemId}</strong><small>{itemData?.displayName ?? itemId} · minecraft:{itemId}</small></div><b>× {recipe.count}</b></div>
        {recipe.shape ? <div className="mc-recipe-grid" aria-label="工作台九宫格">{Array.from({ length: 9 }, (_, position) => { const id = shape.find((cell) => cell.position === position + 1)?.ingredient; return id ? ingredient(id, `${position}-${id}`) : <div className="mc-recipe-empty-cell" key={position} aria-label="空格" />; })}</div> : <div className="mc-recipe-shapeless"><span>无序合成 · 材料位置不限</span><div>{recipe.ingredients?.map((id, position) => ingredient(id, `${position}-${id}`))}</div></div>}
      </> : <div className="mc-lookup-empty"><span>⊞</span><p>{!catalog ? "配方数据载入中…" : !itemData ? "请选择当前版本的有效物品 ID。" : "该物品没有收录的工作台配方。"}</p></div>}
      <p className="mc-output-note">配方：PrismarineJS / minecraft-data；译名：Mojang 简体中文资源；图标：<a href="https://blockrender.dev/" target="_blank" rel="noopener noreferrer">Block Render ↗</a> 和 <a href="https://github.com/Webisso/minecraft-item-icons" target="_blank" rel="noopener noreferrer">Webisso ↗</a>。少量新版物品显示本站绘制的占位图；图标外观可能与所选游戏版本略有不同。</p>
    </aside></div>
  </section>;
}
