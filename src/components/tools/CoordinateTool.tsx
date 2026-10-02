"use client";

import { useState } from "react";
import useCopyFeedback from "@/lib/useCopyFeedback";
import { versionAtLeast } from "@/lib/mc/give";

function floorBlock(value: number) { return Math.floor(value).toLocaleString("zh-CN"); }
function direction(dx: number, dy: number, dz: number) {
  if (dx === 0 && dz === 0) return dy > 0 ? "正上方" : dy < 0 ? "正下方" : "已经到达目标";
  const angle = Math.atan2(-dx, dz) * 180 / Math.PI;
  const names = ["南", "西南", "西", "西北", "北", "东北", "东", "东南"];
  return names[Math.round((angle + 360) % 360 / 45) % 8];
}

export default function CoordinateTool({ version }: { version: string }) {
  const [dimension, setDimension] = useState<"overworld" | "nether">("overworld");
  const [x, setX] = useState("800");
  const [y, setY] = useState("64");
  const [z, setZ] = useState("-1600");
  const [targetX, setTargetX] = useState("1200");
  const [targetY, setTargetY] = useState("64");
  const [targetZ, setTargetZ] = useState("-800");
  const { copy, isCopied } = useCopyFeedback();
  const valid = [x, y, z].every((value) => value.trim() !== "" && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= Number.MAX_SAFE_INTEGER / 8);
  const hasTarget = [targetX, targetY, targetZ].some((value) => value.trim() !== "");
  const targetValid = [targetX, targetY, targetZ].every((value) => value.trim() !== "" && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= Number.MAX_SAFE_INTEGER / 8);
  const output = (() => {
    if (!valid) return null;
    const [fromX, fromY, fromZ] = [x, y, z].map(Number);
    const factor = dimension === "overworld" ? 1 / 8 : 8;
    const route = targetValid ? (() => { const [toX, toY, toZ] = [targetX, targetY, targetZ].map(Number); const dx = toX - fromX, dy = toY - fromY, dz = toZ - fromZ; return { horizontal: Math.hypot(dx, dz), spatial: Math.hypot(dx, dy, dz), dx, dy, dz, bearing: direction(dx, dy, dz) }; })() : null;
    return { portalX: Math.floor(fromX * factor), portalZ: Math.floor(fromZ * factor), route, command: `/tp ${versionAtLeast(version, "1.12") ? "@s" : "@p"} ${Math.floor(fromX * factor)} ${Math.floor(fromY)} ${Math.floor(fromZ * factor)}` };
  })();

  return <section className="mc-section" id="coordinates" aria-labelledby="coordinates-heading"><div className="mc-section-header"><div><span className="mc-overline">03 / NAVIGATION DESK</span><h2 id="coordinates-heading">坐标与距离<span>计算器</span></h2></div><span className="mc-section-mark" aria-hidden="true">⌖</span></div>
    <p className="mc-section-description">主世界和下界传送门坐标互算，还可以计算两点间的路程与大致方向。所有计算都在浏览器完成。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel"><div className="mc-form-section-label"><span>01</span> 当前坐标</div><div className="mc-dimension-tabs"><button type="button" className={dimension === "overworld" ? "active" : ""} aria-pressed={dimension === "overworld"} onClick={() => setDimension("overworld")}>主世界 → 下界</button><button type="button" className={dimension === "nether" ? "active" : ""} aria-pressed={dimension === "nether"} onClick={() => setDimension("nether")}>下界 → 主世界</button></div>
      <div className="mc-coordinate-grid"><label className="mc-field"><span>X</span><input type="number" value={x} onChange={(event) => setX(event.target.value)} /></label><label className="mc-field"><span>Y</span><input type="number" value={y} onChange={(event) => setY(event.target.value)} /></label><label className="mc-field"><span>Z</span><input type="number" value={z} onChange={(event) => setZ(event.target.value)} /></label></div>
      <div className="mc-form-section-label"><span>02</span> 目标坐标 <small>可选：计算距离</small></div><div className="mc-coordinate-grid"><label className="mc-field"><span>X</span><input type="number" value={targetX} onChange={(event) => setTargetX(event.target.value)} /></label><label className="mc-field"><span>Y</span><input type="number" value={targetY} onChange={(event) => setTargetY(event.target.value)} /></label><label className="mc-field"><span>Z</span><input type="number" value={targetZ} onChange={(event) => setTargetZ(event.target.value)} /></label></div>{hasTarget && !targetValid && <p className="mc-field-hint">要计算距离，请把目标 X、Y、Z 都填完整；传送门坐标仍可正常换算。</p>}
      <p className="mc-field-hint">X、Z 按 8:1 换算；Y 不换算。落点会向下取整到方块坐标，实际传送门配对还受游戏搜索范围与地形影响。</p>
    </div><aside className="mc-output-panel"><div className="mc-output-top"><span><i /> ROUTE PREVIEW</span><span>JAVA & BEDROCK</span></div>{output ? <><div className="mc-coordinate-result"><span>{dimension === "overworld" ? "下界" : "主世界"}对应坐标</span><strong>{floorBlock(output.portalX)} <em>/</em> {floorBlock(Number(y))} <em>/</em> {floorBlock(output.portalZ)}</strong><small>X / Y / Z</small></div>{output.route && <><div className="mc-route-stats"><div><span>水平距离</span><strong>{output.route.horizontal.toFixed(1)} <small>格</small></strong></div><div><span>直线距离</span><strong>{output.route.spatial.toFixed(1)} <small>格</small></strong></div><div><span>前进方向</span><strong>{output.route.bearing}</strong></div></div><p className="mc-route-tip">目标相对当前：X {output.route.dx >= 0 ? "+" : ""}{output.route.dx} · Y {output.route.dy >= 0 ? "+" : ""}{output.route.dy} · Z {output.route.dz >= 0 ? "+" : ""}{output.route.dz}</p></>}<div className="mc-code-heading"><span>对应坐标传送指令</span><span>COMMAND</span></div><pre className="mc-code-output"><code>{output.command}</code></pre><button className="mc-copy-button" type="button" onClick={() => void copy(output.command)}>{isCopied(output.command) ? "已复制 ✓" : "复制指令 ↗"}</button></> : <p className="mc-output-warning">请输入有效的数字坐标。</p>}<p className="mc-output-note">/tp 指令需要相应权限；复制后请确认所在维度。</p></aside></div>
  </section>;
}
