import { recommendedJavaForVersion } from "@/lib/mc/server-launch";

/** Planning heuristics, NOT measured capacity or an official hardware requirement.
 * Binary storage units: MiB / GiB. Network: decimal Mbps (1,000,000 bit/s).
 * Coefficients intentionally remain visible in the report and are versioned.
 */
export type SizingNumber = number | string;
export type ServerSizingInput = {
  version: string;
  core: "vanilla" | "plugin" | "modded" | "hybrid";
  gameplay: "survival" | "minigame" | "creative";
  concurrentPlayers: SizingNumber; totalPlayers: SizingNumber;
  modCount: SizingNumber; pluginCount: SizingNumber;
  extraLoad: "light" | "medium" | "heavy";
  redstone: "none" | "light" | "medium" | "heavy" | "extreme";
  spread: "together" | "normal" | "scattered";
  viewDistance: SizingNumber; simulationDistance: SizingNumber;
  exploration: "light" | "medium" | "heavy" | "extreme";
  pregeneration: "none" | "partial" | "full";
  worldCount: SizingNumber; dimensionCount: SizingNumber;
  cycleDays: SizingNumber; runningHoursPerDay: SizingNumber; playerHoursPerDay: SizingNumber;
  backupCopies: SizingNumber; backupIntervalHours: SizingNumber;
  backupLocation: "local" | "remote" | "both";
  resourcePackMiB: SizingNumber; resourcePackHosting: "external" | "same-server";
  networkQuality: "good" | "normal" | "poor";
  targetRegion: "local" | "domestic" | "cross-region";
  currentWorldGiB?: SizingNumber; dailyGrowthGiB?: SizingNumber;
  physicalMemoryGiB?: SizingNumber; uploadMbps?: SizingNumber;
  pregenRadiusBlocks?: SizingNumber; joinsPerHour?: SizingNumber; residentEntities?: SizingNumber;
  permanentChunks?: SizingNumber; otherServicesGiB?: SizingNumber;
};
export type ServerSizingBudget = {
  cpuThreads: number; heapGiB: number; ramGiB: number; storageGiB: number;
  uploadMbps: number; monthlyTrafficGiB: number;
};
export type ServerSizingReport = {
  modelVersion: string; version: string; javaVersion: number | null;
  minimum: ServerSizingBudget; recommended: ServerSizingBudget;
  confidence: "low" | "very-low";
  drivers: string[]; warnings: string[]; assumptions: string[]; steps: string[];
  summary: string; text: string; worldGiB: { low: number; high: number };
  loadedChunks: number; averagePlayers: number;
};
export const SERVER_SIZING_SOURCES = [
  { title: "Paper：视距、模拟距离与网络压缩", url: "https://docs.papermc.io/paper/reference/server-properties/" },
  { title: "Paper：JVM 与系统内存余量", url: "https://docs.papermc.io/paper/aikars-flags/" },
  { title: "Paper：性能分析", url: "https://docs.papermc.io/paper/profiling/" },
  { title: "spark：TPS 与 MSPT", url: "https://spark.lucko.me/docs/guides/TPS-and-MSPT" },
];
type Limit = { label: string; min: number; max: number; integer: boolean };
const limit = (label: string, min: number, max: number, integer = true): Limit => ({ label, min, max, integer });
export const SERVER_SIZING_LIMITS = {
  concurrentPlayers: limit("峰值同时在线人数", 1, 500), totalPlayers: limit("周目参与人数", 1, 100000),
  modCount: limit("服务端模组数量", 0, 2000), pluginCount: limit("插件数量", 0, 1000),
  viewDistance: limit("视距", 3, 32), simulationDistance: limit("模拟距离", 3, 32),
  worldCount: limit("世界组数", 1, 100), dimensionCount: limit("每组世界的维度数", 1, 100),
  cycleDays: limit("周目天数", 1, 3650), runningHoursPerDay: limit("每天开服小时", 0.5, 24, false),
  playerHoursPerDay: limit("每位玩家日均游戏小时", 0, 24, false),
  backupCopies: limit("保留完整备份份数", 0, 100), backupIntervalHours: limit("完整备份间隔小时", 1, 720, false),
  resourcePackMiB: limit("资源包大小 MiB", 0, 1024, false),
  currentWorldGiB: limit("现有所有世界总大小 GiB", 0, 1000000, false),
  dailyGrowthGiB: limit("实测世界每天增长 GiB", 0, 10000, false),
  physicalMemoryGiB: limit("现有机器总内存 GiB", 0.5, 4096, false),
  uploadMbps: limit("实测上行 Mbps", 0.01, 100000, false),
  pregenRadiusBlocks: limit("预生成方形区域半径（方块）", 0, 1000000),
  joinsPerHour: limit("峰值每小时入服次数", 0, 100000),
  residentEntities: limit("预计同时加载实体数", 0, 1000000),
  permanentChunks: limit("玩家附近之外的常加载区块数", 0, 1000000),
  otherServicesGiB: limit("其他服务预留内存 GiB", 0, 4096, false),
} satisfies Record<string, Limit>;
export const SIZE_LIMITS = SERVER_SIZING_LIMITS;
type NumericKey = keyof typeof SERVER_SIZING_LIMITS;
const optional: NumericKey[] = ["currentWorldGiB", "dailyGrowthGiB", "physicalMemoryGiB", "uploadMbps", "pregenRadiusBlocks", "joinsPerHour", "residentEntities", "permanentChunks", "otherServicesGiB"];
const ENUMS = {
  core: ["vanilla", "plugin", "modded", "hybrid"], gameplay: ["survival", "minigame", "creative"],
  extraLoad: ["light", "medium", "heavy"], redstone: ["none", "light", "medium", "heavy", "extreme"],
  spread: ["together", "normal", "scattered"], exploration: ["light", "medium", "heavy", "extreme"],
  pregeneration: ["none", "partial", "full"], backupLocation: ["local", "remote", "both"],
  resourcePackHosting: ["external", "same-server"], networkQuality: ["good", "normal", "poor"],
  targetRegion: ["local", "domestic", "cross-region"],
} as const;
const LABELS = {
  vanilla: "原版", plugin: "插件服", modded: "模组服", hybrid: "模组＋插件混合服",
  survival: "生存", minigame: "小游戏", creative: "创造 / 建筑",
  none: "无", light: "轻量", medium: "中等", heavy: "重度", extreme: "极重度",
  together: "集中活动", normal: "正常分散", scattered: "高度分散",
};
function numeric(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  // Decimal input only: reject JS hex, Infinity, whitespace-only, booleans and coercible objects.
  if (typeof value !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return undefined;
  const result = Number(value.trim()); return Number.isFinite(result) ? result : undefined;
}
function absent(value: unknown): boolean { return value === undefined || value === "" || (typeof value === "string" && value.trim() === ""); }
export function supportsSimulationDistance(version: string): boolean {
  return ["1.20.4", "1.20.6", "1.21.5", "1.21.8", "26.1"].includes(version);
}
function applicable(input: ServerSizingInput, key: NumericKey): boolean {
  if (key === "modCount") return input.core === "modded" || input.core === "hybrid";
  if (key === "pluginCount") return input.core === "plugin" || input.core === "hybrid";
  if (key === "simulationDistance") return supportsSimulationDistance(input.version);
  if (key === "backupIntervalHours") return numeric(input.backupCopies) !== 0;
  return true;
}
export function validateServerSizing(input: ServerSizingInput): { errors: string[]; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  if (!input || typeof input !== "object") return { errors: ["请填写配置问卷。"], fieldErrors: { form: "请填写配置问卷。" } };
  if (recommendedJavaForVersion(input.version) === null) fieldErrors.version = "请选择本站支持的游戏版本。";
  for (const [key, values] of Object.entries(ENUMS)) {
    if (!(values as readonly unknown[]).includes(input[key as keyof ServerSizingInput])) fieldErrors[key] = "请选择有效选项。";
  }
  for (const key of Object.keys(SERVER_SIZING_LIMITS) as NumericKey[]) {
    if (!applicable(input, key) || (optional.includes(key) && absent(input[key]))) continue;
    const value = numeric(input[key]); const spec = SERVER_SIZING_LIMITS[key];
    if (value === undefined || value < spec.min || value > spec.max || (spec.integer && !Number.isInteger(value))) {
      fieldErrors[key] = `${spec.label}请填写 ${spec.min}～${spec.max} 的${spec.integer ? "整数" : "数字"}。`;
    }
  }
  const peak = numeric(input.concurrentPlayers), total = numeric(input.totalPlayers);
  const hours = numeric(input.runningHoursPerDay), perPlayer = numeric(input.playerHoursPerDay);
  if (peak !== undefined && total !== undefined && peak > total) fieldErrors.totalPlayers = "周目参与人数不能少于峰值在线人数。";
  if (hours !== undefined && perPlayer !== undefined && perPlayer > hours) fieldErrors.playerHoursPerDay = "每位玩家日均游戏时长不能超过每天开服时长。";
  if (peak !== undefined && total !== undefined && hours !== undefined && perPlayer !== undefined && hours > 0 && total * perPlayer > peak * hours + 1e-9) {
    fieldErrors.playerHoursPerDay = "总玩家小时数超过峰值人数可容纳的时长，请调整人数或日均时长。";
  }
  return { errors: Object.values(fieldErrors), fieldErrors };
}
const up = (n: number, step = 1) => Math.ceil((n - 1e-10) / step) * step;
const rounded = (n: number, places = 1) => Number(n.toFixed(places));
const threadTier = (n: number) => [2, 4, 6, 8, 12, 16, 24, 32].find(value => value >= n) ?? up(n, 8);
export function estimateServerSizing(input: ServerSizingInput): { errors: string[]; fieldErrors: Record<string, string>; report: ServerSizingReport | null } {
  const validated = validateServerSizing(input);
  if (validated.errors.length) return { ...validated, report: null };
  const n = (key: NumericKey, fallback = 0): number => applicable(input, key) ? numeric(input[key]) ?? fallback : fallback;
  const peak = n("concurrentPlayers"), total = n("totalPlayers"), days = n("cycleDays"), hours = n("runningHoursPerDay");
  const playerHours = total * n("playerHoursPerDay");
  const averagePlayers = playerHours / hours;
  const modded = input.core === "modded" || input.core === "hybrid";
  const modCount = n("modCount"), pluginCount = n("pluginCount");
  const load = { light: 0.65, medium: 1, heavy: 1.7 }[input.extraLoad];
  // Command blocks / datapack scripts may be heavy even with zero plugins or mods.
  const extraHeap = { light: 0, medium: 0.25, heavy: 0.75 }[input.extraLoad];
  const extraCpu = { light: 0, medium: 0.5, heavy: 1.5 }[input.extraLoad];
  const redstone = { none: 1, light: 1.12, medium: 1.4, heavy: 1.9, extreme: 2.8 }[input.redstone];
  const exploration = { light: 1, medium: 1.3, heavy: 1.8, extreme: 2.5 }[input.exploration];
  const realtimeGeneration = { none: 1, partial: 0.65, full: 0.2 }[input.pregeneration];
  const view = n("viewDistance"), simulation = n("simulationDistance", view);
  // Separate player groups approximate chunk overlap; world count is storage, not always loaded chunks.
  const groups = input.spread === "together" ? Math.max(1, peak * 0.12) : input.spread === "normal" ? Math.max(1, peak * 0.4) : peak;
  const permanentChunks = n("permanentChunks");
  const loadedChunks = Math.ceil(groups * (2 * Math.max(view, simulation) + 1) ** 2 + permanentChunks);
  const tickChunks = groups * (2 * simulation + 1) ** 2 + permanentChunks;
  const entities = n("residentEntities", Math.ceil(peak * 30 * redstone));
  const baseHeap = { vanilla: 1.5, plugin: 2.5, modded: 4, hybrid: 5 }[input.core];
  const heapRaw = baseHeap + extraHeap + modCount * 0.016 * load + pluginCount * 0.025 * load + peak * 0.035
    + loadedChunks * (modded ? 0.0009 : 0.00045) + entities * 0.00016
    + Math.max(0, redstone - 1) * 0.65;
  const heapMin = up(Math.max(2, heapRaw));
  const heapRec = up(Math.max(heapMin + 1, heapRaw * 1.4));
  const totalRam = (heap: number) => up(heap + Math.max(1.5, heap * 0.2) + (input.core === "hybrid" ? 0.5 : 0) + n("otherServicesGiB"));
  const cpuScore = 1 + extraCpu + peak / 18 + tickChunks / 2500 + entities / 2500
    + modCount * load / 90 + pluginCount * load / 65 + (redstone - 1) * 3
    + (exploration - 1) * realtimeGeneration * (1 + peak / 20);
  const cpuMin = threadTier(Math.max(2, cpuScore * 0.75));
  const cpuRec = threadTier(Math.max(cpuMin + 1, cpuScore * 1.25));

  const dimensions = n("worldCount") * n("dimensionCount");
  const radius = n("pregenRadiusBlocks");
  const pregenChunks = input.pregeneration === "none" ? 0 : Math.ceil(2 * radius / 16) ** 2 * dimensions;
  const bytesLow = modded ? 80 * 1024 : 40 * 1024, bytesHigh = modded ? 300 * 1024 : 160 * 1024;
  const pregenLow = pregenChunks * bytesLow / 2 ** 30, pregenHigh = pregenChunks * bytesHigh / 2 ** 30;
  const activityGrowth = { light: 0.002, medium: 0.01, heavy: 0.035, extreme: 0.08 }[input.exploration]
    * playerHours * (modded ? 1.6 : 1) * (input.gameplay === "minigame" ? 0.2 : 1);
  const measuredGrowth = numeric(input.dailyGrowthGiB);
  const dailyLow = measuredGrowth ?? activityGrowth * 0.5;
  const dailyHigh = measuredGrowth ?? activityGrowth * 2;
  const initial = n("currentWorldGiB", dimensions * 0.08);
  // The area can already be included in measured world size. Take max, never add the same area twice.
  const worldLow = Math.max(initial, pregenLow) + dailyLow * days;
  const worldHigh = Math.max(initial, pregenHigh) + dailyHigh * days;
  const copies = n("backupCopies"), localCopies = input.backupLocation === "remote" ? 0 : copies;
  const serverFiles = (modded ? 8 : 3) + modCount * 0.01 + pluginCount * 0.01 + dimensions * 0.1
    + (input.resourcePackHosting === "same-server" ? n("resourcePackMiB") / 1024 : 0);
  const diskMin = up(Math.max(20, (serverFiles + worldLow * (1 + localCopies)) * 1.2), 10);
  const diskRec = up(Math.max(diskMin + 10, (serverFiles + worldHigh * (1 + localCopies)) * 1.3), 10);

  const perPlayerMbps = 0.08 * (view / 8) ** 1.1 * (1 + (exploration - 1) * 0.9)
    * (modded ? 1.25 : 1) * (input.gameplay === "minigame" ? 1.2 : 1);
  const gamePeak = peak * perPlayerMbps;
  const joins = n("joinsPerHour", Math.ceil(peak * 0.5));
  const selfHostedPack = input.resourcePackHosting === "same-server";
  const packMiB = selfHostedPack ? n("resourcePackMiB") : 0;
  const burstJoins = joins === 0 ? 0 : Math.min(peak, Math.max(1, Math.ceil(peak * 0.1), Math.ceil(joins / 60)));
  // Resource-pack burst: a 60s delivery target, not a protocol requirement.
  const packPeak = packMiB * 2 ** 20 * 8 / 1e6 * burstJoins / 60;
  const remoteBackups = copies > 0 && input.backupLocation !== "local";
  const backupInterval = n("backupIntervalHours", 24);
  const backupLowMbps = remoteBackups ? worldLow * 2 ** 30 * 8 / 1e6 / Math.min(3600, backupInterval * 3600) : 0;
  const backupHighMbps = remoteBackups ? worldHigh * 2 ** 30 * 8 / 1e6 / Math.min(3600, backupInterval * 3600) : 0;
  const minUpload = up(Math.max(3, (gamePeak + packPeak + backupLowMbps) * 1.2));
  const recUpload = up(Math.max(minUpload + 2, (gamePeak * 1.7 + packPeak + backupHighMbps) * 1.3), 5);
  const gameMonthly = averagePlayers * perPlayerMbps * hours * 3600 * 30 * 1e6 / 8 / 2 ** 30;
  const joinsMonthly = joins * hours * 30 * averagePlayers / peak;
  const packMonthly = joinsMonthly * packMiB / 1024;
  const backupMonthlyLow = remoteBackups ? worldLow * 24 / backupInterval * 30 : 0;
  const backupMonthlyHigh = remoteBackups ? worldHigh * 24 / backupInterval * 30 : 0;
  const trafficMin = up((gameMonthly + packMonthly + backupMonthlyLow) * 1.1, 10);
  const trafficRec = up(Math.max(trafficMin, (gameMonthly * 1.8 + packMonthly + backupMonthlyHigh) * 1.2), 10);
  const minimum = { cpuThreads: cpuMin, heapGiB: heapMin, ramGiB: totalRam(heapMin), storageGiB: diskMin, uploadMbps: minUpload, monthlyTrafficGiB: trafficMin };
  const recommended = { cpuThreads: cpuRec, heapGiB: heapRec, ramGiB: totalRam(heapRec), storageGiB: diskRec, uploadMbps: recUpload, monthlyTrafficGiB: trafficRec };
  // These boundaries describe this heuristic model's scope, not official server limits.
  const outsideStorageNetworkScope = diskRec > 4096 || dimensions > 16 || recUpload > 1000;
  const outsideModelScope = peak > 100 || input.redstone === "extreme" || modCount > 250 || cpuRec > 16 || heapRec > 32 || outsideStorageNetworkScope;
  const warnings: string[] = ["最低起步和推荐均为本站启发式预算，不是官方最低配置或 20 TPS 保证。CPU 线程数只是预留预算，优先高单核性能与稳定独享资源；线程加倍不会使主线程性能加倍。"];
  if (input.core !== "vanilla") warnings.push(`Java ${recommendedJavaForVersion(input.version)} 只是此版本 Mojang 原版运行时参考；Paper 等第三方核心与模组加载器可能要求或推荐不同 Java 版本，请按实际发行版核对。`);
  if (outsideModelScope) warnings.push("当前规模超出轻中型单实例估算范围：数字仅供规划，先做峰值压测，再考虑拆分世界 / 子服或专用方案。不要直接按线程数或大堆内存采购。") ;
  if (outsideStorageNetworkScope) warnings.push("存储、世界 / 维度或网络规模超出本站模型的起步范围（推荐磁盘超过 4 TiB、总维度超过 16 或推荐上行超过 1 Gbps）；这些是本站提示阈值，不是官方上限。采购前请实测世界增长、预生成耗时、备份上传与集中入服，并另核存储和网络架构。");
  if (input.core === "hybrid") warnings.push("混合核心的模组和插件兼容性无法由硬件解决；先验证整合包、核心与插件组合。") ;
  if (input.redstone === "heavy" || input.redstone === "extreme") warnings.push("生电机器的结构、常加载区块、实体堆积和卡服装置影响可能远超人数；未知区块加载器与机器数量需通过实测补充。") ;
  if (input.pregeneration !== "none" && radius === 0) warnings.push("选择了预生成但未给区域半径：已降低预计在线生成压力，尚未计入额外预生成空间。请补半径或填写已生成世界的总大小。") ;
  if (input.pregeneration === "full") warnings.push("全预生成只降低覆盖区域内的在线生成压力；边界外跑图、新维度与新世界仍会触发生成。预生成任务本身应在离线或低峰执行。") ;
  if (input.backupLocation === "remote" && copies > 0) warnings.push(`远程备份未加入本机 ${copies} 份保留副本；远端至少另预留约 ${up(worldHigh * copies)} GiB。报告将完整备份上行计入本机带宽与流量。`) ;
  if (copies === 0) warnings.push("未保留备份。正式开服前建议建立可恢复、与主机分离的备份。") ;
  if (input.networkQuality === "poor" || input.targetRegion === "cross-region") warnings.push("线路丢包、抖动、跨地区延迟不能靠增加 Mbps 修复；请让目标地区玩家实测连接质量。") ;
  if (simulation > view && supportsSimulationDistance(input.version)) warnings.push("模拟距离高于视距：按较大范围预留加载内存，建议核实核心的实际加载行为。") ;
  const physical = numeric(input.physicalMemoryGiB), upload = numeric(input.uploadMbps);
  if (physical !== undefined) warnings.push(physical < minimum.ramGiB ? `现有 ${physical} GiB 内存低于起步预算 ${minimum.ramGiB} GiB。` : physical < recommended.ramGiB ? `现有内存达到起步预算，尚未达到推荐 ${recommended.ramGiB} GiB。` : "现有内存达到推荐预算；仍需检查实际 JVM 与容器内存限制。");
  if (upload !== undefined) warnings.push(upload < minimum.uploadMbps ? `实测上行 ${upload} Mbps 低于起步预算 ${minimum.uploadMbps} Mbps。` : upload < recommended.uploadMbps ? `实测上行达到起步预算，尚未达到推荐 ${recommended.uploadMbps} Mbps。` : "实测上行达到推荐预算；仍需在多人跑图时检查抖动和丢包。");
  if (input.gameplay === "minigame") warnings.push("小游戏地图重置、回合开始集中入服和区块同步会形成突发负载；本报告只覆盖一个游戏实例，代理、大厅、数据库需另算。") ;
  const drivers = [
    `${LABELS[input.core]} · ${LABELS[input.gameplay]}；峰值 ${peak} 人 / 周目 ${total} 人，模组 ${modCount}、插件 ${pluginCount}（${LABELS[input.extraLoad]}负载）。`,
    `视距 ${view}、模拟范围 ${simulation}；${LABELS[input.spread]}估计峰值加载约 ${loadedChunks.toLocaleString("zh-CN")} 区块（含额外常加载 ${permanentChunks}）；实体 ${entities}（${absent(input.residentEntities) ? "自动假设" : "自行填写"}）。`,
    `${LABELS[input.redstone]}生电、${LABELS[input.exploration]}跑图；${n("worldCount")} 组世界 × ${n("dimensionCount")} 维度，规划 ${days} 天。`,
    `周目末所有世界约 ${rounded(worldLow)}～${rounded(worldHigh)} GiB；本机完整备份 ${localCopies} 份，另含程序、模组、日志与空闲空间。`,
    `上行预算覆盖游戏峰值${packMiB > 0 ? "、同机资源包 60 秒下载突发" : ""}${remoteBackups ? "、一小时内完整上传备份" : ""}；月流量按日均 ${rounded(averagePlayers, 2)} 人计算。`,
  ];
  const assumptions = [
    "模型 v1：所有系数为本站规划假设，官方文档仅支持影响因素、参数含义与复核方法，没有为这些系数背书。",
    "RAM/GiB 与磁盘/GiB 使用 1024 进制；带宽/Mbps 使用 1000 进制，上行与下行不能混用。RAM 包含 JVM 堆、非堆和系统余量，磁盘建议使用 SSD。",
    `另为同机数据库、面板等预留 ${n("otherServicesGiB")} GiB；这些服务的 CPU、磁盘与网络未覆盖，若未填常加载区块按 0 处理。`,
    `堆基线 ${baseHeap} GiB；每模组 0.016 / 插件 0.025 GiB × 负载系数 ${load}，每玩家 0.035 GiB；每加载区块 ${modded ? "0.0009" : "0.00045"} GiB，每实体 0.00016 GiB。推荐堆加约 40% 并向上取整。`,
    `额外脚本 / 功能按所选负载单独预留 ${extraHeap} GiB 并提高 CPU 预算；命令方块和数据包负载不要求模组或插件数量大于 0。`,
    `预生成按半径 ${radius} 方块的方形区域 × ${dimensions} 个维度；压缩区块暂按 ${bytesLow / 1024}～${bytesHigh / 1024} KiB，地形和模组可能超出此范围。已知总大小与预生成面积取较大值，避免重复累计。`,
    measuredGrowth !== undefined ? `使用实测每天增长 ${measuredGrowth} GiB，后续 ${days} 天线性累加；填写 0 代表预计不再增长。` : `跑图空间按玩家小时粗估每天 ${rounded(dailyLow, 3)}～${rounded(dailyHigh, 3)} GiB；用“实测每日增长”替换会更准确。`,
    "本机备份按未压缩完整副本计算，压缩和去重未假定折扣；远程上传每份允许一小时、按 24 小时周期排程，月预算用周目末大小保守计算。留存旧周目另行增加磁盘。",
    `游戏每人 ${rounded(perPlayerMbps, 3)} Mbps 是流量假设，并非协议固定速率；月流量按 30 天、日均玩家小时计算。${selfHostedPack ? `资源包按每次入服都下载，峰值每小时 ${joins} 次，真实客户端缓存可能降低流量。` : "资源包为外部托管，其下载带宽和流量不计入游戏主机，外部托管额度需另核实。"}`,
    !supportsSimulationDistance(input.version) ? "此旧版本原版没有独立 simulation-distance，按视距估算模拟范围；第三方核心有不同实现时请实测。" : "视距负责发送范围，模拟距离影响运行更新；没有把磁盘上的全部区块当成同时加载的内存。",
  ];
  const steps = [
    "使用相同整合包、种子与核心搭建测试服，按峰值人数模拟分散跑图、加载生电机器和集中入服。",
    "在问题发生时采集 spark（先安装兼容版本）或核心对应性能报告；观察 TPS、MSPT 的分位数、GC 停顿、堆占用、磁盘等待和 CPU 主线程。20 TPS 的平均 tick 预算是 50 ms，也要关注峰值。",
    "连续记录若干天世界增长和峰值上行，再把实测值填回本问卷；验证完整备份能恢复，并在低峰预生成 / 备份。",
    "核实主机 CPU 共享限制、容器总 RAM、磁盘 IOPS、流量计费、公网可达性及玩家地区线路；站点前端和 Cloudflare Workers 不能承载 Java 游戏进程。",
  ];
  const summary = `峰值 ${peak} 人的${LABELS[input.core]}：建议从 ${recommended.cpuThreads} 个稳定逻辑线程预算、${recommended.ramGiB} GiB 总内存（JVM 堆 ${recommended.heapGiB} GiB）、${recommended.storageGiB} GiB SSD、${recommended.uploadMbps} Mbps 上行预算开始实测。`;
  const row = (label: string, b: ServerSizingBudget) => `${label}：CPU ${b.cpuThreads} 逻辑线程预算；JVM 堆 ${b.heapGiB} GiB；机器 / 容器总 RAM ${b.ramGiB} GiB；SSD ${b.storageGiB} GiB；上行 ${b.uploadMbps} Mbps；30 天上行流量 ${b.monthlyTrafficGiB} GiB。`;
  const text = ["Pkqa MC 工具工坊 · 开服配置估算报告", `游戏 ${input.version} · Mojang 原版运行时参考 Java ${recommendedJavaForVersion(input.version)} · 模型 v1`, summary,
    row("最低起步估算", minimum), row("推荐冗余预算", recommended), "\n负载依据", ...drivers.map(v => `- ${v}`), "\n限制与现状", ...warnings.map(v => `- ${v}`), "\n计算假设", ...assumptions.map(v => `- ${v}`), "\n上线前复核", ...steps.map((v, i) => `${i + 1}. ${v}`), "\n参考资料（不是系数来源）", ...SERVER_SIZING_SOURCES.map(s => `${s.title}：${s.url}`)].join("\n");
  return { ...validated, report: { modelVersion: "v1", version: input.version, javaVersion: recommendedJavaForVersion(input.version), minimum, recommended,
    confidence: outsideModelScope ? "very-low" : "low",
    drivers, warnings, assumptions, steps, summary, text, worldGiB: { low: rounded(worldLow), high: rounded(worldHigh) }, loadedChunks, averagePlayers: rounded(averagePlayers, 2) } };
}
export const makeServerSizing = estimateServerSizing;
