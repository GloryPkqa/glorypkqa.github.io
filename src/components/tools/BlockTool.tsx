"use client";

import { useState } from "react";
import useCopyFeedback from "@/lib/useCopyFeedback";
import { versionAtLeast, type McCatalog } from "@/lib/mc/give";

type Point = [string, string, string];
type FillMode = "replace" | "keep" | "destroy" | "hollow" | "outline";

const AXES = ["X", "Y", "Z"] as const;
const FILL_MODES: { value: FillMode; label: string }[] = [
  { value: "replace", label: "全部替换" },
  { value: "keep", label: "仅填空气" },
  { value: "destroy", label: "破坏原方块" },
  { value: "hollow", label: "空心" },
  { value: "outline", label: "仅外框" },
];

function parsedPoint(point: Point) {
  const values = point.map((value) => Number(value));
  return point.every((value) => /^-?\d+$/.test(value.trim())) && values.every(Number.isSafeInteger)
    ? values as number[]
    : null;
}

function PointFields({ label, point, onChange }: { label: string; point: Point; onChange: (point: Point) => void }) {
  return <><div className="mc-form-section-label"><span>{label === "起点" ? "02" : "03"}</span> {label}坐标</div><div className="mc-coordinate-grid">{AXES.map((axis, index) => <label className="mc-field" key={`${label}-${axis}`}><span>{axis}</span><input type="number" step="1" value={point[index]} onChange={(event) => onChange(point.map((value, i) => i === index ? event.target.value : value) as Point)} /></label>)}</div></>;
}

export default function BlockTool({ version, catalog }: { version: string; catalog: McCatalog | null }) {
  const [block, setBlock] = useState("stone");
  const [start, setStart] = useState<Point>(["0", "64", "0"]);
  const [end, setEnd] = useState<Point>(["9", "68", "9"]);
  const [fillMode, setFillMode] = useState<FillMode>("replace");
  const [setMode, setSetMode] = useState("replace");
  const { copy, isCopied } = useCopyFeedback();

  const blockId = block.trim().toLowerCase().replace(/^minecraft:/, "");
  const matchingBlock = catalog?.blocks?.find((entry) => entry.name === blockId);
  const from = parsedPoint(start);
  const to = parsedPoint(end);
  const volume = from && to ? from.reduce((result, value, index) => result * (Math.abs(value - to[index]) + 1), 1) : null;
  const legacy = !versionAtLeast(version, "1.13");
  const limitHint = !versionAtLeast(version, "1.19.4") ? "这个版本的原版上限固定为 32,768 格，请缩小区域或分多次填充。"
    : `实际上限由 ${versionAtLeast(version, "1.21.11") ? "minecraft:max_block_modifications" : "commandModificationBlockLimit"} 游戏规则决定。`;
  const setCommand = matchingBlock && from
    ? `/setblock ${from.join(" ")} minecraft:${blockId}${legacy ? ` 0 ${setMode}` : setMode === "replace" ? "" : ` ${setMode}`}`
    : "";
  const fillCommand = matchingBlock && from && to && volume && Number.isSafeInteger(volume)
    ? `/fill ${from.join(" ")} ${to.join(" ")} minecraft:${blockId}${legacy ? ` 0 ${fillMode}` : fillMode === "replace" ? "" : ` ${fillMode}`}`
    : "";

  return <section className="mc-section" id="blocks" aria-labelledby="blocks-heading">
    <div className="mc-section-header"><div><span className="mc-overline">09 / BUILDER DESK</span><h2 id="blocks-heading">方块放置与区域填充<span>指令生成器</span></h2></div><span className="mc-section-mark" aria-hidden="true">▣</span></div>
    <p className="mc-section-description">从当前 Java 版本的方块目录选材，输入两个角的绝对坐标，生成 /setblock 与 /fill 指令，并预估区域体积。</p>
    <div className="mc-lab-grid"><div className="mc-form-panel">
      <div className="mc-form-section-label"><span>01</span> 选择方块</div>
      <label className="mc-field"><span>方块 ID <small>BLOCK</small></span><input list="mc-block-list" value={block} onChange={(event) => setBlock(event.target.value)} spellCheck={false} autoComplete="off" placeholder="stone" /><datalist id="mc-block-list">{catalog?.blocks?.map((entry) => <option key={entry.name} value={entry.name} label={entry.displayName} />)}</datalist><em>{!catalog ? "正在载入方块数据…" : !catalog.blocks ? "方块数据未更新，请刷新页面后重试" : matchingBlock ? `${matchingBlock.displayName} · minecraft:${matchingBlock.name}` : "请选择当前版本中的有效方块 ID"}</em></label>
      <PointFields label="起点" point={start} onChange={setStart} />
      <PointFields label="终点" point={end} onChange={setEnd} />
      <div className="mc-form-section-label"><span>04</span> 放置方式</div>
      <div className="mc-field-grid"><label className="mc-field"><span>单个方块 /setblock</span><select className="mc-select" value={setMode} onChange={(event) => setSetMode(event.target.value)}><option value="replace">替换</option><option value="keep">仅空位放置</option><option value="destroy">破坏后放置</option></select></label><label className="mc-field"><span>区域填充 /fill</span><select className="mc-select" value={fillMode} onChange={(event) => setFillMode(event.target.value as FillMode)}>{FILL_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label></div>
      <p className="mc-field-hint">起点用于 /setblock；/fill 使用起点与终点，两个角可以按任意方向填写。这里生成方块的默认状态；朝向、水浸等方块状态暂未加入。</p>
    </div><aside className="mc-output-panel mc-color-output"><div className="mc-output-top"><span><i /> BUILD PREVIEW</span><span>JAVA · {version}</span></div><div className="mc-block-display"><span aria-hidden="true">▣</span><strong>{matchingBlock?.displayName ?? "选择方块"}</strong><small>{matchingBlock ? `minecraft:${matchingBlock.name}` : "minecraft:..."}</small><div>区域体积 <b>{volume !== null && Number.isSafeInteger(volume) ? volume.toLocaleString("zh-CN") : "—"}</b> 格</div></div>
      {!from && <p className="mc-output-warning">起点的 X、Y、Z 都需要填写整数。</p>}{!to && <p className="mc-output-warning">终点的 X、Y、Z 都需要填写整数。</p>}{volume !== null && volume > 32768 && <p className="mc-output-warning">⚠ 区域超过 32,768 方块默认上限。{limitHint}</p>}
      {[{ key: "set", name: "放置单个方块", command: setCommand }, { key: "fill", name: "填充区域", command: fillCommand }].map((entry) => <div className="mc-color-result" key={entry.key}><div className="mc-code-heading"><span>{entry.name}</span><span>COMMAND</span></div><pre className="mc-code-output"><code>{entry.command || "// 选择方块并填写有效坐标"}</code></pre><button className="mc-copy-button" type="button" disabled={!entry.command} onClick={() => copy(entry.command)}>{isCopied(entry.command) ? "已复制 ✓" : "复制指令 ↗"}</button></div>)}
      <p className="mc-output-note">指令需要相应权限。区域填充会改变世界，请在游戏内检查坐标与方块后执行。</p>
    </aside></div>
  </section>;
}
