"use client";

import { useState } from "react";

function snbt(value: string) { return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`; }
function component(text: string, color: string, version: string) {
  return version === "1.20.4" || version === "1.20.6"
    ? JSON.stringify({ text, color, bold: false })
    : `{text:${snbt(text)},color:${snbt(color)},bold:false}`;
}

export default function TitleTool({ version }: { version: string }) {
  const [title, setTitle] = useState("欢迎来到冒险世界");
  const [subtitle, setSubtitle] = useState("祝你旅途愉快");
  const [actionbar, setActionbar] = useState("");
  const [target, setTarget] = useState("@a");
  const [color, setColor] = useState("#FFD866");
  const [fadeIn, setFadeIn] = useState(0.5);
  const [stay, setStay] = useState(3);
  const [fadeOut, setFadeOut] = useState(0.5);
  const [copied, setCopied] = useState("");
  const targetValid = /^(@[aprs](\[[^\]]*\])?|[A-Za-z0-9_]{3,16})$/.test(target.trim());
  const ticks = (seconds: number) => Math.max(0, Math.min(1200, Math.round((Number.isFinite(seconds) ? seconds : 0) * 20)));
  const commands = targetValid ? [
    ...(title.trim() ? [{ name: "播放时间", value: `/title ${target.trim()} times ${ticks(fadeIn)} ${ticks(stay)} ${ticks(fadeOut)}` }] : []),
    ...(subtitle.trim() ? [{ name: "副标题", value: `/title ${target.trim()} subtitle ${component(subtitle.trim(), color, version)}` }] : []),
    ...(title.trim() ? [{ name: "主标题", value: `/title ${target.trim()} title ${component(title.trim(), color, version)}` }] : []),
    ...(actionbar.trim() ? [{ name: "操作栏", value: `/title ${target.trim()} actionbar ${component(actionbar.trim(), color, version)}` }] : []),
  ] : [];

  async function copy(value: string, name: string) { try { await navigator.clipboard.writeText(value); setCopied(name); window.setTimeout(() => setCopied(""), 1600); } catch { setCopied(""); } }

  return <section className="mc-section" id="title" aria-labelledby="title-heading"><div className="mc-section-header"><div><span className="mc-overline">08 / STORY SCREEN</span><h2 id="title-heading">标题与操作栏<span>指令生成器</span></h2></div><span className="mc-section-mark" aria-hidden="true">◇</span></div>
    <p className="mc-section-description">制作进服欢迎语、活动提示或剧情字幕。自动把秒数换成游戏刻，并按 Java 版本输出 JSON 或 SNBT 文本格式。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel"><div className="mc-form-section-label"><span>01</span> 画面文字</div><div className="mc-field-grid"><label className="mc-field mc-field-wide"><span>主标题 <small>TITLE</small></span><input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} /></label><label className="mc-field mc-field-wide"><span>副标题 <small>SUBTITLE</small></span><input value={subtitle} maxLength={100} onChange={(event) => setSubtitle(event.target.value)} /></label><label className="mc-field mc-field-wide"><span>操作栏 <small>ACTIONBAR · 可留空</small></span><input value={actionbar} maxLength={100} onChange={(event) => setActionbar(event.target.value)} /></label></div>
      <div className="mc-form-section-label"><span>02</span> 播放设置</div><div className="mc-field-grid"><label className="mc-field"><span>目标</span><input value={target} onChange={(event) => setTarget(event.target.value)} spellCheck={false} /></label><label className="mc-field"><span>文字颜色</span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label></div><div className="mc-coordinate-grid mc-title-times"><label className="mc-field"><span>淡入 / 秒</span><input type="number" min="0" max="60" step="0.05" value={fadeIn} onChange={(event) => setFadeIn(Number(event.target.value))} /></label><label className="mc-field"><span>停留 / 秒</span><input type="number" min="0" max="60" step="0.05" value={stay} onChange={(event) => setStay(Number(event.target.value))} /></label><label className="mc-field"><span>淡出 / 秒</span><input type="number" min="0" max="60" step="0.05" value={fadeOut} onChange={(event) => setFadeOut(Number(event.target.value))} /></label></div><p className="mc-field-hint">先执行“播放时间”和“副标题”，最后执行“主标题”；操作栏指令可单独使用。1 秒 = 20 游戏刻。</p></div>
      <aside className="mc-output-panel mc-color-output"><div className="mc-output-top"><span><i /> SCREEN PREVIEW</span><span>JAVA · {version}</span></div><div className="mc-title-preview"><span style={{ color }}>{title || "主标题"}</span><small style={{ color }}>{subtitle || "副标题"}</small><em style={{ color }}>{actionbar || "ACTIONBAR"}</em></div>{!targetValid && <p className="mc-output-warning">目标只能是玩家名或玩家选择器，例如 @a、@p。</p>}{!title.trim() && subtitle.trim() && <p className="mc-output-warning">副标题需要配合主标题才能在屏幕上显示。</p>}{!title.trim() && !actionbar.trim() && <p className="mc-output-note">填写主标题或操作栏文字后生成指令。</p>}{commands.map((entry) => <div className="mc-color-result" key={entry.name}><div className="mc-code-heading"><span>{entry.name}</span><span>COMMAND</span></div><pre className="mc-code-output"><code>{entry.value}</code></pre><button className="mc-copy-button" type="button" onClick={() => copy(entry.value, entry.name)}>{copied === entry.name ? "已复制 ✓" : "复制指令 ↗"}</button></div>)}</aside></div>
  </section>;
}
