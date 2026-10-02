"use client";

import { useState } from "react";
import useCopyFeedback from "@/lib/useCopyFeedback";
import TextStyleControls from "@/components/tools/TextStyleControls";
import { coloredParts, defaultTextStyle, previewTextParts, remapTextColors, textComponent } from "@/lib/mc/textColors";
import { versionAtLeast } from "@/lib/mc/give";

const COLORS = [
  ["黑色", "0", "#000000"], ["深蓝", "1", "#0000AA"], ["深绿", "2", "#00AA00"], ["青色", "3", "#00AAAA"],
  ["深红", "4", "#AA0000"], ["紫色", "5", "#AA00AA"], ["金色", "6", "#FFAA00"], ["灰色", "7", "#AAAAAA"],
  ["深灰", "8", "#555555"], ["蓝色", "9", "#5555FF"], ["亮绿", "a", "#55FF55"], ["浅蓝", "b", "#55FFFF"],
  ["亮红", "c", "#FF5555"], ["粉色", "d", "#FF55FF"], ["黄色", "e", "#FFFF55"], ["白色", "f", "#FFFFFF"],
] as const;

export default function ColorTool({ version }: { version: string }) {
  const [message, setMessage] = useState("欢迎来到 Pkqa Center!");
  const [colorCode, setColorCode] = useState("a");
  const [style, setStyle] = useState(() => defaultTextStyle());
  const { copy, copyLabel } = useCopyFeedback();
  const cleanMessage = message;
  const parts = coloredParts(cleanMessage, style);
  const previewParts = previewTextParts(parts, version);
  const modifiers = `${style.bold ? "l" : ""}${style.italic ? "o" : ""}`;
  const outputs = [
    { title: "Java /tellraw 指令", detail: version.startsWith("1.") && Number(version.split(".")[1]) <= 20 ? "旧版 · JSON" : "新版 · SNBT", value: `/tellraw @a ${textComponent(parts, version)}` },
    { title: "传统 § 颜色码", detail: "经典 16 色；不支持 RGB、渐变和逐字色", value: `§${colorCode}${modifiers ? `§${modifiers.split("").join("§")}` : ""}${cleanMessage}§r` },
    { title: "插件 & 颜色码", detail: "需要插件支持 & 代码；仅经典 16 色", value: `&${colorCode}${modifiers ? `&${modifiers.split("").join("&")}` : ""}${cleanMessage}&r` },
  ];
  const longCommand = outputs[0].value.length > (versionAtLeast(version, "1.11") ? 256 : 100);

  return <section className="mc-section" id="colors" aria-labelledby="colors-heading">
    <div className="mc-section-header"><div><span className="mc-overline">02 / TEXT STUDIO</span><h2 id="colors-heading">文字与颜色<span>生成器</span></h2></div><span className="mc-section-mark" aria-hidden="true">✧</span></div>
    <p className="mc-section-description">经典 16 色、RGB 渐变、AB 交替或手动指定每一段文字的颜色。实时预览，并复制对应版本的 /tellraw 指令。{version === "1.8.9" || version === "1.12.2" ? " 旧版本不支持 RGB，生成指令时会逐段匹配最接近的经典颜色。" : ""}</p>
    <div className="mc-lab-grid"><div className="mc-form-panel">
      <label className="mc-field"><span>你的文字 <small>MESSAGE</small></span><textarea rows={3} value={message} maxLength={120} onChange={(event) => { const next = event.target.value, caret = event.target.selectionStart; setStyle((previous) => ({ ...previous, overrides: remapTextColors(message, next, previous.overrides, caret) })); setMessage(next); }} /></label>
      <div className="mc-form-section-label"><span>01</span> 经典调色盘</div>
      <div className="mc-color-grid">{COLORS.map(([label, code, hex]) => <button key={code} type="button" className={`mc-color-swatch${colorCode === code && style.mode === "solid" ? " active" : ""}`} title={`${label} · §${code}`} aria-label={`${label} §${code}`} aria-pressed={colorCode === code && style.mode === "solid"} onClick={() => { setColorCode(code); setStyle({ ...style, colorA: hex, mode: "solid" }); }}><span style={{ backgroundColor: hex }} /><small>§{code}</small></button>)}</div>
      <div className="mc-form-section-label"><span>02</span> 自定义配色</div>
      <TextStyleControls label="聊天文字" text={cleanMessage} style={style} onChange={setStyle} />
      <p className="mc-field-hint">RGB、渐变、AB 交替和逐字色会写进 /tellraw。传统 § 与插件 & 代码只保留上方经典调色盘选中的颜色。输入中的 § / & 格式码可能被游戏或插件再次解释。</p>
    </div><aside className="mc-output-panel mc-color-output"><div className="mc-output-top"><span><i /> LIVE PREVIEW</span><span>JAVA · {version}</span></div>
      <div className="mc-chat-preview"><span className="mc-chat-label">MINECRAFT CHAT</span><div>{previewParts.length ? previewParts.map((part, index) => <span key={index} style={{ color: part.color, fontWeight: part.bold ? 800 : 400, fontStyle: part.italic ? "italic" : "normal" }}>{part.text}</span>) : <span>预览文字</span>}</div></div>
      {longCommand && <p className="mc-output-note">较长指令建议放入命令方块执行；聊天框可能截断。{versionAtLeast(version, "1.12") && " 也可去掉开头 /，写入 .mcfunction 文件。"}</p>}{outputs.map((output) => <div className="mc-color-result" key={output.title}><div className="mc-code-heading"><span>{output.title}</span><span>{output.detail}</span></div><pre className="mc-code-output"><code>{output.value}</code></pre><button className="mc-copy-button" type="button" onClick={() => copy(output.value)}>{copyLabel(output.value, "复制代码 ↗")}</button></div>)}
    </aside></div>
  </section>;
}
