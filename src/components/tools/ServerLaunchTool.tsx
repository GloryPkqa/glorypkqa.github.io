"use client";

import { useEffect, useRef, useState } from "react";
import useCopyFeedback from "@/lib/useCopyFeedback";
import {
  makeServerLaunch,
  recommendedJavaForVersion,
  flagSupportReason,
  formatServerFlag,
  SERVER_GC_OPTIONS,
  SERVER_JVM_FLAGS,
  SERVER_JVM_GROUPS,
  type ServerLaunchInput,
  type ServerJvmFlag,
} from "@/lib/mc/server-launch";

type MemoryUnit = "MiB" | "GiB";
type Memory = { value: string; unit: MemoryUnit; badInput?: boolean };

const javaChoices = [8, 11, 16, 17, 21, 25];
const platforms: { id: ServerLaunchInput["platform"]; label: string; hint: string }[] = [
  { id: "cmd", label: "Windows · CMD", hint: "命令提示符 / .bat" },
  { id: "powershell", label: "Windows · PowerShell", hint: "PowerShell / .ps1" },
  { id: "sh", label: "Linux / macOS · sh", hint: "终端 / .sh" },
];
const collectorFlags: Record<ServerLaunchInput["collector"], string> = {
  default: "JVM 默认",
  g1: "-XX:+UseG1GC",
  zgc: "-XX:+UseZGC",
  parallel: "-XX:+UseParallelGC",
  serial: "-XX:+UseSerialGC",
};

function memoryMiB(memory: Memory): number | string {
  if (memory.badInput) return NaN;
  if (!memory.value.trim()) return "";
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(memory.value)) return NaN;
  return Number(memory.value) * (memory.unit === "GiB" ? 1024 : 1);
}

function changeMemoryUnit(memory: Memory, unit: MemoryUnit): Memory {
  const mib = memoryMiB(memory);
  return { ...memory, unit, value: typeof mib === "number" && Number.isFinite(mib) ? String(mib / (unit === "GiB" ? 1024 : 1)) : memory.value };
}

function MemoryField({ id, label, memory, onChange, optional = false }: {
  id: string;
  label: string;
  memory: Memory;
  onChange: (memory: Memory) => void;
  optional?: boolean;
}) {
  return <div className="mc-field mc-launch-memory-field">
    <label htmlFor={id}>{label}{optional && <small>可留空</small>}</label>
    <div className="mc-launch-memory-input">
      <input id={id} aria-label={label} type="number" inputMode="decimal" min="0" step={memory.unit === "GiB" ? "0.25" : "1"} value={memory.value} placeholder={optional ? "不填写" : "填写内存"} aria-invalid={!!memory.badInput} aria-describedby={memory.badInput ? `${id}-error` : undefined} onInput={(event) => onChange({ ...memory, value: event.currentTarget.value, badInput: event.currentTarget.validity.badInput })} onChange={(event) => onChange({ ...memory, value: event.target.value, badInput: event.target.validity?.badInput ?? false })} />
      <select className="mc-select" aria-label={`${label}单位`} value={memory.unit} onChange={(event) => onChange(changeMemoryUnit(memory, event.target.value as MemoryUnit))}>
        <option value="GiB">GiB</option><option value="MiB">MiB</option>
      </select>
    </div>
    {memory.badInput && <em id={`${id}-error`}>数字输入尚未完成，请输入有效数字{optional ? "；不填写时请完全清空" : ""}。</em>}
  </div>;
}

export default function ServerLaunchTool({ version }: { version: string }) {
  const recommendedJava = recommendedJavaForVersion(version);
  const [javaChoice, setJavaChoice] = useState("auto");
  const [executableChoice, setExecutableChoice] = useState("java");
  const [customExecutable, setCustomExecutable] = useState("");
  const [jar, setJar] = useState("server.jar");
  const [platform, setPlatform] = useState<ServerLaunchInput["platform"]>("cmd");
  const [minMemory, setMinMemory] = useState<Memory>({ value: "1", unit: "GiB" });
  const [maxMemory, setMaxMemory] = useState<Memory>({ value: "2", unit: "GiB" });
  const [physicalMemory, setPhysicalMemory] = useState<Memory>({ value: "", unit: "GiB" });
  const [collector, setCollector] = useState<ServerLaunchInput["collector"]>("default");
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [numericValues, setNumericValues] = useState<Record<string, number | string | undefined>>({});
  const [nogui, setNogui] = useState(true);
  const [outputView, setOutputView] = useState<"command" | "script">("command");
  const [downloadedScript, setDownloadedScript] = useState("");
  const [downloadError, setDownloadError] = useState<{ signature: string; message: string } | null>(null);
  const downloadUrls = useRef(new Map<string, number>());
  const { copy, copyLabel } = useCopyFeedback();
  const javaVersion = javaChoice === "auto" ? recommendedJava ?? 0 : Number(javaChoice);
  const flags = SERVER_JVM_FLAGS;
  const result = makeServerLaunch({
    version,
    javaVersion,
    executable: executableChoice === "java" ? "java" : customExecutable,
    jar,
    platform,
    minMemoryMiB: memoryMiB(minMemory),
    maxMemoryMiB: memoryMiB(maxMemory),
    physicalMemoryMiB: physicalMemory.badInput || physicalMemory.value.trim() ? memoryMiB(physicalMemory) : undefined,
    collector,
    selectedFlags,
    numericValues,
    nogui,
  });
  const valid = !result.errors.length && !!result.command && !!result.script;
  const filename = `start${result.extension}`;
  const output = outputView === "script" ? result.script : result.command;
  const signature = JSON.stringify([filename, result.script]);
  const unavailableSelected = flags.filter((flag) => selectedFlags.includes(flag.id) && flagSupportReason(flag, javaVersion, collector));

  useEffect(() => {
    const urls = downloadUrls.current;
    return () => {
      for (const [url, timer] of urls) { window.clearTimeout(timer); URL.revokeObjectURL(url); }
      urls.clear();
    };
  }, []);

  function toggleFlag(flag: ServerJvmFlag, checked: boolean) {
    setSelectedFlags((previous) => checked ? [...new Set([...previous, flag.id])] : previous.filter((id) => id !== flag.id));
    if (checked && flag.kind === "number") {
      setNumericValues((previous) => previous[flag.id] === undefined ? { ...previous, [flag.id]: flag.defaultValue ?? "" } : previous);
    }
  }

  function download() {
    if (!valid) return;
    setDownloadedScript(""); setDownloadError(null);
    let url = "", link: HTMLAnchorElement | undefined;
    try {
      const bom = result.extension === ".ps1" && !result.script.startsWith("\uFEFF") ? "\uFEFF" : "";
      url = URL.createObjectURL(new Blob([bom, result.script], { type: "text/plain;charset=utf-8" }));
      link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      const createdUrl = url;
      downloadUrls.current.set(createdUrl, window.setTimeout(() => { URL.revokeObjectURL(createdUrl); downloadUrls.current.delete(createdUrl); }, 60_000));
      setDownloadedScript(signature);
    } catch {
      if (url) URL.revokeObjectURL(url);
      setDownloadError({ signature, message: "启动脚本下载失败，请重试或复制脚本后手动保存。" });
    } finally { link?.remove(); }
  }

  return <section className="mc-section mc-launch-section" id="launch" aria-labelledby="launch-heading">
    <div className="mc-section-header">
      <div><span className="mc-overline">16 / SERVER LAUNCH</span><h2 id="launch-heading">开服命令<span>工作台</span></h2></div>
      <span className="mc-section-mark" aria-hidden="true">▣</span>
    </div>
    <p className="mc-section-description">配置 Java、内存和启动参数，生成能直接复制的命令与启动脚本。参数按需勾选，默认使用 JVM 自带设置；全部在浏览器内完成。</p>

    <div className="mc-form-panel mc-launch-config">
      <div className="mc-launch-panel-heading"><div className="mc-form-section-label"><span>01</span> 基础配置</div><span className="mc-launch-version">MC {version} · Java {javaVersion || "待选择"}</span></div>
      <div className="mc-launch-config-grid">
        <label className="mc-field"><span>Java 版本 <small>RUNTIME</small></span><select aria-label="Java 版本" className="mc-select" value={javaChoice} onChange={(event) => setJavaChoice(event.target.value)}><option value="auto">跟随游戏版本{recommendedJava ? ` · Java ${recommendedJava}` : " · 未知版本"}</option>{javaChoices.map((major) => <option key={major} value={major}>Java {major}</option>)}</select></label>
        <label className="mc-field"><span>命令环境 <small>SHELL</small></span><select aria-label="命令环境" className="mc-select" value={platform} onChange={(event) => setPlatform(event.target.value as ServerLaunchInput["platform"])}>{platforms.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
        <label className="mc-field"><span>Java 执行文件</span><select aria-label="Java 执行文件" className="mc-select" value={executableChoice} onChange={(event) => setExecutableChoice(event.target.value)}><option value="java">java · 使用系统 PATH</option><option value="custom">指定 Java 完整路径</option></select></label>
        <label className="mc-field"><span>核心 JAR 文件名</span><input aria-label="核心 JAR 文件名" value={jar} maxLength={240} onChange={(event) => setJar(event.target.value)} spellCheck={false} placeholder="server.jar" autoComplete="off" /></label>
        {executableChoice === "custom" && <label className="mc-field mc-launch-wide"><span>Java 完整路径 <small>不要手动添加引号</small></span><input aria-label="Java 完整路径" value={customExecutable} maxLength={1000} onChange={(event) => setCustomExecutable(event.target.value)} spellCheck={false} autoComplete="off" placeholder={platform === "sh" ? "/usr/lib/jvm/java-21/bin/java" : "C:\\Program Files\\Java\\jdk-21\\bin\\java.exe"} /></label>}
        <MemoryField id="mc-launch-min-memory" label="起始内存 · Xms" memory={minMemory} onChange={setMinMemory} />
        <MemoryField id="mc-launch-max-memory" label="最大内存 · Xmx" memory={maxMemory} onChange={setMaxMemory} />
        <MemoryField id="mc-launch-physical-memory" label="机器总内存" memory={physicalMemory} onChange={setPhysicalMemory} optional />
        <label className="mc-launch-nogui"><input type="checkbox" checked={nogui} onChange={(event) => setNogui(event.target.checked)} /><span><strong>关闭服务器图形界面</strong><code>nogui</code><small>启动参数，通常建议启用</small></span></label>
      </div>
      <p className="mc-field-hint">MC {version}{recommendedJava ? ` 的原版运行时参考为 Java ${recommendedJava}` : " 尚未提供原版 Java 参考"}。第三方核心 / 整合包可能要求不同 Java；请按发行版说明核对。所选 Java 版本需与实际执行文件一致；网页无法检查本机安装。1 GiB = 1024 MiB；Xmx 只限制 Java 堆，请为系统、插件和堆外内存留出空间。</p>
    </div>

    <div className="mc-form-panel mc-launch-tuning">
      <div className="mc-launch-panel-heading"><div className="mc-form-section-label"><span>02</span> 启动参数</div><div className="mc-launch-selection-count"><span>已选 {selectedFlags.length} / {flags.length}</span><button type="button" disabled={!selectedFlags.length} onClick={() => setSelectedFlags([])}>清空参数</button></div></div>
      <fieldset className="mc-launch-gc"><legend>垃圾收集器 <small>只选一种</small></legend><div className="mc-launch-gc-grid">{SERVER_GC_OPTIONS.map((option) => {
        const unavailable = option.javaMin !== undefined && javaVersion < option.javaMin;
        return <label className={`mc-launch-gc-option${collector === option.id ? " is-selected" : ""}${unavailable ? " is-unavailable" : ""}${unavailable && collector === option.id ? " is-invalid" : ""}`} key={option.id}>
          <input type="radio" name="mc-launch-collector" value={option.id} checked={collector === option.id} disabled={unavailable} onChange={() => setCollector(option.id)} />
          <span><strong>{option.label}</strong><code>{collectorFlags[option.id]}</code><small>{option.description}</small>{unavailable && <small className="mc-launch-gc-unsupported">需要 Java {option.javaMin} 或更新版本</small>}</span>
        </label>;
      })}</div></fieldset>
      <p className="mc-launch-tuning-note">以下是可选的 JVM 参数，不代表勾得越多越快。带数值的参数选中后可编辑；切换 Java 或收集器后，不支持的选择需要取消。</p>
      {unavailableSelected.length > 0 && <div className="mc-launch-notice mc-launch-error" role="alert">有 {unavailableSelected.length} 个已选参数与当前配置不兼容。请取消卡片中的这些选择，或切换回支持它们的 Java / 收集器。</div>}
      <div className="mc-launch-groups">{SERVER_JVM_GROUPS.map((group) => <fieldset className="mc-launch-group" key={group.id}>
        <legend>{group.label}<small>{flags.filter((flag) => flag.group === group.id).length} 项</small></legend>
        <div className="mc-launch-flags-grid">{flags.filter((flag) => flag.group === group.id).map((flag) => {
          const checked = selectedFlags.includes(flag.id);
          const reason = flagSupportReason(flag, javaVersion, collector);
          const unavailable = !!reason;
          const value = numericValues[flag.id] ?? flag.defaultValue;
          return <article data-jvm-flag={flag.id} className={`mc-launch-flag${checked ? " is-selected" : ""}${unavailable ? " is-unavailable" : ""}${checked && unavailable ? " is-invalid" : ""}`} key={flag.id}>
            <label className="mc-launch-flag-select"><input type="checkbox" checked={checked} disabled={unavailable} onChange={(event) => toggleFlag(flag, event.target.checked)} /><span><strong>{flag.label}</strong><code>{formatServerFlag(flag, value === "" ? "数值" : value, javaVersion)}</code></span></label>
            <p>{flag.description}</p>
            <small className="mc-launch-risk">注意：{flag.risk ?? "会改变 JVM 行为，建议先保留默认并根据实际运行情况调整。"}</small>
            {flag.experimental && <small className="mc-launch-risk">实验参数 · 启动时自动添加解锁参数</small>}
            {checked && flag.kind === "number" && <label className="mc-launch-flag-value"><span>参数值{flag.unit ? ` · ${flag.unit}` : ""}{flag.min !== undefined && flag.max !== undefined ? ` · ${flag.min}–${flag.max}` : ""}</span><input aria-label={`${flag.label}参数值`} type="number" min={flag.min} max={flag.max} step="1" value={value ?? ""} disabled={unavailable} onChange={(event) => setNumericValues((previous) => ({ ...previous, [flag.id]: event.target.value }))} /></label>}
            {unavailable && <div className="mc-launch-flag-unsupported"><span>{reason}</span>{checked && <button type="button" aria-label={`取消${flag.label}参数`} onClick={() => toggleFlag(flag, false)}>取消选择</button>}</div>}
          </article>;
        })}</div>
      </fieldset>)}</div>
    </div>

    <div className="mc-output-panel mc-launch-output" aria-labelledby="mc-launch-output-heading">
      <div className="mc-output-top"><span id="mc-launch-output-heading"><i /> LAUNCH OUTPUT</span><span>{platforms.find((entry) => entry.id === platform)?.hint}</span></div>
      <div className="mc-launch-output-toolbar"><div className="mc-launch-output-tabs" role="group" aria-label="输出类型"><button type="button" className={outputView === "command" ? "active" : ""} aria-pressed={outputView === "command"} onClick={() => setOutputView("command")}>启动命令</button><button type="button" className={outputView === "script" ? "active" : ""} aria-pressed={outputView === "script"} onClick={() => setOutputView("script")}>{filename}</button></div><span>{valid ? `${result.activeFlags.length} 个 JVM 参数` : "待修正配置"}</span></div>
      {result.errors.length > 0 && <div className="mc-launch-output-errors" role="alert">{result.errors.map((error) => <p key={error}>⚠ {error}</p>)}</div>}
      <pre className="mc-code-output mc-launch-code"><code>{output || "请修正上方配置后生成启动命令。"}</code></pre>
      <div className="mc-launch-output-actions"><button type="button" className="mc-copy-button" disabled={!valid} onClick={() => copy(output)}>{copyLabel(output, outputView === "script" ? "复制启动脚本 ↗" : "复制启动命令 ↗")}</button><button type="button" className="mc-copy-button mc-launch-download" disabled={!valid} onClick={download}>{downloadedScript === signature && valid ? "脚本已准备下载 ✓" : `下载 ${filename} ↓`}</button></div>
      {downloadError?.signature === signature && <p className="mc-output-warning" role="alert">{downloadError.message}</p>}
      {result.warnings.map((warning) => <p className="mc-output-warning" key={warning}>⚠ {warning}</p>)}
      <div className="mc-launch-use-notes"><p><strong>运行位置</strong> 将启动脚本放在核心 JAR 同一目录。{platform === "cmd" ? "Windows 中双击 .bat 即可运行。" : platform === "powershell" ? "在 PowerShell 中运行 .\\start.ps1；本机执行策略可能限制脚本。" : "在终端进入该目录，执行 sh start.sh。"}</p><p><strong>核心差异</strong> 适用于能以 java -jar 启动的核心。较新的 Forge 通常使用安装器生成的 run.bat / run.sh 与 @args 文件，请修改其 user_jvm_args.txt；这里的命令不能代替 Forge 自带启动流程。</p><p><strong>首次启动</strong> 按核心说明完成配置并阅读、确认 EULA。网页仅生成文本，不会连接或启动服务器。</p></div>
    </div>
  </section>;
}
