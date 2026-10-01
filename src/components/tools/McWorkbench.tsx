"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import ColorTool from "@/components/tools/ColorTool";
import CoordinateTool from "@/components/tools/CoordinateTool";
import ServerLookup from "@/components/tools/ServerLookup";
import PlayerLookup from "@/components/tools/PlayerLookup";
import VersionFeed from "@/components/tools/VersionFeed";
import EffectTool from "@/components/tools/EffectTool";
import TitleTool from "@/components/tools/TitleTool";
import BlockTool from "@/components/tools/BlockTool";
import RecipeTool from "@/components/tools/RecipeTool";
import {
  MC_VERSIONS,
  enchantmentWarnings,
  makeGiveCommand,
  type McCatalog,
  type SelectedEnchantment,
} from "@/lib/mc/give";

const CATEGORY_ITEMS = [
  { name: "物品指令", detail: "GIVE COMMAND", number: "01", href: "#give", available: true },
  { name: "文字与颜色", detail: "TEXT & COLORS", number: "02", href: "#colors", available: true },
  { name: "坐标与计算", detail: "COORDINATES", number: "03", href: "#coordinates", available: true },
  { name: "服务器状态", detail: "SERVER STATUS", number: "04", href: "#server", available: true },
  { name: "玩家档案", detail: "PLAYER LOOKUP", number: "05", href: "#player", available: true },
  { name: "版本动态", detail: "RELEASE RADAR", number: "06", href: "#versions", available: true },
  { name: "状态效果", detail: "EFFECT COMMAND", number: "07", href: "#effects", available: true },
  { name: "标题与字幕", detail: "TITLE COMMAND", number: "08", href: "#title", available: true },
  { name: "方块与区域", detail: "BLOCK BUILDER", number: "09", href: "#blocks", available: true },
  { name: "合成配方", detail: "CRAFTING TABLE", number: "10", href: "#recipes", available: true },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return <button className="mc-copy-button" type="button" onClick={copy} disabled={!value}>{copied ? "已复制 ✓" : "复制指令 ↗"}</button>;
}

function GiveTool({ version, catalog }: { version: string; catalog: McCatalog | null }) {
  const [item, setItem] = useState("diamond_sword");
  const [target, setTarget] = useState("@p");
  const [count, setCount] = useState(1);
  const [name, setName] = useState("");
  const [lore, setLore] = useState("");
  const [unbreakable, setUnbreakable] = useState(false);
  const [selected, setSelected] = useState<SelectedEnchantment[]>([]);
  const [enchantToAdd, setEnchantToAdd] = useState("");

  const normalizedItem = item.trim().toLowerCase().replace(/^minecraft:/, "");
  const matchingItem = catalog?.items.find((entry) => entry.name === normalizedItem);
  const normalizedTarget = target.trim();
  const targetValid = /^(@[aprs](\[[^\]]*\])?|[A-Za-z0-9_]{3,16})$/.test(normalizedTarget);
  const selectedForVersion = selected.filter((entry) => catalog?.enchantments.some((option) => option.name === entry.name));
  const availableEnchantments = catalog?.enchantments.filter((entry) => !selected.some((chosen) => chosen.name === entry.name)) ?? [];
  const warnings = enchantmentWarnings(selectedForVersion, catalog);

  const command = matchingItem && targetValid
    ? makeGiveCommand({
      version,
      item: normalizedItem,
      count: Math.max(1, Math.min(64, Math.floor(count || 1))),
      target: normalizedTarget,
      name: name.trim(),
      lore: lore.split("\n").map((line) => line.trim()).filter(Boolean),
      unbreakable,
      enchantments: selectedForVersion,
    })
    : "";

  function addEnchantment() {
    if (!enchantToAdd || selected.some((entry) => entry.name === enchantToAdd)) return;
    setSelected((previous) => [...previous, { name: enchantToAdd, level: 1 }]);
    setEnchantToAdd("");
  }

  return (
    <section className="mc-workbench mc-section" id="give" aria-labelledby="give-heading">
      <div className="mc-section-header">
        <div><span className="mc-overline">01 / COMMAND LAB</span><h2 id="give-heading">物品与附魔<span>指令生成器</span></h2></div>
        <span className="mc-section-mark" aria-hidden="true">✦</span>
      </div>
      <p className="mc-section-description">选物品、加附魔，实时生成对应版本的 Java 版 /give 指令。原版等级和互斥附魔会给出提示。</p>

      <div className="mc-lab-grid">
        <div className="mc-form-panel">
          <div className="mc-form-section-label"><span>01</span> 基础物品</div>
          <div className="mc-field-grid">
            <label className="mc-field mc-field-wide"><span>物品 ID <small>ITEM</small></span>
              <input value={item} onChange={(event) => setItem(event.target.value)} list="mc-item-list" placeholder="diamond_sword" spellCheck={false} autoComplete="off" />
              <datalist id="mc-item-list">{catalog?.items.map((entry) => <option key={entry.name} value={entry.name} label={entry.displayName} />)}</datalist>
              <em>{!catalog ? "正在载入该版本的物品数据…" : matchingItem ? `${matchingItem.displayName} · minecraft:${matchingItem.name}` : "请选择列表中的有效物品 ID"}</em>
            </label>
            <label className="mc-field"><span>目标 <small>TARGET</small></span><input value={target} onChange={(event) => setTarget(event.target.value)} spellCheck={false} /></label>
            <label className="mc-field"><span>数量 <small>COUNT</small></span><input type="number" min="1" max="64" value={count} onChange={(event) => setCount(Number(event.target.value))} /></label>
          </div>

          <div className="mc-form-section-label"><span>02</span> 自定义外观</div>
          <div className="mc-field-grid">
            <label className="mc-field mc-field-wide"><span>自定义名称 <small>NAME</small></span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：星尘之刃" /></label>
            <label className="mc-field mc-field-wide"><span>描述文字 <small>每行一条</small></span><textarea rows={3} value={lore} onChange={(event) => setLore(event.target.value)} placeholder={"在这里写下物品的故事\n支持多行描述"} /></label>
          </div>
          <label className="mc-check"><input type="checkbox" checked={unbreakable} onChange={(event) => setUnbreakable(event.target.checked)} /><span className="mc-check-box" aria-hidden="true" /> 不可破坏 <small>UNBREAKABLE</small></label>

          <div className="mc-form-section-label"><span>03</span> 附魔配置</div>
          <div className="mc-add-enchant"><select value={enchantToAdd} onChange={(event) => setEnchantToAdd(event.target.value)} aria-label="选择附魔"><option value="">选择要添加的附魔…</option>{availableEnchantments.map((entry) => <option key={entry.name} value={entry.name}>{entry.displayName} · {entry.name}</option>)}</select><button type="button" onClick={addEnchantment} disabled={!enchantToAdd}>添加 ＋</button></div>
          {selectedForVersion.length ? <div className="mc-enchant-list">{selectedForVersion.map((entry) => {
            const details = catalog?.enchantments.find((option) => option.name === entry.name);
            return <div className="mc-enchant-row" key={entry.name}><span><strong>{details?.displayName ?? entry.name}</strong><small>{entry.name} · 原版最高 {details?.maxLevel ?? "?"}</small></span><label>等级 <input type="number" min="1" max="255" value={entry.level} onChange={(event) => setSelected((previous) => previous.map((chosen) => chosen.name === entry.name ? { ...chosen, level: Math.max(1, Math.min(255, Number(event.target.value) || 1)) } : chosen))} /></label><button type="button" className="mc-remove" aria-label={`移除 ${entry.name}`} onClick={() => setSelected((previous) => previous.filter((chosen) => chosen.name !== entry.name))}>×</button></div>;
          })}</div> : <p className="mc-empty-hint">还没有添加附魔。试试给剑加上锋利与耐久。</p>}
        </div>

        <aside className="mc-output-panel" aria-label="指令预览">
          <div className="mc-output-top"><span><i /> LIVE OUTPUT</span><span>JAVA · {version}</span></div>
          <div className="mc-item-display"><div className="mc-item-glyph" aria-hidden="true"><span>✦</span></div><span className="mc-item-display-name">{name.trim() || matchingItem?.displayName || "选择物品"}</span><span className="mc-item-display-id">{matchingItem ? `minecraft:${matchingItem.name}` : "minecraft:..."}</span>{selectedForVersion.length > 0 && <span className="mc-enchanted-badge">✧ 附魔 × {selectedForVersion.length}</span>}</div>
          <div className="mc-code-heading"><span>生成的指令</span><span>COMMAND</span></div>
          <pre className="mc-code-output"><code>{command || "// 输入有效物品 ID 和目标后生成指令"}</code></pre>
          {!targetValid && <p className="mc-output-warning">目标只能是玩家名或有效选择器，例如 @p、@s。</p>}
          {warnings.map((warning) => <p className="mc-output-warning" key={warning}>⚠ {warning}</p>)}
          <CopyButton value={command} />
          <p className="mc-output-note">生成器检查数据与格式；最终请在对应游戏版本中验证。非常规高等级附魔可能无法通过铁砧获得。</p>
        </aside>
      </div>
    </section>
  );
}

export default function McWorkbench() {
  const [version, setVersion] = useState<string>(MC_VERSIONS[0]);
  const [catalog, setCatalog] = useState<McCatalog | null>(null);
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/mc-data/${version}.json`)
      .then((response) => { if (!response.ok) throw new Error("版本数据无法加载"); return response.json() as Promise<McCatalog>; })
      .then((data) => { if (active) setCatalog(data); })
      .catch(() => { if (active) setDataError("版本数据暂时无法加载，请刷新后再试。"); });
    return () => { active = false; };
  }, [version]);

  const itemCount = useMemo(() => catalog?.items.length.toLocaleString("zh-CN") ?? "—", [catalog]);

  return (
    <main className="mc-tools">
      <div className="mc-ambient mc-ambient-a" aria-hidden="true" /><div className="mc-ambient mc-ambient-b" aria-hidden="true" />
      <header className="mc-header"><div className="mc-header-inner"><Link className="mc-brand" href="/"><span className="mc-brand-cube" aria-hidden="true">▦</span><span>Pkqa<span className="mc-brand-light"> Center.</span></span></Link><nav aria-label="工具导航"><Link href="/">个人主页</Link><a className="mc-nav-active" href="#top">MC 工具工坊</a></nav><div className="mc-header-end"><span className="mc-header-edition">JAVA EDITION</span><ThemeToggle /></div></div></header>

      <div className="mc-main-wrap" id="top"><section className="mc-hero"><div className="mc-hero-copy"><div className="mc-kicker"><span className="mc-kicker-square" /> PKQA CENTER / A LITTLE WORLD OF TOOLS</div><h1>MC 工具<span>工坊<span className="mc-hero-dot">.</span></span></h1><p>把灵感变成指令，把复杂留给工具。<br />从一把独一无二的剑开始，慢慢搭建属于你的世界。</p><div className="mc-hero-actions"><a href="#give">开始制作 <span>↘</span></a><span>适用于 Minecraft Java Edition</span></div></div><div className="mc-hero-art" aria-hidden="true"><div className="mc-art-ring mc-art-ring-outer"/><div className="mc-art-ring mc-art-ring-inner"/><div className="mc-art-cube"><span className="mc-cube-top"/><span className="mc-cube-left"/><span className="mc-cube-right"/></div><span className="mc-art-orbit-one">✧</span><span className="mc-art-orbit-two">✦</span><span className="mc-art-caption">CRAFT YOUR OWN<br />POSSIBILITIES</span></div></section>

      <section className="mc-directory" aria-labelledby="mc-directory-heading"><div className="mc-directory-heading"><div><span className="mc-overline">EXPLORE THE WORKSHOP</span><h2 id="mc-directory-heading">从这里<span>开始</span></h2></div><label className="mc-version-switch"><span>游戏版本 <small>VERSION</small></span><select value={version} onChange={(event) => { setVersion(event.target.value); setCatalog(null); setDataError(""); }}>{MC_VERSIONS.map((entry) => <option key={entry} value={entry}>Java {entry}</option>)}</select></label></div><div className="mc-directory-grid">{CATEGORY_ITEMS.map((entry) => <a className={`mc-directory-card${entry.available ? " is-available" : ""}`} href={entry.href} key={entry.number}><span className="mc-directory-number">{entry.number} / {String(CATEGORY_ITEMS.length).padStart(2, "0")}</span><span className="mc-directory-icon" aria-hidden="true">{({ "01": "⚒", "02": "✦", "03": "⌖", "04": "◈", "05": "♙", "06": "✳", "07": "✚", "08": "◇", "09": "▣", "10": "⊞" } as Record<string, string>)[entry.number]}</span><strong>{entry.name}</strong><small>{entry.detail}</small><span className="mc-directory-arrow">{entry.available ? "↗" : "逐步开放"}</span></a>)}</div><div className="mc-data-note"><span className="mc-data-indicator" /> {dataError || (catalog ? `已载入 Java ${version} 数据 · ${itemCount} 种物品 · ${catalog.enchantments.length} 种附魔${catalog.blocks ? ` · ${catalog.blocks.length} 种方块` : ""}` : "正在读取版本数据…")}</div></section>

      <GiveTool version={version} catalog={catalog} />
      <ColorTool version={version} />
      <CoordinateTool />
      <ServerLookup />
      <PlayerLookup />
      <VersionFeed />
      <EffectTool catalog={catalog} />
      <TitleTool version={version} />
      <BlockTool version={version} catalog={catalog} />
      <RecipeTool version={version} catalog={catalog} />

      <section className="mc-upcoming mc-section" id="upcoming"><span className="mc-overline">MORE TO CRAFT</span><h2>下一站，还有更多<span>可能。</span></h2><p>数据包制作、结构蓝图、更多指令生成器等工具会依次加入工坊。每个工具都会保留清晰的版本与适用范围说明。</p><div className="mc-upcoming-stamp">WORK IN PROGRESS <span>✳</span></div></section>
      <footer className="mc-footer"><Link href="/">← 返回 Pkqa Center</Link><span>MC 工具工坊 · Made by GloryPkqa</span><a href="https://github.com/PrismarineJS/minecraft-data" target="_blank" rel="noopener noreferrer">物品数据：PrismarineJS / minecraft-data ↗</a></footer></div>
    </main>
  );
}
