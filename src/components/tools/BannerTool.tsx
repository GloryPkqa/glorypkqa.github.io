"use client";

import { useState } from "react";
import useCopyFeedback from "@/lib/useCopyFeedback";
import { BANNER_COLORS, availableBannerPatterns, bannerColor, bannerPattern, makeBannerCommand, type BannerLayer } from "@/lib/mc/banner";

const GROUPS = [
  { id: "stripes", zh: "线条" }, { id: "corners", zh: "四角" },
  { id: "shapes", zh: "几何" }, { id: "ornaments", zh: "纹饰" }, { id: "special", zh: "特殊" },
] as const;

function PatternMask({ pattern, color }: { pattern: string; color: string }) {
  return <span className="mc-banner-mask" style={{ backgroundColor: bannerColor(color)?.hex, maskImage: `url(/mc-banner/${pattern}.png)`, WebkitMaskImage: `url(/mc-banner/${pattern}.png)` }} aria-hidden="true" />;
}

export default function BannerTool({ version }: { version: string }) {
  const [target, setTarget] = useState<"banner" | "shield">("banner");
  const [base, setBase] = useState("black");
  const [color, setColor] = useState("lime");
  const [group, setGroup] = useState<(typeof GROUPS)[number]["id"]>("stripes");
  const [layers, setLayers] = useState<BannerLayer[]>([{ pattern: "stripe_center", color: "lime" }, { pattern: "circle", color: "white" }]);
  const { copy, isCopied, isFailed } = useCopyFeedback();
  const validLayers = layers.filter((layer) => availableBannerPatterns(version).some(([id]) => id === layer.pattern));
  const patterns = availableBannerPatterns(version).filter(([, , , category]) => category === group);
  const command = makeBannerCommand({ version, target, base, layers: validLayers });

  function move(index: number, direction: number) {
    const next = [...layers];
    const other = index + direction;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    setLayers(next);
  }

  return <section className="mc-section" id="banner" aria-labelledby="banner-heading">
    <div className="mc-section-header"><div><span className="mc-overline">13 / BANNER STUDIO</span><h2 id="banner-heading">旗帜与盾牌<span>图案编辑器</span></h2></div><span className="mc-section-mark" aria-hidden="true">⚑</span></div>
    <p className="mc-section-description">挑底色、叠图案、调整顺序，预览作品并复制对应 Java 版本的 /give 指令。最多可叠加 16 层；超过 6 层的设计通常需使用指令获得。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel">
      <div className="mc-form-section-label"><span>01</span> 画布</div>
      <div className="mc-banner-targets" role="group" aria-label="作品类型"><button type="button" className={target === "banner" ? "active" : ""} aria-pressed={target === "banner"} onClick={() => setTarget("banner")}>⚑ 旗帜 Banner</button><button type="button" className={target === "shield" ? "active" : ""} aria-pressed={target === "shield"} onClick={() => setTarget("shield")}>⛨ 盾牌 Shield</button></div>
      <p className="mc-field-hint">底色 <strong>{bannerColor(base)?.zh}</strong></p><div className="mc-banner-swatches" role="group" aria-label="底色">{BANNER_COLORS.map((entry) => <button key={entry.id} type="button" title={`${entry.zh} · ${entry.id}`} aria-label={`底色 ${entry.zh}`} aria-pressed={base === entry.id} className={base === entry.id ? "active" : ""} style={{ "--swatch": entry.hex } as React.CSSProperties} onClick={() => setBase(entry.id)} />)}</div>
      <div className="mc-form-section-label"><span>02</span> 新图层</div>
      <p className="mc-field-hint">图案颜色 <strong>{bannerColor(color)?.zh}</strong></p><div className="mc-banner-swatches" role="group" aria-label="图案颜色">{BANNER_COLORS.map((entry) => <button key={entry.id} type="button" title={`${entry.zh} · ${entry.id}`} aria-label={`图案颜色 ${entry.zh}`} aria-pressed={color === entry.id} className={color === entry.id ? "active" : ""} style={{ "--swatch": entry.hex } as React.CSSProperties} onClick={() => setColor(entry.id)} />)}</div>
      <div className="mc-banner-groups" role="group" aria-label="图案类型">{GROUPS.map((entry) => <button type="button" key={entry.id} className={group === entry.id ? "active" : ""} aria-pressed={group === entry.id} onClick={() => setGroup(entry.id)}>{entry.zh}</button>)}</div>
      <div className="mc-banner-patterns">{patterns.map(([id, zh]) => <button type="button" key={id} disabled={layers.length >= 16} onClick={() => setLayers((previous) => [...previous, { pattern: id, color }])}><span className="mc-banner-pattern-art" style={{ backgroundColor: bannerColor(base)?.hex }}><PatternMask pattern={id} color={color} /></span><strong>{zh}</strong><small>{id}</small></button>)}</div>
      <div className="mc-form-section-label"><span>03</span> 图层 <small>{layers.length} / 16</small></div>
      {layers.length ? <div className="mc-banner-layers">{layers.map((layer, index) => <div className="mc-banner-layer" key={`${index}-${layer.pattern}-${layer.color}`}><span className="mc-banner-layer-order">{String(index + 1).padStart(2, "0")}</span><span className="mc-banner-layer-color" style={{ background: bannerColor(layer.color)?.hex }} /><span className="mc-banner-layer-name"><strong>{bannerPattern(layer.pattern)?.zh}</strong><small>{bannerColor(layer.color)?.zh} · {layer.pattern}</small></span><button type="button" aria-label={`上移第 ${index + 1} 层`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`下移第 ${index + 1} 层`} disabled={index === layers.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" aria-label={`删除第 ${index + 1} 层`} onClick={() => setLayers((previous) => previous.filter((_, current) => current !== index))}>×</button></div>)}</div> : <p className="mc-empty-hint">还没有图案。选一种图案即可叠在画布上。</p>}
      {validLayers.length !== layers.length && <p className="mc-output-warning">所选版本不支持部分图案；它们不会进入当前指令。</p>}
    </div><aside className="mc-output-panel mc-banner-output"><div className="mc-output-top"><span><i /> LIVE DESIGN</span><span>JAVA · {version}</span></div>
      <div className="mc-banner-scene"><div className={`mc-banner-artifact is-${target}`}><div className="mc-banner-cloth" style={{ backgroundColor: bannerColor(base)?.hex }}>{validLayers.map((layer, index) => <PatternMask key={`${index}-${layer.pattern}-${layer.color}`} pattern={layer.pattern} color={layer.color} />)}</div>{target === "banner" && <span className="mc-banner-pole" />}{target === "shield" && <span className="mc-banner-shield-rim" />}</div><div className="mc-banner-preview-caption"><span>{target === "banner" ? "BANNER" : "SHIELD"}</span><strong>{bannerColor(base)?.zh} · {validLayers.length} 层图案</strong></div></div>
      <div className="mc-code-heading"><span>生成的指令</span><span>COMMAND</span></div><pre className="mc-code-output"><code>{command}</code></pre><button type="button" className="mc-copy-button" onClick={() => copy(command)}>{isCopied(command) ? "已复制 ✓" : "复制旗帜指令 ↗"}</button>{isFailed(command) && <p className="mc-output-warning" role="alert">复制失败，请重试或手动选中指令复制。</p>}
      <p className="mc-output-note">图案贴图取自 <a href="https://github.com/AiverAiva/BannerCraft" target="_blank" rel="noopener noreferrer">BannerCraft ↗</a>（MIT）；预览为正面平面效果，游戏内旗帜和盾牌的立体阴影会不同。</p>
    </aside></div>
  </section>;
}
