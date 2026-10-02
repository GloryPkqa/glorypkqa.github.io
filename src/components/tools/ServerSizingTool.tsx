"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import useCopyFeedback from "@/lib/useCopyFeedback";
import {
  estimateServerSizing,
  validateServerSizing,
  supportsSimulationDistance as hasSimulationDistance,
  SERVER_SIZING_LIMITS,
  SERVER_SIZING_SOURCES,
  type ServerSizingInput,
  type ServerSizingReport,
} from "@/lib/mc/server-sizing";

type SizingValues = Omit<ServerSizingInput, "version">;
type NumberField = "concurrentPlayers" | "totalPlayers" | "modCount" | "pluginCount" | "viewDistance" | "simulationDistance" | "worldCount" | "dimensionCount" | "cycleDays" | "runningHoursPerDay" | "playerHoursPerDay" | "backupCopies" | "backupIntervalHours" | "resourcePackMiB" | "currentWorldGiB" | "dailyGrowthGiB" | "physicalMemoryGiB" | "uploadMbps" | "pregenRadiusBlocks" | "joinsPerHour" | "residentEntities" | "permanentChunks" | "otherServicesGiB";
type SelectField = "extraLoad" | "redstone" | "spread" | "exploration" | "pregeneration" | "networkQuality" | "targetRegion" | "backupLocation" | "resourcePackHosting";
type Option = { value: string; label: string };
type BadNumberInputs = Partial<Record<NumberField, boolean>>;

const defaults: SizingValues = {
  core: "vanilla", gameplay: "survival", concurrentPlayers: "", totalPlayers: "",
  modCount: 0, pluginCount: 0, extraLoad: "light", redstone: "light", spread: "normal",
  viewDistance: 10, simulationDistance: 8, exploration: "medium", pregeneration: "none",
  worldCount: 1, dimensionCount: 3, cycleDays: 90, runningHoursPerDay: 24,
  playerHoursPerDay: 3, backupCopies: 3, backupLocation: "local", backupIntervalHours: 24,
  resourcePackMiB: 0, resourcePackHosting: "external", networkQuality: "normal", targetRegion: "domestic",
  pregenRadiusBlocks: 0, joinsPerHour: "", residentEntities: "", currentWorldGiB: "", dailyGrowthGiB: "",
  physicalMemoryGiB: "", uploadMbps: "", permanentChunks: "", otherServicesGiB: "",
};
const coreOptions = [
  { value: "vanilla", label: "原版服", hint: "Vanilla · 官方服务端" },
  { value: "plugin", label: "插件服", hint: "Paper / Spigot 等" },
  { value: "modded", label: "模组服", hint: "Forge / Fabric 等" },
  { value: "hybrid", label: "混合服", hint: "模组 + 插件" },
] as const;
const gameplayOptions = [
  { value: "survival", label: "生存 / SMP", hint: "生存、建造与探索" },
  { value: "minigame", label: "小游戏", hint: "大厅与独立竞技场" },
  { value: "creative", label: "创造 / 建筑", hint: "大型建筑与编辑" },
] as const;
const loadOptions: Option[] = [{ value: "light", label: "轻量 · 常规功能" }, { value: "medium", label: "中等 · 有较重功能" }, { value: "heavy", label: "重度 · 大型任务 / 运算" }];
const redstoneOptions: Option[] = [{ value: "none", label: "无 · 几乎不使用" }, { value: "light", label: "轻量 · 普通农场" }, { value: "medium", label: "中等 · 多个自动化农场" }, { value: "heavy", label: "重度 · 大型生电工程" }, { value: "extreme", label: "极重 · 高密度机器 / 实体" }];
const explorationOptions: Option[] = [{ value: "light", label: "轻量 · 固定活动区域" }, { value: "medium", label: "中等 · 偶尔跑图" }, { value: "heavy", label: "重度 · 经常分散探索" }, { value: "extreme", label: "极重 · 持续高速跑图" }];

function NumberInput({ field, value, error, onChange, label, hint, optional = false }: {
  field: NumberField;
  value: number | string | undefined;
  error?: string;
  onChange: (value: string, badInput: boolean) => void;
  label?: string;
  hint?: string;
  optional?: boolean;
}) {
  const limit = SERVER_SIZING_LIMITS[field];
  const id = `mc-sizing-${field}`;
  return <label className="mc-field" htmlFor={id}>
    <span>{label ?? limit.label}{optional && <small>可留空</small>}</span>
    <input id={id} data-sizing-field={field} aria-label={label ?? limit.label} type="number" inputMode={limit.integer ? "numeric" : "decimal"} min={limit.min} max={limit.max} step={limit.integer ? "1" : "any"} value={value ?? ""} placeholder={optional ? "未知可留空" : "请填写"} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} onChange={(event) => onChange(event.target.value, event.target.validity?.badInput ?? false)} />
    {error ? <span className="mc-sizing-field-error" id={`${id}-error`}>{error}</span> : hint && <em id={`${id}-hint`}>{hint}</em>}
  </label>;
}

function SelectInput({ field, label, value, options, onChange, hint, error }: {
  field: SelectField;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
}) {
  const id = `mc-sizing-${field}`;
  return <label className="mc-field" htmlFor={id}><span>{label}</span>
    <select id={id} data-sizing-field={field} aria-label={label} className="mc-select" value={value} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    {error ? <span className="mc-sizing-field-error" id={`${id}-error`}>{error}</span> : hint && <em id={`${id}-hint`}>{hint}</em>}
  </label>;
}

function displayNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
}

function badNumberErrors(fields: BadNumberInputs): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).filter(([, bad]) => bad).map(([field]) => [field, `${SERVER_SIZING_LIMITS[field as NumberField].label}输入尚未完成，请输入有效数字；未知的可选项请完全清空。`]));
}

export default function ServerSizingTool({ version }: { version: string }) {
  const [values, setValues] = useState<SizingValues>({ ...defaults });
  const [attempted, setAttempted] = useState(false);
  const [badNumberInputs, setBadNumberInputs] = useState<BadNumberInputs>({});
  const [generated, setGenerated] = useState<{ signature: string; report: ServerSizingReport } | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [reportVersion, setReportVersion] = useState(version);
  const [downloadedReport, setDownloadedReport] = useState("");
  const [downloadError, setDownloadError] = useState<{ signature: string; message: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const downloadUrls = useRef(new Map<string, number>());
  const { copy, copyLabel } = useCopyFeedback();
  const supportsSimulationDistance = hasSimulationDistance(version);
  const hasMods = values.core === "modded" || values.core === "hybrid";
  const hasPlugins = values.core === "plugin" || values.core === "hybrid";
  const input: ServerSizingInput = {
    ...values,
    version,
    modCount: hasMods ? values.modCount : 0,
    pluginCount: hasPlugins ? values.pluginCount : 0,
    simulationDistance: supportsSimulationDistance ? values.simulationDistance : values.viewDistance,
  };
  const signature = JSON.stringify(input);
  const visibleBadInputs = Object.fromEntries(Object.entries(badNumberInputs).filter(([field]) => (field !== "modCount" || hasMods) && (field !== "pluginCount" || hasPlugins) && (field !== "simulationDistance" || supportsSimulationDistance))) as BadNumberInputs;
  const fieldErrors = { ...validateServerSizing(input).fieldErrors, ...badNumberErrors(visibleBadInputs) };
  const validation = { fieldErrors, errors: Object.values(fieldErrors) };
  const errors = attempted ? validation.fieldErrors : {};
  const report = generated?.signature === signature && !validation.errors.length ? generated.report : null;

  if (reportVersion !== version) {
    setReportVersion(version);
    setGenerated(null);
    if (!supportsSimulationDistance && badNumberInputs.simulationDistance) {
      setBadNumberInputs((previous) => { const next = { ...previous }; delete next.simulationDistance; return next; });
    }
  }

  useEffect(() => {
    const urls = downloadUrls.current;
    return () => {
      for (const [url, timer] of urls) { window.clearTimeout(timer); URL.revokeObjectURL(url); }
      urls.clear();
    };
  }, []);

  function update<K extends keyof SizingValues>(field: K, value: SizingValues[K]) {
    if (Object.is(values[field], value)) return;
    setValues((previous) => ({ ...previous, [field]: value }));
    setGenerated(null);
    if (field === "core") {
      setBadNumberInputs((previous) => {
        const next = { ...previous };
        if (value !== "modded" && value !== "hybrid") delete next.modCount;
        if (value !== "plugin" && value !== "hybrid") delete next.pluginCount;
        return next;
      });
    }
  }

  function number(field: NumberField, label?: string, hint?: string, optional = false) {
    return <NumberInput field={field} value={values[field]} error={errors[field]} onChange={(value, badInput) => {
      update(field, value);
      setBadNumberInputs((previous) => {
        if (!!previous[field] === badInput) return previous;
        const next = { ...previous };
        if (badInput) next[field] = true; else delete next[field];
        return next;
      });
      if (badInput) setGenerated(null);
    }} label={label} hint={hint} optional={optional} />;
  }

  function select(field: SelectField, label: string, options: Option[], hint?: string) {
    return <SelectInput field={field} label={label} value={values[field]} options={options} error={errors[field]} hint={hint} onChange={(value) => update(field, value as SizingValues[typeof field])} />;
  }

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    // Native number inputs can display an unfinished exponent/sign while their
    // value is empty. Scan the actual form too, including edits whose empty
    // value did not change React state; they are different from an empty field.
    const submittedBadInputs: BadNumberInputs = event.currentTarget?.elements ? {} : { ...visibleBadInputs };
    if (event.currentTarget?.elements) {
      for (const element of Array.from(event.currentTarget.elements)) {
        const control = element as HTMLInputElement;
        const field = control.dataset?.sizingField as NumberField | undefined;
        if (control.type === "number" && field && Object.hasOwn(SERVER_SIZING_LIMITS, field) && control.validity.badInput) submittedBadInputs[field] = true;
      }
    }
    setBadNumberInputs(submittedBadInputs);
    const submittedErrors = { ...validateServerSizing(input).fieldErrors, ...badNumberErrors(submittedBadInputs) };
    if (Object.keys(submittedErrors).length) {
      setGenerated(null);
      document.getElementById(`mc-sizing-${Object.keys(submittedErrors)[0]}`)?.focus();
      return;
    }
    const result = estimateServerSizing(input);
    if (!result.report || result.errors.length) {
      setGenerated(null);
      const firstError = Object.keys(result.fieldErrors)[0];
      document.getElementById(`mc-sizing-${firstError}`)?.focus();
      return;
    }
    setGenerated({ signature, report: result.report });
    setHasGenerated(true);
  }

  function example() {
    // Reset native badInput too: its displayed text can be nonempty while the
    // controlled value already equals the example's empty optional value.
    formRef.current?.reset();
    setValues({ ...defaults, core: "plugin", concurrentPlayers: 10, totalPlayers: 30, pluginCount: 10 });
    setAttempted(false); setGenerated(null); setHasGenerated(false); setBadNumberInputs({});
  }

  function download() {
    if (!report) return;
    setDownloadedReport(""); setDownloadError(null);
    let url = "", link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([report.text], { type: "text/plain;charset=utf-8" }));
      link = document.createElement("a");
      link.href = url;
      link.download = `pkqa-server-sizing-${version.replaceAll(".", "_")}.txt`;
      document.body.append(link); link.click();
      const createdUrl = url;
      downloadUrls.current.set(createdUrl, window.setTimeout(() => { URL.revokeObjectURL(createdUrl); downloadUrls.current.delete(createdUrl); }, 60_000));
      setDownloadedReport(signature);
    } catch {
      if (url) URL.revokeObjectURL(url);
      setDownloadError({ signature, message: "配置报告下载失败，请重试或直接复制报告。" });
    } finally { link?.remove(); }
  }

  const metrics = report ? [
    { id: "cpuThreads" as const, label: "CPU 逻辑线程预算", unit: "线程", hint: "优先关注单核表现与独享资源，线程多不等于 TPS 高。" },
    { id: "ramGiB" as const, label: "机器总 RAM", unit: "GiB", hint: "包含 JVM 堆、堆外空间与系统余量。" },
    { id: "heapGiB" as const, label: "JVM 堆内存", unit: "GiB", hint: "可作为 Xmx 起步值，与机器总 RAM 有区别。" },
    { id: "storageGiB" as const, label: "SSD 空间预算", unit: "GiB", hint: "考虑世界、文件增长与所选备份方式。" },
    { id: "uploadMbps" as const, label: "上行带宽预算", unit: "Mbps", hint: "瞬时突发、跨区延迟与线路质量需实测。" },
    { id: "monthlyTrafficGiB" as const, label: "每月出站流量预算", unit: "GiB", hint: "用于比较流量额度；不代表固定月消耗。" },
  ] : [];

  return <section className="mc-section mc-sizing-section" id="sizing" aria-labelledby="sizing-heading">
    <div className="mc-section-header"><div><span className="mc-overline">17 / SERVER SIZING</span><h2 id="sizing-heading">开服配置<span>估算器</span></h2></div><span className="mc-section-mark" aria-hidden="true">▥</span></div>
    <p className="mc-section-description">根据人数、玩法与运行方式估算 CPU、内存、磁盘和网络预算。先填写计划，再生成报告；这些是本站模型的起步参考，实际表现还需要用你的世界与核心压测。</p>
    <form ref={formRef} className="mc-form-panel mc-sizing-form" onSubmit={generate} noValidate>
      <fieldset className="mc-sizing-group"><legend><span>01</span> 核心与玩家 <button className="mc-sizing-example-button" type="button" onClick={example}>载入 10 人示例</button></legend>
        <div className="mc-sizing-field-grid">
          <div className="mc-field mc-sizing-wide"><span>服务端核心</span><div className="mc-sizing-choices" role="group" aria-label="服务端核心">{coreOptions.map((option) => <button key={option.value} type="button" className={`mc-sizing-choice${values.core === option.value ? " active" : ""}`} aria-pressed={values.core === option.value} onClick={() => update("core", option.value)}><strong>{option.label}</strong><small>{option.hint}</small></button>)}</div></div>
          <div className="mc-field mc-sizing-span-two"><span>主要玩法</span><div className="mc-sizing-choices is-three" role="group" aria-label="主要玩法">{gameplayOptions.map((option) => <button key={option.value} type="button" className={`mc-sizing-choice${values.gameplay === option.value ? " active" : ""}`} aria-pressed={values.gameplay === option.value} onClick={() => update("gameplay", option.value)}><strong>{option.label}</strong><small>{option.hint}</small></button>)}</div></div>
          {number("concurrentPlayers", "预计峰值同时在线", "填写计划中最忙时段的在线人数。")}
          {number("totalPlayers", "预计总活跃玩家", "这一周目参与过的不同玩家人数。")}
        </div>
        <p className="mc-sizing-version-note">当前游戏版本：Java 版 {version}。人数是必填项；其他字段已给出普通生存服的参考默认值，可以按实际计划调整。模组与插件服请同时核实核心要求的 Java 版本。</p>
      </fieldset>

      <fieldset className="mc-sizing-group"><legend><span>02</span> 世界运行负载</legend><div className="mc-sizing-field-grid">
        {hasMods && number("modCount", "服务端模组数量", "只计算服务端实际加载的模组。")}
        {hasPlugins && number("pluginCount", "服务端插件数量", "数量只是参考，具体功能更重要。")}
        {select("extraLoad", "额外功能负载", loadOptions, "大型脚本、领地、经济、地图或模组运算。")}
        {select("redstone", "生电与自动化规模", redstoneOptions)}
        {select("spread", "玩家分散程度", [{ value: "together", label: "集中 · 多人在同一区域" }, { value: "normal", label: "普通 · 少量不同基地" }, { value: "scattered", label: "分散 · 多人独立活动" }], "分散活动通常会同时加载更多区块。")}
        {number("viewDistance", "视距 · 区块", "服务端 view-distance，半径单位为区块。")}
        {supportsSimulationDistance && number("simulationDistance", "模拟距离 · 区块", "不宜超过视距；影响运行中的实体与方块。")}
        {number("residentEntities", "预计同时加载实体数", "不知道可留空，模型将按人数和生电规模推测。", true)}
        {number("permanentChunks", "额外常加载区块数", "玩家附近以外的区块加载器等；留空按 0 估算。", true)}
      </div>{!supportsSimulationDistance && <p className="mc-sizing-version-note">Java {version} 原版没有独立的 simulation-distance 配置，报告按你填写的视距估算模拟范围。</p>}</fieldset>

      <fieldset className="mc-sizing-group"><legend><span>03</span> 跑图与世界规模</legend><div className="mc-sizing-field-grid">
        {select("exploration", "探索与跑图强度", explorationOptions)}
        {select("pregeneration", "区块预生成情况", [{ value: "none", label: "无 · 游戏中现场生成" }, { value: "partial", label: "部分 · 常用区域已生成" }, { value: "full", label: "全部 · 计划活动区域已生成" }], "预生成可缓解现场生成压力，但仍占磁盘。")}
        {number("pregenRadiusBlocks", "预生成半径 · 方块", "按每个世界、每个维度的方形区域估算；0 表示不指定。", true)}
        {number("worldCount", "独立世界数量", "如多个生存世界或独立副本。")}
        {number("dimensionCount", "每个世界的维度数", "普通原版世界可填 3：主世界、下界、末地。")}
        {number("cycleDays", "计划周目时长 · 天", "本次世界预计持续多久。")}
      </div></fieldset>

      <fieldset className="mc-sizing-group"><legend><span>04</span> 活跃时长、备份与资源包</legend><div className="mc-sizing-field-grid">
        {number("runningHoursPerDay", "服务器每天运行 · 小时", "全天运行可填 24。")}
        {number("playerHoursPerDay", "每位玩家日均在线 · 小时", "按全部活跃玩家的平均值填写。")}
        {number("joinsPerHour", "峰值每小时入服次数", "含重连；留空按同时在线人数的 0.5 倍估算。", true)}
        {number("backupCopies", "保留完整备份份数", "0 表示不安排备份；不是每天备份次数。")}
        {number("backupIntervalHours", "备份间隔 · 小时", "24 为每天一次，间隔影响 IO 与上传流量。")}
        {select("backupLocation", "备份存放位置", [{ value: "local", label: "本机 · 保留在本地磁盘" }, { value: "remote", label: "远程 · 上传至其他存储" }, { value: "both", label: "两处 · 本机与远程同时保留" }], "远程按完整、未压缩备份预算上行；实际可能因压缩或增量备份降低。")}
        {number("resourcePackMiB", "服务器资源包 · MiB", "不使用填 0，1 GiB = 1024 MiB。")}
        {select("resourcePackHosting", "资源包下载位置", [{ value: "external", label: "外部托管 · CDN / 其他网站" }, { value: "same-server", label: "同机托管 · 使用本机上行" }], "外部托管流量不计入本机上行预算。")}
      </div></fieldset>

      <fieldset className="mc-sizing-group"><legend><span>05</span> 网络与已有配置 <small className="mc-sizing-optional-label">已知数值可填，未知可留空</small></legend><div className="mc-sizing-field-grid">
        {select("networkQuality", "预计线路质量", [{ value: "good", label: "稳定 · 低丢包 / 波动小" }, { value: "normal", label: "一般 · 尚待实测" }, { value: "poor", label: "较差 · 丢包 / 抖动明显" }])}
        {select("targetRegion", "玩家与服务器区域", [{ value: "local", label: "本地 / 局域网" }, { value: "domestic", label: "同一国家 / 地区" }, { value: "cross-region", label: "跨国家 / 跨地区" }])}
        {number("currentWorldGiB", "现有世界总大小 · GiB", "已知当前实际体积可填；0 代表新世界。", true)}
        {number("dailyGrowthGiB", "每日新增世界数据 · GiB", "已知实测平均增长量可填；0 表示预计不增长。", true)}
        {number("physicalMemoryGiB", "已有机器 RAM · GiB", "用于与报告内存预算进行比较。", true)}
        {number("uploadMbps", "已有上行带宽 · Mbps", "填写持续可用上行，不是下载速度。", true)}
        {number("otherServicesGiB", "其他服务预留 RAM · GiB", "同机网站、数据库等；留空按 0 估算，不计入 JVM 堆。", true)}
      </div><p className="mc-sizing-version-note">网络质量由你自行判断，本页面不会测速或探测线路。同地区与跨地区设置只用于提醒延迟、丢包与线路检查，不能代替真实连接测试。</p></fieldset>

      {attempted && validation.errors.length > 0 && <div className="mc-sizing-form-errors" role="alert"><strong>还有 {validation.errors.length} 项需要检查</strong>{validation.errors.map((error) => <p key={error}>{error}</p>)}</div>}
      <div className="mc-sizing-submit-row"><p>生成后修改输入会停用旧报告，需要重新生成。计算与下载均在浏览器内完成。</p><button className="mc-sizing-submit" type="submit">生成配置报告 ↗</button></div>
    </form>

    <div className="mc-output-panel mc-sizing-report" aria-labelledby="mc-sizing-report-heading"><div className="mc-output-top"><span id="mc-sizing-report-heading"><i /> CAPACITY REPORT</span><span>JAVA · {version}{report ? ` · ${report.modelVersion}` : ""}</span></div>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{report ? "配置报告已生成，可查看资源预算或复制、下载报告。" : hasGenerated ? "配置已变化，原报告已停用，请重新生成。" : ""}</span>
      {!report ? <div className="mc-sizing-empty"><span aria-hidden="true">▥</span><div><strong>{hasGenerated ? "输入已变化，请重新生成报告" : "填写人数，然后生成配置报告"}</strong><p>{attempted && validation.errors.length ? "先修正表单中标出的字段，再点击生成。" : "其他选项可以保持默认，也可载入示例了解结果。"}</p></div></div> : <>
        <p className="mc-sizing-report-summary">{report.summary}</p>
        <div className="mc-sizing-metrics">{metrics.map((metric) => <article className="mc-sizing-metric" key={metric.id}><span>{metric.label}</span><dl><dt>最低起步</dt><dd>{displayNumber(report.minimum[metric.id])}<small>{metric.unit}</small></dd><dt>留有冗余</dt><dd>{displayNumber(report.recommended[metric.id])}<small>{metric.unit}</small></dd></dl><p>{metric.hint}</p></article>)}</div>
        <div className="mc-sizing-report-facts"><span>平均在线参考 <strong>{displayNumber(report.averagePlayers)} 人</strong></span><span>加载区块参考 <strong>{displayNumber(report.loadedChunks)}</strong></span><span>周目世界体积 <strong>{displayNumber(report.worldGiB.low)}–{displayNumber(report.worldGiB.high)} GiB</strong></span><span>估算不确定性 <strong>{report.confidence === "very-low" ? "很高" : "较高"}</strong></span></div>
        <p className="mc-output-note">原版运行时参考：Java {report.javaVersion ?? "待核实"}；请按实际服务端核心或整合包要求核对 Java 版本。</p>
        <div className="mc-sizing-report-notes"><section><h3>主要影响因素与假设</h3><ul>{[...report.drivers, ...report.assumptions].map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul></section><section><h3>需要关注与验证</h3><ul>{[...report.warnings, ...report.steps].map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul></section></div>
        <details className="mc-sizing-report-details"><summary>查看完整可复制报告</summary><pre className="mc-code-output mc-sizing-report-code"><code>{report.text}</code></pre></details>
      </>}
      <div className="mc-sizing-report-actions"><button className="mc-copy-button" type="button" disabled={!report} onClick={() => { if (report) copy(report.text); }}>{copyLabel(report?.text ?? "", "复制配置报告 ↗")}</button><button className="mc-copy-button mc-sizing-download" type="button" disabled={!report} onClick={download}>{report && downloadedReport === signature ? "报告已准备下载 ✓" : "下载报告 .txt ↓"}</button></div>
      {downloadError?.signature === signature && <p className="mc-output-warning" role="alert">{downloadError.message}</p>}
      <p className="mc-sizing-sources">规则参考：{SERVER_SIZING_SOURCES.map((source, index) => <span key={source.url}>{index > 0 && " · "}<a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></span>)}。资源预算系本站启发式估算，并非这些来源的硬件保证。</p>
    </div>
  </section>;
}
