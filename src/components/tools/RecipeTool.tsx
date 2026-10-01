"use client";

import { useState } from "react";
import type { McCatalog } from "@/lib/mc/give";

export default function RecipeTool({ version, catalog }: { version: string; catalog: McCatalog | null }) {
  const [item, setItem] = useState("diamond_pickaxe");
  const [variant, setVariant] = useState(0);
  const itemId = item.trim().toLowerCase().replace(/^minecraft:/, "");
  const itemData = catalog?.items.find((entry) => entry.name === itemId);
  const recipes = catalog?.recipes?.[itemId] ?? [];
  const index = Math.min(variant, Math.max(0, recipes.length - 1));
  const recipe = recipes[index];
  const names = new Map(catalog?.items.map((entry) => [entry.name, entry.displayName]) ?? []);
  const shape = recipe?.shape?.flatMap((row, rowIndex) => row.map((ingredient, columnIndex) => ({
    ingredient, position: rowIndex * 3 + columnIndex + 1,
  }))) ?? [];

  return <section className="mc-section" id="recipes" aria-labelledby="recipes-heading">
    <div className="mc-section-header"><div><span className="mc-overline">10 / CRAFTING TABLE</span><h2 id="recipes-heading">工作台配方<span>查询器</span></h2></div><span className="mc-section-mark" aria-hidden="true">⊞</span></div>
    <p className="mc-section-description">按输出物品查询当前 Java 版本数据源收录的合成配方。可逐个查看不同木材、石材等替代材料的方案。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel"><div className="mc-form-section-label"><span>01</span> 查找产物</div>
      <label className="mc-field"><span>物品 ID <small>CRAFTED ITEM</small></span><input list="mc-recipe-item-list" value={item} onChange={(event) => { setItem(event.target.value); setVariant(0); }} spellCheck={false} autoComplete="off" placeholder="diamond_pickaxe" /><datalist id="mc-recipe-item-list">{catalog?.items.map((entry) => <option key={entry.name} value={entry.name} label={entry.displayName} />)}</datalist><em>{!catalog ? "正在载入配方数据…" : !catalog.recipes ? "配方数据未更新，请刷新页面后重试" : itemData ? `${itemData.displayName} · minecraft:${itemData.name}` : "请选择当前版本中的有效物品 ID"}</em></label>
      <div className="mc-form-section-label"><span>02</span> 配方说明</div><p className="mc-field-hint">此处只展示数据源中的工作台合成配方；熔炉、切石机、锻造台和酿造台配方不包含在内。数据源可能遗漏部分新配方，实际结果以对应游戏版本为准。</p>
      {recipe && <div className="mc-recipe-variant"><span>配方 {index + 1} / {recipes.length}</span><div><button type="button" disabled={index === 0} onClick={() => setVariant(index - 1)} aria-label="上一个配方">←</button><button type="button" disabled={index >= recipes.length - 1} onClick={() => setVariant(index + 1)} aria-label="下一个配方">→</button></div></div>}
    </div><aside className="mc-output-panel mc-color-output"><div className="mc-output-top"><span><i /> CRAFTING PREVIEW</span><span>JAVA · {version}</span></div>
      {recipe ? <><div className="mc-recipe-result"><span aria-hidden="true">⊞</span><div><strong>{itemData?.displayName ?? itemId}</strong><small>minecraft:{itemId}</small></div><b>× {recipe.count}</b></div>
        {recipe.shape ? <div className="mc-recipe-grid" aria-label="工作台九宫格">{Array.from({ length: 9 }, (_, position) => { const ingredient = shape.find((cell) => cell.position === position + 1)?.ingredient; return <div className={ingredient ? "has-item" : ""} key={position} title={ingredient ? names.get(ingredient) ?? ingredient : "空格"}><span>{ingredient ? names.get(ingredient) ?? ingredient : ""}</span><small>{ingredient || ""}</small></div>; })}</div> : <div className="mc-recipe-shapeless"><span>无序合成 · 材料位置不限</span><div>{recipe.ingredients?.map((ingredient, position) => <div key={`${ingredient}-${position}`}><strong>{names.get(ingredient) ?? ingredient}</strong><small>{ingredient}</small></div>)}</div></div>}
      </> : <div className="mc-lookup-empty"><span>⊞</span><p>{!catalog ? "配方数据载入中…" : !itemData ? "请输入当前版本的有效物品 ID。" : "该物品没有收录的工作台配方。"}</p></div>}
      <p className="mc-output-note">配方数据：PrismarineJS / minecraft-data。页面只读取构建时生成的静态文件。</p>
    </aside></div>
  </section>;
}
