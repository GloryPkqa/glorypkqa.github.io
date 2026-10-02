"use client";

import { useState } from "react";
import useCopyFeedback from "@/lib/useCopyFeedback";
import TextStyleControls from "@/components/tools/TextStyleControls";
import { coloredParts, defaultTextStyle, textComponent, type TextStyle } from "@/lib/mc/textColors";
import { versionAtLeast } from "@/lib/mc/give";

type Channel = "title" | "subtitle" | "actionbar";
const CHANNELS: { id: Channel; label: string }[] = [
  { id: "title", label: "主标题" }, { id: "subtitle", label: "副标题" }, { id: "actionbar", label: "操作栏" },
];

export default function TitleTool({ version }: { version: string }) {
  const [title, setTitle] = useState("欢迎来到冒险世界");
  const [subtitle, setSubtitle] = useState("祝你旅途愉快");
  const [actionbar, setActionbar] = useState("");
  const [active, setActive] = useState<Channel>("title");
  const [styles, setStyles] = useState<Record<Channel, TextStyle>>(() => ({ title: defaultTextStyle("#FFD866"), subtitle: defaultTextStyle("#FFD866"), actionbar: defaultTextStyle("#FFD866") }));
  const [target, setTarget] = useState("@a");
  const [fadeIn, setFadeIn] = useState(0.5);
  const [stay, setStay] = useState(3);
  const [fadeOut, setFadeOut] = useState(0.5);
  const { copy, isCopied } = useCopyFeedback();
  const actionbarAvailable = versionAtLeast(version, "1.16");
  const activeChannel = actionbarAvailable || active !== "actionbar" ? active : "title";
  const texts = { title, subtitle, actionbar };
  const targetValid = /^(@[aprs](\[[^\]]*\])?|[A-Za-z0-9_]{3,16})$/.test(target.trim()) && (versionAtLeast(version, "1.12") || !target.trim().startsWith("@s"));
  const ticks = (seconds: number) => Math.max(0, Math.min(1200, Math.round((Number.isFinite(seconds) ? seconds : 0) * 20)));
  const component = (channel: Channel) => textComponent(coloredParts(texts[channel], styles[channel]), version);
  const commands = targetValid ? [
    ...(title.trim() ? [{ name: "播放时间", value: `/title ${target.trim()} times ${ticks(fadeIn)} ${ticks(stay)} ${ticks(fadeOut)}` }] : []),
    ...(subtitle.trim() ? [{ name: "副标题", value: `/title ${target.trim()} subtitle ${component("subtitle")}` }] : []),
    ...(title.trim() ? [{ name: "主标题", value: `/title ${target.trim()} title ${component("title")}` }] : []),
    ...(actionbarAvailable && actionbar.trim() ? [{ name: "操作栏", value: `/title ${target.trim()} actionbar ${component("actionbar")}` }] : []),
  ] : [];

  function preview(channel: Channel, fallback: string) {
    const parts = coloredParts(texts[channel] || fallback, styles[channel]);
    return parts.map((part, index) => <span key={index} style={{ color: part.color, fontWeight: part.bold ? 800 : undefined, fontStyle: part.italic ? "italic" : undefined }}>{part.text}</span>);
  }

  return <section className="mc-section" id="title" aria-labelledby="title-heading"><div className="mc-section-header"><div><span className="mc-overline">08 / STORY SCREEN</span><h2 id="title-heading">标题与操作栏<span>指令生成器</span></h2></div><span className="mc-section-mark" aria-hidden="true">◇</span></div>
    <p className="mc-section-description">主标题、副标题{actionbarAvailable ? "与操作栏" : ""}可分别设置纯色、渐变、AB 交替或逐字颜色。自动换算游戏刻并生成对应 Java 版本的指令。{!versionAtLeast(version, "1.16") && " 此版本会把 RGB 颜色匹配到最接近的经典 16 色。"}</p>
    <div className="mc-lab-grid"><div className="mc-form-panel"><div className="mc-form-section-label"><span>01</span> 画面文字</div><div className="mc-field-grid"><label className="mc-field mc-field-wide"><span>主标题 <small>TITLE</small></span><input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} /></label><label className="mc-field mc-field-wide"><span>副标题 <small>SUBTITLE</small></span><input value={subtitle} maxLength={100} onChange={(event) => setSubtitle(event.target.value)} /></label>{actionbarAvailable && <label className="mc-field mc-field-wide"><span>操作栏 <small>ACTIONBAR · 可留空</small></span><input value={actionbar} maxLength={100} onChange={(event) => setActionbar(event.target.value)} /></label>}</div>
      <div className="mc-form-section-label"><span>02</span> 分区配色</div><div className="mc-text-mode" role="group" aria-label="选择配色文字">{CHANNELS.filter((channel) => actionbarAvailable || channel.id !== "actionbar").map((channel) => <button type="button" key={channel.id} aria-pressed={activeChannel === channel.id} className={activeChannel === channel.id ? "active" : ""} onClick={() => setActive(channel.id)}>{channel.label}</button>)}</div><TextStyleControls key={activeChannel} label={CHANNELS.find((channel) => channel.id === activeChannel)?.label ?? "标题"} text={texts[activeChannel]} style={styles[activeChannel]} onChange={(value) => setStyles((previous) => ({ ...previous, [activeChannel]: value }))} />
      <div className="mc-form-section-label"><span>03</span> 播放设置</div><label className="mc-field"><span>目标玩家</span><input value={target} onChange={(event) => setTarget(event.target.value)} spellCheck={false} /></label><div className="mc-coordinate-grid mc-title-times"><label className="mc-field"><span>淡入 / 秒</span><input type="number" min="0" max="60" step="0.05" value={fadeIn} onChange={(event) => setFadeIn(Number(event.target.value))} /></label><label className="mc-field"><span>停留 / 秒</span><input type="number" min="0" max="60" step="0.05" value={stay} onChange={(event) => setStay(Number(event.target.value))} /></label><label className="mc-field"><span>淡出 / 秒</span><input type="number" min="0" max="60" step="0.05" value={fadeOut} onChange={(event) => setFadeOut(Number(event.target.value))} /></label></div><p className="mc-field-hint">先执行“播放时间”和“副标题”，最后执行“主标题”；操作栏可单独使用。1 秒 = 20 游戏刻。</p></div>
      <aside className="mc-output-panel mc-color-output"><div className="mc-output-top"><span><i /> SCREEN PREVIEW</span><span>JAVA · {version}</span></div><div className="mc-title-preview"><span>{preview("title", "主标题")}</span><small>{preview("subtitle", "副标题")}</small>{actionbarAvailable && <em>{preview("actionbar", "ACTIONBAR")}</em>}</div>{!targetValid && <p className="mc-output-warning">目标只能是玩家名或玩家选择器，例如 @a、@p。</p>}{!title.trim() && subtitle.trim() && <p className="mc-output-warning">副标题需要配合主标题才能在屏幕上显示。</p>}{!title.trim() && (!actionbarAvailable || !actionbar.trim()) && <p className="mc-output-note">填写主标题{actionbarAvailable ? "或操作栏" : ""}文字后生成指令。</p>}{commands.map((entry) => <div className="mc-color-result" key={entry.name}><div className="mc-code-heading"><span>{entry.name}</span><span>COMMAND</span></div><pre className="mc-code-output"><code>{entry.value}</code></pre><button className="mc-copy-button" type="button" onClick={() => copy(entry.value)}>{isCopied(entry.value) ? "已复制 ✓" : "复制指令 ↗"}</button></div>)}</aside></div>
  </section>;
}
