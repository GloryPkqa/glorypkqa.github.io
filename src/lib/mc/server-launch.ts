/** HotSpot JVM options, checked against Oracle Java 8 / 25 documentation.
 * No arbitrary extra arguments: every emitted option comes from this catalog.
 * Java 8 update requirements are displayed separately from the major version.
 */
export type ServerPlatform = "cmd" | "powershell" | "sh";
export type ServerCollector = "default" | "g1" | "zgc" | "parallel" | "serial";
export type ServerJvmFlag = {
  id: string; label: string; description: string; group: string;
  kind: "boolean" | "number"; defaultValue?: number; min?: number; max?: number;
  javaMin?: number; javaMax?: number; collector?: "g1" | "zgc";
  collectors?: ServerCollector[]; experimental?: true; risk?: string;
  unit?: string; argument?: string; java8Update?: number;
};
export type ServerLaunchInput = {
  version: string; javaVersion: number; executable: string; jar: string;
  platform: ServerPlatform; minMemoryMiB: number | string; maxMemoryMiB: number | string;
  physicalMemoryMiB?: number | string; collector: ServerCollector;
  selectedFlags: string[]; numericValues: Record<string, number | string | undefined>; nogui: boolean;
};
export type ServerLaunchResult = {
  command: string; script: string; extension: ".bat" | ".ps1" | ".sh";
  errors: string[]; warnings: string[]; activeFlags: string[]; javaArgs: string[];
};

const JAVA_RUNTIME: Record<string, number> = {
  "26.1": 25, "1.21.8": 21, "1.21.5": 21, "1.20.6": 21,
  "1.20.4": 17, "1.17": 16, "1.16.5": 8, "1.12.2": 8, "1.8.9": 8,
};
export function recommendedJavaForVersion(version: string): number | null {
  return Object.hasOwn(JAVA_RUNTIME, version) ? JAVA_RUNTIME[version] : null;
}
export const SERVER_GC_OPTIONS: { id: ServerCollector; label: string; description: string; javaMin: number }[] = [
  { id: "default", label: "JVM 默认", description: "由当前 Java 根据机器配置选择。初次开服可保持默认。", javaMin: 8 },
  { id: "g1", label: "G1 GC", description: "平衡停顿时间与吞吐量，可配置下方 G1 参数。", javaMin: 8 },
  { id: "zgc", label: "ZGC", description: "优先降低停顿，通常需要更多 CPU 与内存余量。本站支持 Java 17 及以上。", javaMin: 17 },
  { id: "parallel", label: "Parallel GC", description: "偏重吞吐量，垃圾回收停顿可能更长。", javaMin: 8 },
  { id: "serial", label: "Serial GC", description: "使用单线程回收，更适合小堆或有限 CPU。", javaMin: 8 },
];
export const SERVER_JVM_GROUPS = [
  { id: "common", label: "常用与内存" }, { id: "g1", label: "G1 精细调整" },
  { id: "zgc", label: "ZGC 调整" }, { id: "cpu", label: "CPU 与线程" },
  { id: "diagnostics", label: "诊断与日志" },
];
const n = (id: string, label: string, description: string, group: string, defaultValue: number, min: number, max: number, extra: Partial<ServerJvmFlag> = {}): ServerJvmFlag => ({ id, label, description, group, kind: "number", defaultValue, min, max, ...extra });
const b = (id: string, label: string, description: string, group: string, extra: Partial<ServerJvmFlag> = {}): ServerJvmFlag => ({ id, label, description, group, kind: "boolean", ...extra });
export const SERVER_JVM_FLAGS: ServerJvmFlag[] = [
  b("AlwaysPreTouch", "启动时预触碰内存", "提前触碰已提交的堆内存页，减少运行中首次访问内存页的开销。", "common", { risk: "可能明显增加启动耗时和实际内存占用；不等于保证流畅。" }),
  b("DisableExplicitGC", "忽略显式 GC", "忽略插件或库通过 System.gc() 发出的回收请求，JVM 自身回收仍正常。", "common", { risk: "某些依赖显式回收的库可能增加内存压力。与显式并发 GC 互斥。" }),
  b("ExplicitGCInvokesConcurrent", "显式 GC 改为并发回收", "让 System.gc() 请求使用 G1 并发回收。", "common", { collector: "g1", risk: "与忽略显式 GC 互斥。" }),
  b("UseStringDeduplication", "相同字符串去重", "让 G1 尝试共享相同字符串的数据，可能节省内存。", "common", { collector: "g1", java8Update: 20, risk: "去重本身消耗 CPU；Java 8 需 8u20 或更新。" }),
  n("MaxMetaspaceSize", "元空间上限", "限制类元数据的内存，数值单位为 MiB。", "common", 512, 16, 1048576, { unit: "MiB", risk: "过小会触发 Metaspace 内存不足；模组服通常应保持 JVM 默认。" }),
  n("ReservedCodeCacheSize", "代码缓存上限", "为编译后的机器代码预留缓存，数值单位为 MiB。", "common", 256, 32, 1024, { unit: "MiB", risk: "预留过大会增加内存需求；过小可能令代码缓存耗尽。" }),
  n("MaxGCPauseMillis", "目标 GC 停顿", "设置 G1 的停顿目标，单位为毫秒；这是目标而非硬性保证。", "g1", 200, 1, 60000, { collector: "g1", unit: "ms", risk: "过低可能牺牲吞吐量。" }),
  n("InitiatingHeapOccupancyPercent", "并发标记初始阈值", "G1 以此占用百分比开始并发标记；自适应 IHOP 开启时主要影响初始周期。", "g1", 45, 0, 100, { collector: "g1", unit: "%" }),
  n("G1ReservePercent", "G1 预留比例", "预留部分堆空间，减少对象晋升失败的风险。", "g1", 10, 0, 50, { collector: "g1", unit: "%", risk: "增大预留比例会减少可用堆空间。" }),
  n("G1HeapWastePercent", "可容忍空闲比例", "可回收空间不足该比例时，G1 不启动混合回收。", "g1", 5, 0, 100, { collector: "g1", unit: "%" }),
  n("G1HeapRegionSize", "G1 分区大小", "设置分区大小，仅接受 1、2、4、8、16、32 MiB。", "g1", 4, 1, 32, { collector: "g1", unit: "MiB", risk: "通常由 JVM 自动选择更合适；不应超过最大堆内存。" }),
  n("G1NewSizePercent", "年轻代最小比例", "G1 年轻代最小比例。需要实验性参数解锁，生成时自动加在前面。", "g1", 5, 0, 100, { collector: "g1", experimental: true, unit: "%" }),
  n("G1MaxNewSizePercent", "年轻代最大比例", "G1 年轻代最大比例。需要实验性参数解锁，生成时自动加在前面。", "g1", 60, 0, 100, { collector: "g1", experimental: true, unit: "%" }),
  n("G1MixedGCLiveThresholdPercent", "混合回收存活阈值", "只考虑存活对象比例低于该阈值的旧分区。", "g1", 85, 0, 100, { collector: "g1", experimental: true, unit: "%" }),
  n("G1MixedGCCountTarget", "混合回收目标次数", "一次并发标记后，分批回收旧分区的目标次数。", "g1", 8, 1, 1024, { collector: "g1" }),
  n("G1OldCSetRegionThresholdPercent", "单次旧分区比例上限", "限制混合回收中可收集的旧分区比例。", "g1", 10, 0, 100, { collector: "g1", experimental: true, unit: "%" }),
  n("G1RSetUpdatingPauseTimePercent", "记忆集更新停顿比例", "限制 G1 在回收停顿中用于更新记忆集的时间比例。", "g1", 10, 0, 100, { collector: "g1", unit: "%" }),
  b("ParallelRefProcEnabled", "并行处理引用", "G1 回收时并行处理引用。现代 JVM 可能已自动启用。", "g1", { collector: "g1" }),
  b("ZGenerational", "启用分代 ZGC", "Java 21 至 23 使用分代 ZGC；Java 23 默认已开启，24 起该选项已废弃并被忽略。", "zgc", { collector: "zgc", javaMin: 21, javaMax: 23, risk: "Java 24 及以上只需选择 ZGC，不要再加这个选项。" }),
  b("ZUncommit", "归还空闲内存", "让 ZGC 将长时间空闲的堆内存归还给系统，默认通常已开启。", "zgc", { collector: "zgc", javaMin: 17, risk: "初始堆与最大堆相同时不能缩小到初始堆以下。" }),
  n("ZUncommitDelay", "空闲内存归还延迟", "ZGC 空闲内存保留的秒数，默认 300 秒。", "zgc", 300, 0, 86400, { collector: "zgc", javaMin: 17, unit: "s", risk: "过低会频繁提交与归还内存。" }),
  n("ZCollectionInterval", "回收间隔上限", "ZGC 两次回收的最大间隔，单位为秒；0 表示禁用该上限。", "zgc", 0, 0, 86400, { collector: "zgc", javaMin: 17, unit: "s" }),
  n("ZFragmentationLimit", "碎片比例上限", "ZGC 可容忍的堆碎片比例；更低会更积极压缩并消耗 CPU。", "zgc", 25, 0, 100, { collector: "zgc", javaMin: 17, unit: "%", risk: "不同 Java 版本默认值可能不同；这里是可编辑的示例值。" }),
  b("ZProactive", "主动回收", "让 ZGC 在预计影响较小时主动触发回收，默认通常已开启。", "zgc", { collector: "zgc", javaMin: 17 }),
  n("ActiveProcessorCount", "JVM 可用 CPU 数", "覆盖 JVM 用于计算线程池的逻辑 CPU 数量；不会给服务器绑定 CPU。", "cpu", 4, 1, 1024, { javaMin: 10, risk: "按实际可用 CPU 填写；过大会放大 GC / 线程池及堆外内存，甚至导致启动失败，过小会降低性能。Java 8u191 也支持，但本站大版本选项从 Java 10 起开放。" }),
  n("ParallelGCThreads", "并行 GC 线程数", "设置并行垃圾回收工作线程数量，通常交给 JVM 自动计算。", "cpu", 4, 1, 1024, { collectors: ["g1", "parallel", "zgc"], risk: "过多线程会争抢 CPU；Serial GC 不使用此设置。" }),
  n("ConcGCThreads", "并发 GC 线程数", "设置 G1 或 ZGC 并发回收线程数量。", "cpu", 1, 1, 1024, { collectors: ["g1", "zgc"], risk: "G1 的并发线程数不能超过并行 GC 线程数。" }),
  b("HeapDumpOnOutOfMemoryError", "内存不足时保存堆快照", "内存不足时在工作目录保存堆快照，供后续排查。", "diagnostics", { risk: "快照可能非常大并包含服务器运行数据，请预留磁盘空间。" }),
  b("ExitOnOutOfMemoryError", "内存不足时退出", "第一次内存不足时退出 JVM，便于外部管理工具重启。本站脚本不会自动重启。", "diagnostics", { java8Update: 92, risk: "Java 8 需 8u92 或更新；退出可能中断未完成的保存。" }),
  b("PrintCommandLineFlags", "输出最终启动参数", "启动时输出 JVM 采用的主要参数，方便确认配置。", "diagnostics"),
  b("PrintFlagsFinal", "输出完整 JVM 参数", "启动时列出全部 JVM 参数，适合排查，输出会很多。", "diagnostics"),
  b("GCLog", "将 GC 日志写入文件", "Java 9 及以上将 GC 日志写入工作目录 gc.log，并轮换文件。", "diagnostics", { javaMin: 9, argument: "-Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=5,filesize=10M", risk: "需要工作目录可写；日志总量约 50 MiB。" }),
  b("PrintGCDetails", "输出详细 GC 日志（Java 8）", "Java 8 在控制台输出详细垃圾回收日志。", "diagnostics", { javaMax: 8 }),
  b("PrintGCDateStamps", "GC 日志加时间（Java 8）", "为 Java 8 的 GC 日志添加日期，需同时勾选详细 GC 日志。", "diagnostics", { javaMax: 8 }),
];

export function flagSupportReason(flag: ServerJvmFlag, javaVersion: number, collector: ServerCollector): string | null {
  if (flag.javaMin && javaVersion < flag.javaMin) return `需要 Java ${flag.javaMin} 或更新版本`;
  if (flag.javaMax && javaVersion > flag.javaMax) return flag.id === "ZGenerational" ? "Java 24 起该参数已废弃并被忽略；直接选择 ZGC 即可" : `仅支持 Java ${flag.javaMax} 或更旧版本`;
  if (flag.collector && collector !== flag.collector) return `请先选择 ${flag.collector === "g1" ? "G1" : "ZGC"} 回收器`;
  if (flag.collectors && !flag.collectors.includes(collector)) return `仅适用于 ${flag.collectors.map(c => c === "g1" ? "G1" : c === "zgc" ? "ZGC" : "Parallel").join(" / ")} 回收器，请明确选择`;
  return null;
}

export function formatServerFlag(flag: ServerJvmFlag, value: number | string = flag.defaultValue ?? 0, javaVersion?: number): string {
  void javaVersion;
  return flag.argument ?? (flag.kind === "boolean" ? `-XX:+${flag.id}` : `-XX:${flag.id}=${value}${flag.unit === "MiB" ? "m" : ""}`);
}

function integer(value: number | string | undefined, minimum: number, maximum: number): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}
function pathError(value: string, platform: ServerPlatform, label: string): string | null {
  if (!value || value.trim() !== value) return `${label}不能为空，且不能带首尾空格；只填写路径，不加外层引号。`;
  if (/[\u0000-\u001f\u007f]/.test(value)) return `${label}不能包含换行或控制字符。`;
  if (value.length > 4096) return `${label}过长，请使用更短的路径。`;
  if (platform !== "sh" && /["<>|?*]/.test(value)) return `${label}含有 Windows 文件路径不支持的字符。`;
  if (platform === "cmd" && /[%!]/.test(value)) return `${label}含有 CMD 会展开的 % 或 !；请使用 PowerShell，或更改文件路径。`;
  return null;
}
function quote(value: string, platform: ServerPlatform): string {
  if (platform === "powershell") return `'${value.replace(/['\u2018\u2019]/g, char => char + char)}'`;
  if (platform === "sh") return `'${value.replace(/'/g, `'"'"'`)}'`;
  return `"${value.replace(/\\+$/, suffix => suffix + suffix)}"`;
}

export function makeServerLaunch(input: ServerLaunchInput): ServerLaunchResult {
  const errors: string[] = [], warnings: string[] = [], activeFlags: string[] = [];
  const extension = input.platform === "powershell" ? ".ps1" : input.platform === "sh" ? ".sh" : ".bat";
  const result: ServerLaunchResult = { command: "", script: "", extension, errors, warnings, activeFlags, javaArgs: [] };
  const recommended = recommendedJavaForVersion(input.version);
  if (!recommended) errors.push("请选择本站支持的 Minecraft 版本。 ");
  if (!Number.isInteger(input.javaVersion) || input.javaVersion < 8 || input.javaVersion > 25) errors.push("本站支持生成 Java 8 至 25 的启动参数，请填写完整的大版本号。 ");
  else if (recommended && recommended >= 16 && input.javaVersion < recommended) errors.push(`Minecraft ${input.version} 需要 Java ${recommended} 或更新版本。`);
  else if (recommended && input.javaVersion !== recommended) warnings.push(`Minecraft ${input.version} 的官方运行时 / 推荐 Java 为 ${recommended}；其他 Java 版本需要核实服务端核心和模组兼容性。`);
  if (input.javaVersion === 8) warnings.push("Java 8 参数按维护更新版的 HotSpot 设计，请使用较新的 64 位 Java 8；不同更新号支持的参数可能不同。 ");
  if (!["cmd", "powershell", "sh"].includes(input.platform)) errors.push("请选择 CMD、PowerShell 或 Shell 平台。 ");
  const gc = SERVER_GC_OPTIONS.find(option => option.id === input.collector);
  if (!gc) errors.push("请选择一个有效的垃圾回收器。 ");
  else if (input.javaVersion < gc.javaMin) errors.push(`${gc.label} 在本站需要 Java ${gc.javaMin} 或更新版本。`);
  for (const [label, value] of [["Java 路径", input.executable], ["服务端 JAR 路径", input.jar]]) {
    const issue = typeof value === "string" ? pathError(value, input.platform, label) : `${label}必须是文本。`;
    if (issue) errors.push(issue);
  }
  if (typeof input.jar === "string" && !/\.jar$/i.test(input.jar)) errors.push("服务端文件应为可执行 .jar；现代 Forge / NeoForge 的 args.txt 请使用安装器生成的启动脚本。 ");
  if (typeof input.jar === "string" && (input.platform === "sh" ? input.jar.includes(":") : input.jar.includes(";"))) errors.push(`JAR 路径不能包含${input.platform === "sh" ? "冒号（:）" : "分号（;）"}，Java 会将它当作类路径分隔符，可能找不到主类；请更改文件名或所在目录。`);
  if (typeof input.jar === "string" && input.jar.startsWith("@")) errors.push("JAR 路径不能直接以 @ 开头，Java 会将其当作参数文件；请改用 ./@文件.jar 或完整路径。 ");
  if (typeof input.executable === "string" && /[\\/]$|\.(?:bat|cmd|ps1|sh)$/i.test(input.executable)) errors.push("Java 路径应指向 java 可执行文件，不能是文件夹或另一份启动脚本。 ");
  const min = integer(input.minMemoryMiB, 16, 16777216), max = integer(input.maxMemoryMiB, 16, 16777216);
  if (min === null || max === null) errors.push("初始与最大堆内存需填写 16 至 16777216 MiB 的完整整数。 ");
  else if (min > max) errors.push("初始堆内存不能超过最大堆内存。 ");
  else if (max < 512) warnings.push("最大堆内存少于 512 MiB，Minecraft 服务端可能无法正常运行。 ");
  const hasPhysical = input.physicalMemoryMiB !== undefined && input.physicalMemoryMiB !== "";
  const physical = hasPhysical ? integer(input.physicalMemoryMiB, 16, 16777216) : null;
  if (hasPhysical && physical === null) errors.push("总物理内存需填写完整的正整数 MiB，或留空。 ");
  else if (physical !== null && max !== null && max >= physical) warnings.push("最大堆已达到或超过总物理内存，可能导致内存不足；系统、JVM 堆外内存和其他程序还需要空间。 ");
  else if (physical !== null && max !== null && (max > physical * 0.75 || physical - max < 1024)) warnings.push("请为系统、JVM 堆外内存和其他程序留出空间；当前内存分配余量较小。 ");
  const selected = new Set(Array.isArray(input.selectedFlags) ? input.selectedFlags : []);
  if (!Array.isArray(input.selectedFlags)) errors.push("参数选项格式无效，请重新选择。 ");
  if (selected.size !== input.selectedFlags?.length) warnings.push("重复参数已合并，仅生成一次。 ");
  const values = new Map<string, number>();
  for (const id of selected) {
    const flag = SERVER_JVM_FLAGS.find(option => option.id === id);
    if (!flag) { errors.push(`不支持的 JVM 参数：${String(id)}。`); continue; }
    const reason = flagSupportReason(flag, input.javaVersion, input.collector);
    if (reason) errors.push(`${flag.label}：${reason}。`);
    if (flag.kind === "number") {
      const value = integer(input.numericValues?.[id] ?? flag.defaultValue, flag.min!, flag.max!);
      if (value === null) errors.push(`${flag.label}需填写 ${flag.min} 至 ${flag.max} 的完整整数${flag.unit ? `（${flag.unit}）` : ""}。`);
      else values.set(id, value);
    }
    if (input.javaVersion === 8 && flag.java8Update) warnings.push(`${flag.label}需要 Java 8u${flag.java8Update} 或更新的 Java 8 更新版；仅知道大版本 8 无法确认兼容。`);
  }
  if (selected.has("DisableExplicitGC") && selected.has("ExplicitGCInvokesConcurrent")) errors.push("忽略显式 GC 与显式并发 GC 不能同时选择。 ");
  if (selected.has("PrintGCDateStamps") && !selected.has("PrintGCDetails")) errors.push("GC 日志时间戳需要同时勾选详细 GC 日志。 ");
  if (values.has("G1HeapRegionSize")) {
    const region = values.get("G1HeapRegionSize")!;
    if (![1, 2, 4, 8, 16, 32].includes(region)) errors.push("G1 分区大小只能是 1、2、4、8、16、32 MiB。 ");
    if (max !== null && region > max) errors.push("G1 分区大小不能超过最大堆内存。 ");
  }
  if (selected.has("G1NewSizePercent") || selected.has("G1MaxNewSizePercent")) {
    if ((values.get("G1NewSizePercent") ?? 5) > (values.get("G1MaxNewSizePercent") ?? 60)) errors.push("G1 年轻代最小比例不能超过最大比例；未勾选的一端使用 JVM 默认 5% / 60%。 ");
  }
  if (input.collector === "g1" && values.has("ConcGCThreads")) {
    const parallel = values.get("ParallelGCThreads");
    if (parallel !== undefined && values.get("ConcGCThreads")! > parallel) errors.push("G1 并发 GC 线程数不能超过并行 GC 线程数。 ");
    else if (parallel === undefined) errors.push("手动设置 G1 并发线程数时，请同时设置并行 GC 线程数，以确认两者的依赖关系。 ");
  }
  if (input.collector === "zgc" && min !== null && min === max && (selected.has("ZUncommit") || selected.has("ZUncommitDelay"))) warnings.push("初始堆与最大堆相同，ZGC 无法将内存缩小到初始堆以下，空闲内存归还设置不会降低堆占用。 ");
  if (selected.has("ZUncommitDelay") && !selected.has("ZUncommit")) warnings.push("空闲内存归还延迟依赖 ZGC 的 ZUncommit；当前 Java 通常默认开启，请确认运行时配置。 ");
  if (errors.length) return result;
  activeFlags.push(`-Xms${min}m`, `-Xmx${max}m`);
  if (input.collector !== "default") activeFlags.push({ g1: "-XX:+UseG1GC", zgc: "-XX:+UseZGC", parallel: "-XX:+UseParallelGC", serial: "-XX:+UseSerialGC" }[input.collector]);
  if (SERVER_JVM_FLAGS.some(flag => flag.experimental && selected.has(flag.id))) {
    activeFlags.push("-XX:+UnlockExperimentalVMOptions");
    warnings.push("已自动把实验性参数解锁放在对应参数之前。实验性设置应先小规模验证。 ");
  }
  for (const flag of SERVER_JVM_FLAGS) {
    if (!selected.has(flag.id)) continue;
    activeFlags.push(formatServerFlag(flag, values.get(flag.id), input.javaVersion));
  }
  result.javaArgs = [...activeFlags, "-jar", input.jar, ...(input.nogui ? ["nogui"] : [])];
  const quotedArgs = [...activeFlags.map(flag => quote(flag, input.platform)), "-jar", quote(input.jar, input.platform), ...(input.nogui ? ["nogui"] : [])];
  result.command = `${input.platform === "powershell" ? "& " : ""}${quote(input.executable, input.platform)} ${quotedArgs.join(" ")}`;
  if (input.platform === "cmd" && result.command.length > 8191) {
    errors.push("CMD 启动命令超过 8191 字符，请缩短路径或减少参数。 ");
    result.command = ""; result.javaArgs = []; activeFlags.length = 0; return result;
  }
  if (input.platform === "cmd") result.script = ["@echo off", "setlocal DisableDelayedExpansion", "set \"ERRORLEVEL=\"", "chcp 65001 >nul", "pushd \"%~dp0\" || exit /b 1", result.command, "set \"MC_LAUNCH_EXIT=%ERRORLEVEL%\"", "popd", "exit /b %MC_LAUNCH_EXIT%", ""].join("\r\n");
  else if (input.platform === "powershell") result.script = ["$ErrorActionPreference = 'Stop'", "Set-Location -LiteralPath $PSScriptRoot", result.command, "exit $LASTEXITCODE", ""].join("\r\n");
  else result.script = ["#!/bin/sh", "case $0 in /*) mc_script=$0 ;; *) mc_script=./$0 ;; esac", "mc_dir=${mc_script%/*}", "[ -n \"$mc_dir\" ] || mc_dir=/", "CDPATH= cd -P \"$mc_dir\" || exit 1", `exec ${result.command}`, ""].join("\n");
  warnings.push("适用于能用 java -jar 启动的服务端 JAR；现代 Forge / NeoForge 应使用安装器生成的 args.txt 与启动脚本。 ");
  warnings.push(`JAR 所在目录也应避开${input.platform === "sh" ? "冒号（:）" : "分号（;）"}，否则 Java 可能找不到主类。`);
  return result;
}
