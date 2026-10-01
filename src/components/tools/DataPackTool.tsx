"use client";

import { useMemo, useState } from "react";
import { createDataPackFiles, type LootEntry } from "@/lib/mc/datapack";
import { importGiveForRecipe, type ImportedGiveResult } from "@/lib/mc/give-recipe";
import { zipFiles } from "@/lib/mc/zip";
import { versionAtLeast, type McCatalog } from "@/lib/mc/give";

const componentLabels: Record<string, string> = { "minecraft:custom_name": "名称", "minecraft:lore": "描述", "minecraft:enchantments": "附魔", "minecraft:stored_enchantments": "附魔书", "minecraft:unbreakable": "无法破坏" };

export default function DataPackTool({ version, catalog }: { version: string; catalog: McCatalog | null }) {
  const [title, setTitle] = useState("我的冒险数据包");
  const [description, setDescription] = useState("由 Pkqa MC 工具工坊制作");
  const [namespace, setNamespace] = useState("pkqa");
  const [recipeEnabled, setRecipeEnabled] = useState(true);
  const [recipeName, setRecipeName] = useState("lucky_diamond");
  const [recipeType, setRecipeType] = useState<"shaped" | "shapeless">("shaped");
  const [grid, setGrid] = useState(["diamond", "diamond", "diamond", "", "emerald", "", "", "stick", ""]);
  const [result, setResult] = useState("diamond_sword");
  const [resultCount, setResultCount] = useState(1);
  const [giveText, setGiveText] = useState("");
  const [imported, setImported] = useState<(ImportedGiveResult & { version: string }) | null>(null);
  const [importError, setImportError] = useState<{ version: string; message: string } | null>(null);
  const [lootEnabled, setLootEnabled] = useState(true);
  const [lootName, setLootName] = useState("starter_gift");
  const [rolls, setRolls] = useState(1);
  const [loot, setLoot] = useState<LootEntry[]>([{ item: "diamond", weight: 3, count: 1 }, { item: "iron_ingot", weight: 8, count: 4 }]);
  const [preview, setPreview] = useState("pack.mcmeta");
  const [downloaded, setDownloaded] = useState(false);
  const validItems = useMemo(() => new Set(catalog?.items.map((entry) => entry.name) ?? []), [catalog]);
  const catalogReady = catalog?.version === version;
  const activeImport = imported?.version === version && imported.item === result.replace(/^minecraft:/, "") ? imported : null;
  const pack = createDataPackFiles({ version, title, description, namespace, recipeEnabled, recipeName, recipeType, grid, result, resultCount, resultComponents: activeImport?.components, lootEnabled, lootName, rolls, loot, validItems });
  const previewFile = pack.files.find((entry) => entry.name === preview) ?? pack.files[0];

  function applyGive(command: string) {
    try {
      const parsed = importGiveForRecipe(command, version);
      if (catalog?.version === version && !validItems.has(parsed.item)) throw new Error("这件物品不在当前版本的物品目录中，请检查 /give 的版本。");
      setResult(parsed.item);
      setResultCount(parsed.count);
      setImported({ ...parsed, version });
      setImportError(null);
      setPreview(`data/${namespace}/${versionAtLeast(version, "1.21") ? "recipe" : "recipes"}/${recipeName}.json`);
    } catch (error) {
      setImported(null);
      setImportError({ version, message: error instanceof Error ? error.message : "无法导入这条 /give 指令。" });
    }
  }

  function download() {
    if (pack.errors.length || !catalogReady) return;
    const bytes = zipFiles(pack.files);
    const blob = new Blob([new Uint8Array(bytes).buffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${namespace}-${version.replaceAll(".", "_")}-datapack.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 2000);
  }

  return <section className="mc-section" id="datapack" aria-labelledby="datapack-heading">
    <div className="mc-section-header"><div><span className="mc-overline">15 / DATAPACK FORGE</span><h2 id="datapack-heading">数据包<span>制作器</span></h2></div><span className="mc-section-mark" aria-hidden="true">▤</span></div>
    <p className="mc-section-description">制作自定义工作台配方和战利品表，浏览每份 JSON，再下载能直接放进世界 datapacks 文件夹的 ZIP。全部在浏览器内生成。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel">
      <div className="mc-form-section-label"><span>01</span> 数据包信息</div>
      <div className="mc-field-grid"><label className="mc-field"><span>名称</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} /></label><label className="mc-field"><span>命名空间 <small>NAMESPACE</small></span><input value={namespace} onChange={(event) => setNamespace(event.target.value.toLowerCase())} maxLength={40} spellCheck={false} /></label><label className="mc-field mc-field-wide"><span>描述</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} /></label></div>

      <div className="mc-form-section-label"><span>02</span> 自定义配方 <label className="mc-pack-toggle"><input type="checkbox" checked={recipeEnabled} onChange={(event) => setRecipeEnabled(event.target.checked)} /> 启用</label></div>
      {recipeEnabled && <><div className="mc-field-grid"><label className="mc-field"><span>文件名 <small>RECIPE ID</small></span><input value={recipeName} onChange={(event) => setRecipeName(event.target.value.toLowerCase())} spellCheck={false} /></label><label className="mc-field"><span>配方类型</span><select className="mc-select" value={recipeType} onChange={(event) => setRecipeType(event.target.value as "shaped" | "shapeless")}><option value="shaped">有序合成 · 九宫格</option><option value="shapeless">无序合成 · 任意摆放</option></select></label></div>
        <p className="mc-field-hint">每格输入当前版本的物品 ID。{recipeType === "shapeless" ? "无序合成会把非空格视为材料，重复材料保留。" : "有序合成会自动裁切外围空白格。"}</p>
        <div className="mc-pack-grid" role="group" aria-label="九宫格材料">{grid.map((value, index) => <label key={index}><span>{index + 1}</span><input value={value} list="mc-pack-item-list" aria-label={`第 ${index + 1} 格材料`} placeholder="空" onChange={(event) => setGrid((previous) => previous.map((entry, at) => at === index ? event.target.value : entry))} spellCheck={false} /></label>)}</div>
        <div className="mc-field-grid"><label className="mc-field"><span>产物 ID <small>可直接粘贴 /give</small></span><input value={result} list="mc-pack-item-list" onChange={(event) => { setResult(event.target.value); setImported(null); setImportError(null); }} onPaste={(event) => { const text = event.clipboardData.getData("text"); if (/^\s*\/?give\s/i.test(text)) { event.preventDefault(); setGiveText(text); applyGive(text); } }} spellCheck={false} /></label><label className="mc-field"><span>产物数量</span><input type="number" min="1" max="64" value={resultCount} onChange={(event) => setResultCount(Number(event.target.value))} /></label></div>
        <div className="mc-pack-import"><label className="mc-field"><span>导入带属性的产物 <small>PASTE /GIVE</small></span><textarea rows={3} value={giveText} onChange={(event) => { setGiveText(event.target.value); setImported(null); setImportError(null); }} placeholder="把本站物品 / 附魔生成器中的完整 /give 指令粘贴到这里" spellCheck={false} /></label><button type="button" className="mc-recipe-more" onClick={() => applyGive(giveText)} disabled={!giveText.trim()}>导入 /give 产物 ↗</button></div>
        {importError?.version === version && <p className="mc-output-warning" role="alert">⚠ {importError.message}</p>}
        {activeImport && <div className="mc-pack-imported"><span>{Object.keys(activeImport.components).length ? "属性已写入配方产物" : "已导入普通产物"}</span><strong>{Object.keys(activeImport.components).map((key) => componentLabels[key] ?? key).join(" · ") || "普通物品"}</strong><button type="button" onClick={() => { setImported(null); setGiveText(""); }}>清除导入</button></div>}
        {imported && !activeImport && <p className="mc-output-warning">已切换产物或版本，原有属性不会写入数据包；请重新导入对应版本的 /give。</p>}
        <p className="mc-field-hint">{versionAtLeast(version, "1.20.5") ? "支持导入本站 /give 工具生成的名称、描述、附魔和无法破坏属性；遇到其他组件会明确报错。" : `${version} 的原版工作台配方只能生成普通物品，不能保留 /give 的 NBT 属性。`}</p>
      </>}

      <div className="mc-form-section-label"><span>03</span> 战利品表 <label className="mc-pack-toggle"><input type="checkbox" checked={lootEnabled} onChange={(event) => setLootEnabled(event.target.checked)} /> 启用</label></div>
      {lootEnabled && <><div className="mc-field-grid"><label className="mc-field"><span>文件名 <small>LOOT TABLE ID</small></span><input value={lootName} onChange={(event) => setLootName(event.target.value.toLowerCase())} spellCheck={false} /></label><label className="mc-field"><span>抽取次数</span><input type="number" min="1" max="64" value={rolls} onChange={(event) => setRolls(Number(event.target.value))} /></label></div>
        <div className="mc-pack-loot-head"><span>物品 ID</span><span>权重</span><span>数量</span></div>
        {loot.map((entry, index) => <div className="mc-pack-loot" key={index}><input value={entry.item} list="mc-pack-item-list" aria-label={`战利品 ${index + 1} 物品`} onChange={(event) => setLoot((previous) => previous.map((item, at) => at === index ? { ...item, item: event.target.value } : item))} spellCheck={false} /><input type="number" min="1" max="1000" value={entry.weight} aria-label={`战利品 ${index + 1} 权重`} onChange={(event) => setLoot((previous) => previous.map((item, at) => at === index ? { ...item, weight: Number(event.target.value) } : item))} /><input type="number" min="1" max="64" value={entry.count} aria-label={`战利品 ${index + 1} 数量`} onChange={(event) => setLoot((previous) => previous.map((item, at) => at === index ? { ...item, count: Number(event.target.value) } : item))} /><button type="button" aria-label={`删除战利品 ${index + 1}`} disabled={loot.length === 1} onClick={() => setLoot((previous) => previous.filter((_, at) => at !== index))}>×</button></div>)}
        <button type="button" className="mc-recipe-more" disabled={loot.length >= 8} onClick={() => setLoot((previous) => [...previous, { item: "gold_ingot", weight: 1, count: 1 }])}>添加战利品 ＋</button><p className="mc-field-hint">权重越高越容易抽到。可在游戏中使用 /loot give @p loot {namespace || "命名空间"}:{lootName || "文件名"} 测试。</p>
      </>}
      <datalist id="mc-pack-item-list">{catalog?.items.map((entry) => <option key={entry.name} value={entry.name} label={`${entry.displayNameZh} · ${entry.displayName}`} />)}</datalist>
    </div><aside className="mc-output-panel mc-color-output"><div className="mc-output-top"><span><i /> PACK PREVIEW</span><span>JAVA · {version}</span></div><div className="mc-pack-folder"><span>▤</span><strong>{title.trim() || "未命名数据包"}</strong><small>{catalogReady ? `${pack.files.length} 个文件` : "正在载入物品目录"} · Java {version}</small></div>
      {!catalogReady ? <p className="mc-output-note">正在载入当前版本的物品目录…</p> : pack.errors.length ? <div className="mc-pack-errors">{pack.errors.map((error) => <p key={error}>⚠ {error}</p>)}</div> : <><label className="mc-field"><span>预览文件</span><select className="mc-select" value={previewFile?.name ?? ""} onChange={(event) => setPreview(event.target.value)}>{pack.files.map((file) => <option key={file.name} value={file.name}>{file.name}</option>)}</select></label><pre className="mc-code-output mc-pack-code"><code>{previewFile?.content}</code></pre></>}
      <button className="mc-copy-button" type="button" disabled={!!pack.errors.length || !catalogReady} onClick={download}>{downloaded ? "ZIP 已准备下载 ✓" : "下载数据包 ZIP ↓"}</button>
      <p className="mc-output-note">把 ZIP 原样放进单人世界的 datapacks 文件夹，然后执行 /reload。服务器需要管理员安装。配方与战利品表路径会随版本自动切换。</p>
    </aside></div>
  </section>;
}
