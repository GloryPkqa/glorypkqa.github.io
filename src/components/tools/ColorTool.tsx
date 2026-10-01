"use client";

import { useMemo, useState } from "react";

const COLORS = [
  ["黑色", "0", "#000000"], ["深蓝", "1", "#0000AA"], ["深绿", "2", "#00AA00"], ["青色", "3", "#00AAAA"],
  ["深红", "4", "#AA0000"], ["紫色", "5", "#AA00AA"], ["金色", "6", "#FFAA00"], ["灰色", "7", "#AAAAAA"],
  ["深灰", "8", "#555555"], ["蓝色", "9", "#5555FF"], ["亮绿", "a", "#55FF55"], ["浅蓝", "b", "#55FFFF"],
  ["亮红", "c", "#FF5555"], ["粉色", "d", "#FF55FF"], ["黄色", "e", "#FFFF55"], ["白色", "f", "#FFFFFF"],
] as const;

function snbt(value: string) { return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`; }
function hexParts(value: string) { return [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16)); }
function gradientColor(first: string, last: string, ratio: number) {
  const a = hexParts(first), b = hexParts(last);
  return `#${a.map((part, index) => Math.round(part + (b[index] - part) * ratio).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export default function ColorTool({ version }: { version: string }) {
  const [message, setMessage] = useState("欢迎来到 Pkqa Center!");
  const [colorCode, setColorCode] = useState("a");
  const [customColor, setCustomColor] = useState("#55FF55");
  const [endColor, setEndColor] = useState("#55FFFF");
  const [gradient, setGradient] = useState(false);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [copied, setCopied] = useState("");
  const modern = version !== "1.20.4" && version !== "1.20.6";
  const cleanMessage = message.replaceAll("§", "");

  const outputs = useMemo(() => {
    const clean = cleanMessage;
    const chars = [...clean];
    const text = gradient && chars.length ? chars.map((char, index) => ({ text: char, color: gradientColor(customColor, endColor, chars.length < 2 ? 0 : index / (chars.length - 1)), bold, italic })) : { text: clean, color: customColor, bold, italic };
    const asSnbt = (part: { text: string; color: string; bold: boolean; italic: boolean }) => `{text:${snbt(part.text)},color:${snbt(part.color)},bold:${part.bold},italic:${part.italic}}`;
    const component = modern ? (Array.isArray(text) ? `[${text.map(asSnbt).join(",")}]` : asSnbt(text)) : JSON.stringify(text);
    const modifiers = `${bold ? "l" : ""}${italic ? "o" : ""}`;
    return [
      { title: "Java /tellraw 指令", detail: modern ? "1.21.5+ · SNBT" : "1.20.x · JSON", value: `/tellraw @a ${component}` },
      { title: "传统 § 颜色码", detail: "仅适用于支持旧式颜色码的输入处", value: `§${colorCode}${modifiers ? `§${modifiers.split("").join("§")}` : ""}${clean}§r` },
      { title: "插件 & 颜色码", detail: "仅适用于支持 & 代码的插件", value: `&${colorCode}${modifiers ? `&${modifiers.split("").join("&")}` : ""}${clean}&r` },
    ];
  }, [cleanMessage, customColor, endColor, gradient, bold, italic, colorCode, modern]);

  async function copy(value: string, key: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); window.setTimeout(() => setCopied(""), 1600); } catch { setCopied(""); }
  }

  return <section className="mc-section" id="colors" aria-labelledby="colors-heading">
    <div className="mc-section-header"><div><span className="mc-overline">02 / TEXT STUDIO</span><h2 id="colors-heading">文字与颜色<span>生成器</span></h2></div><span className="mc-section-mark" aria-hidden="true">✧</span></div>
    <p className="mc-section-description">选经典 16 色，或者自定义 RGB 与渐变。预览文字，并一键复制适合你使用场景的代码。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel">
      <label className="mc-field"><span>你的文字 <small>MESSAGE</small></span><textarea rows={3} value={message} maxLength={120} onChange={(event) => setMessage(event.target.value)} /></label>
      <div className="mc-form-section-label"><span>01</span> 经典调色盘</div>
      <div className="mc-color-grid">{COLORS.map(([label, code, hex]) => <button key={code} type="button" className={`mc-color-swatch${colorCode === code ? " active" : ""}`} title={`${label} · §${code}`} aria-label={`${label} §${code}`} aria-pressed={colorCode === code} onClick={() => { setColorCode(code); setCustomColor(hex); setGradient(false); }}><span style={{ backgroundColor: hex }} /><small>§{code}</small></button>)}</div>
      <div className="mc-form-section-label"><span>02</span> 自定义样式</div>
      <div className="mc-field-grid"><label className="mc-field"><span>起始颜色 <small>RGB</small></span><input type="color" value={customColor} onChange={(event) => setCustomColor(event.target.value)} /></label><label className="mc-field"><span>结束颜色 <small>GRADIENT</small></span><input type="color" value={endColor} disabled={!gradient} onChange={(event) => setEndColor(event.target.value)} /></label></div>
      <div className="mc-check-group"><label className="mc-check"><input type="checkbox" checked={gradient} onChange={(event) => setGradient(event.target.checked)} /><span className="mc-check-box" aria-hidden="true" /> 渐变</label><label className="mc-check"><input type="checkbox" checked={bold} onChange={(event) => setBold(event.target.checked)} /><span className="mc-check-box" aria-hidden="true" /> 粗体</label><label className="mc-check"><input type="checkbox" checked={italic} onChange={(event) => setItalic(event.target.checked)} /><span className="mc-check-box" aria-hidden="true" /> 斜体</label></div>
      <p className="mc-field-hint">RGB 与渐变会应用到 /tellraw；传统 § / & 代码只能使用经典 16 色。</p>
    </div><aside className="mc-output-panel mc-color-output"><div className="mc-output-top"><span><i /> LIVE PREVIEW</span><span>JAVA · {version}</span></div>
      <div className="mc-chat-preview"><span className="mc-chat-label">MINECRAFT CHAT</span><div>{gradient ? [...cleanMessage].map((char, index, chars) => <span key={index} style={{ color: gradientColor(customColor, endColor, chars.length < 2 ? 0 : index / (chars.length - 1)), fontWeight: bold ? 800 : 400, fontStyle: italic ? "italic" : "normal" }}>{char}</span>) : <span style={{ color: customColor, fontWeight: bold ? 800 : 400, fontStyle: italic ? "italic" : "normal" }}>{cleanMessage || "预览文字"}</span>}</div></div>
      {outputs.map((output) => <div className="mc-color-result" key={output.title}><div className="mc-code-heading"><span>{output.title}</span><span>{output.detail}</span></div><pre className="mc-code-output"><code>{output.value}</code></pre><button className="mc-copy-button" type="button" onClick={() => copy(output.value, output.title)}>{copied === output.title ? "已复制 ✓" : "复制代码 ↗"}</button></div>)}
    </aside></div>
  </section>;
}
