"use client";

import { useState } from "react";
import { characters, type ColorMode, type TextStyle } from "@/lib/mc/textColors";

const MODES: { value: ColorMode; label: string }[] = [
  { value: "solid", label: "纯色" },
  { value: "gradient", label: "渐变" },
  { value: "alternate", label: "AB 交替" },
  { value: "manual", label: "逐字上色" },
];
const QUICK_COLORS = ["#FF5555", "#FFAA00", "#FFFF55", "#55FF55", "#55FFFF", "#5555FF", "#FF55FF", "#FFFFFF"];

export default function TextStyleControls({ text, style, onChange, label }: { text: string; style: TextStyle; onChange: (style: TextStyle) => void; label: string }) {
  const [selection, setSelection] = useState({ text, label, indices: [] as number[], anchor: 0 });
  const [paint, setPaint] = useState("#FF5555");
  const chars = characters(text);
  const selected = selection.text === text && selection.label === label ? selection.indices : [];
  const anchor = selection.text === text && selection.label === label ? selection.anchor : 0;

  function choose(index: number, shift: boolean) {
    if (shift) {
      const from = Math.min(anchor, index), to = Math.max(anchor, index);
      setSelection({ text, label, anchor, indices: Array.from({ length: to - from + 1 }, (_, offset) => from + offset) });
    } else {
      setSelection({ text, label, anchor: index, indices: selected.includes(index) ? selected.filter((entry) => entry !== index) : [...selected, index] });
    }
  }

  function apply(color: string) {
    setPaint(color);
    const indices = selected.length ? selected : chars.length ? [0] : [];
    const overrides = { ...style.overrides };
    indices.forEach((index) => { if (index < chars.length) overrides[index] = color; });
    onChange({ ...style, mode: "manual", overrides });
    if (!selected.length && chars.length) setSelection({ text, label, indices: [0], anchor: 0 });
  }

  return <div className="mc-text-style" aria-label={`${label}颜色设计`}>
    <div className="mc-text-mode" role="group" aria-label={`${label}配色方式`}>{MODES.map((mode) => <button key={mode.value} type="button" className={style.mode === mode.value ? "active" : ""} aria-pressed={style.mode === mode.value} onClick={() => onChange({ ...style, mode: mode.value })}>{mode.label}</button>)}</div>
    <div className="mc-field-grid mc-text-color-inputs"><label className="mc-field"><span>颜色 A <small>PRIMARY</small></span><input type="color" value={style.colorA} onChange={(event) => onChange({ ...style, colorA: event.target.value })} /></label><label className="mc-field"><span>颜色 B <small>GRADIENT / AB</small></span><input type="color" value={style.colorB} disabled={style.mode === "solid" || style.mode === "manual"} onChange={(event) => onChange({ ...style, colorB: event.target.value })} /></label></div>
    <div className="mc-check-group"><label className="mc-check"><input type="checkbox" checked={style.bold} onChange={(event) => onChange({ ...style, bold: event.target.checked })} /><span className="mc-check-box" aria-hidden="true" /> 粗体</label><label className="mc-check"><input type="checkbox" checked={style.italic} onChange={(event) => onChange({ ...style, italic: event.target.checked })} /><span className="mc-check-box" aria-hidden="true" /> 斜体</label></div>
    {style.mode === "manual" && <div className="mc-text-manual"><p>点击字符可多选；按住 Shift 可选择连续一段，再点下方颜色。</p><div className="mc-text-characters" role="group" aria-label={`${label}逐字选择`}>{chars.map((char, index) => <button key={index} type="button" aria-label={`第 ${index + 1} 字 ${char === " " ? "空格" : char}`} aria-pressed={selected.includes(index)} className={selected.includes(index) ? "active" : ""} onClick={(event) => choose(index, event.shiftKey)}>{char === " " ? "·" : char}</button>)}</div><div className="mc-text-paints">{QUICK_COLORS.map((color) => <button key={color} type="button" title={`应用 ${color}`} aria-label={`应用颜色 ${color}`} style={{ backgroundColor: color }} onClick={() => apply(color)} />)}<label title="自定义颜色">自定义 <input type="color" value={paint} onChange={(event) => apply(event.target.value)} /></label><button type="button" className="mc-text-clear" onClick={() => { onChange({ ...style, overrides: {} }); setSelection({ text, label, indices: [], anchor: 0 }); }}>清除逐字颜色</button></div></div>}
  </div>;
}
