"use client";

import { useState } from "react";
import useCopyFeedback from "@/lib/useCopyFeedback";

const TIMES = [
  { label: "日出", ticks: 0 },
  { label: "白天", ticks: 1000 },
  { label: "正午", ticks: 6000 },
  { label: "黄昏", ticks: 12000 },
  { label: "夜晚", ticks: 13000 },
  { label: "午夜", ticks: 18000 },
] as const;

const WEATHER = [
  { id: "clear", label: "晴朗", icon: "☀" },
  { id: "rain", label: "降雨", icon: "☂" },
  { id: "thunder", label: "雷暴", icon: "ϟ" },
] as const;

const DIFFICULTY = [
  { id: "peaceful", label: "和平" },
  { id: "easy", label: "简单" },
  { id: "normal", label: "普通" },
  { id: "hard", label: "困难" },
] as const;

function clockTime(ticks: number) {
  const minutes = Math.floor((ticks * 3 + 18000) / 50) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export default function WorldTool() {
  const [ticks, setTicks] = useState("1000");
  const [weather, setWeather] = useState<(typeof WEATHER)[number]["id"]>("clear");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY)[number]["id"]>("normal");
  const { copy, copyLabel } = useCopyFeedback();

  const timeValid = /^\d+$/.test(ticks.trim()) && Number(ticks) <= 23999;
  const time = timeValid ? Number(ticks) : null;
  const selectedWeather = WEATHER.find((entry) => entry.id === weather)!;
  const selectedDifficulty = DIFFICULTY.find((entry) => entry.id === difficulty)!;
  const commands = [
    { id: "time", label: "设定时间", value: time === null ? "" : `/time set ${time}` },
    { id: "weather", label: "切换天气", value: `/weather ${weather}` },
    { id: "difficulty", label: "设定难度", value: `/difficulty ${difficulty}` },
  ];

  return <section className="mc-section" id="world" aria-labelledby="world-heading">
    <div className="mc-section-header"><div><span className="mc-overline">11 / WORLD CONTROL</span><h2 id="world-heading">时间、天气与难度<span>世界控制台</span></h2></div><span className="mc-section-mark" aria-hidden="true">☀</span></div>
    <p className="mc-section-description">调整 Java 版世界的时间、天气与难度。选择预设或输入一天内的刻度，复制对应指令后在游戏中执行。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel">
      <div className="mc-form-section-label"><span>01</span> 游戏时间</div>
      <div className="mc-world-presets" role="group" aria-label="时间预设">{TIMES.map((entry) => <button type="button" className={time === entry.ticks ? "active" : ""} key={entry.label} onClick={() => setTicks(String(entry.ticks))}>{entry.label}<small>{String(entry.ticks).padStart(5, "0")}</small></button>)}</div>
      <label className="mc-field mc-world-ticks"><span>自定义刻度 <small>0–23999 TICKS</small></span><input type="number" min="0" max="23999" step="1" value={ticks} onChange={(event) => setTicks(event.target.value)} /></label>
      <p className="mc-field-hint">0 刻对应游戏内 06:00；每 1000 刻为游戏内 1 小时，24000 刻为一天。此处仅设置一天内的时刻。</p>
      <div className="mc-form-section-label"><span>02</span> 天气</div>
      <div className="mc-world-options" role="group" aria-label="天气">{WEATHER.map((entry) => <button type="button" aria-pressed={weather === entry.id} className={weather === entry.id ? "active" : ""} key={entry.id} onClick={() => setWeather(entry.id)}><span aria-hidden="true">{entry.icon}</span>{entry.label}</button>)}</div>
      <div className="mc-form-section-label"><span>03</span> 难度</div>
      <label className="mc-field"><span>游戏难度 <small>DIFFICULTY</small></span><select className="mc-select" value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>{DIFFICULTY.map((entry) => <option value={entry.id} key={entry.id}>{entry.label} · {entry.id}</option>)}</select></label>
    </div><aside className="mc-output-panel mc-color-output"><div className="mc-output-top"><span><i /> WORLD OUTPUT</span><span>JAVA EDITION</span></div>
      <div className="mc-world-preview"><span aria-hidden="true">{selectedWeather.icon}</span><strong>{time === null ? "--:--" : clockTime(time)}</strong><small>{selectedWeather.label} · {selectedDifficulty.label}难度</small></div>
      {!timeValid && <p className="mc-output-warning">时间刻度需要是 0 到 23999 之间的整数。</p>}
      {commands.map((entry) => <div className="mc-color-result" key={entry.id}><div className="mc-code-heading"><span>{entry.label}</span><span>COMMAND</span></div><pre className="mc-code-output"><code>{entry.value || "// 输入有效时间刻度"}</code></pre><button className="mc-copy-button" type="button" disabled={!entry.value} onClick={() => copy(entry.value)}>{copyLabel(entry.value)}</button></div>)}
      <p className="mc-output-note">三条指令可分别执行，需要相应权限。天气命令仅影响允许天气变化的维度；服务器规则或插件可能覆盖设置。</p>
    </aside></div>
  </section>;
}
