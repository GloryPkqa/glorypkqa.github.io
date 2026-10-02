import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadTs } from "./mc-test-runtime.mjs";

// Independent metamorphic properties and SI/IEC arithmetic controls. No model
// coefficient is copied here, and no heuristic output is treated as a measured
// capacity benchmark or an official hardware requirement.
const { estimateServerSizing, validateServerSizing, SERVER_SIZING_LIMITS } = loadTs("../src/lib/mc/server-sizing.ts", { "./server-launch": loadTs("../src/lib/mc/server-launch.ts") });
const counts = { finiteAndOrdered: 0, monotonicLoad: 0, periodIsolation: 0, pregeneration: 0, optionalOverrides: 0, resourceHosting: 0, backups: 0, units: 0, invalidBoundaries: 0, legacySimulation: 0, validExtremes: 0, scriptOnlyLoad: 0, scaleWarnings: 0 };
const errors = [];
function check(kind, title, operation) {
  counts[kind]++;
  try { operation(); } catch (error) { errors.push({ kind, title, error: error.message.slice(0, 1200) }); }
}
const base = {
  version: "26.1", core: "plugin", gameplay: "survival", concurrentPlayers: 20, totalPlayers: 60,
  modCount: 0, pluginCount: 10, viewDistance: 10, simulationDistance: 6,
  worldCount: 1, dimensionCount: 3, cycleDays: 30, runningHoursPerDay: 24, playerHoursPerDay: 4,
  backupCopies: 3, backupIntervalHours: 24, resourcePackMiB: 64,
  extraLoad: "medium", redstone: "light", spread: "normal", exploration: "medium", pregeneration: "none",
  networkQuality: "normal", targetRegion: "domestic", resourcePackHosting: "external", backupLocation: "local",
};
const reportFor = (patch = {}) => {
  const input = { ...base, ...patch };
  const result = estimateServerSizing(input);
  assert.deepEqual(result.errors, [], `Valid input rejected: ${JSON.stringify(patch)}`);
  assert.ok(result.report, `Missing report: ${JSON.stringify(patch)}`);
  return result.report;
};
const plans = ["minimum", "recommended"];
const instantKeys = ["cpuThreads", "heapGiB", "ramGiB", "uploadMbps"];
const allKeys = [...instantKeys, "storageGiB", "monthlyTrafficGiB"];
const monotone = (key, values, keys, context = {}) => {
  let previous;
  for (const value of values) {
    const current = reportFor({ ...context, [key]: value });
    if (previous) for (const plan of plans) for (const metric of keys) check("monotonicLoad", `${key}=${value} ${plan}.${metric}`, () => assert.ok(current[plan][metric] >= previous[plan][metric], `${key} ${metric} fell: ${previous[plan][metric]} -> ${current[plan][metric]}`));
    previous = current;
  }
};

for (const version of ["26.1", "1.21.8", "1.21.5", "1.20.6", "1.20.4", "1.17", "1.16.5", "1.12.2", "1.8.9"]) {
  for (const core of ["vanilla", "plugin", "modded", "hybrid"]) {
    const report = reportFor({ version, core, pluginCount: core === "vanilla" || core === "modded" ? 0 : 10, modCount: core === "modded" || core === "hybrid" ? 50 : 0 });
    for (const key of allKeys) {
      check("finiteAndOrdered", `${version}/${core} ${key}`, () => {
        assert.ok(Number.isFinite(report.minimum[key]) && report.minimum[key] >= 0);
        assert.ok(Number.isFinite(report.recommended[key]) && report.recommended[key] >= report.minimum[key]);
      });
    }
    check("finiteAndOrdered", `${version}/${core} world range`, () => {
      assert.ok(Number.isFinite(report.worldGiB.low) && report.worldGiB.low >= 0);
      assert.ok(Number.isFinite(report.worldGiB.high) && report.worldGiB.high >= report.worldGiB.low);
      assert.ok(Number.isFinite(report.loadedChunks) && report.loadedChunks >= 0);
      assert.ok(Number.isFinite(report.averagePlayers) && report.averagePlayers >= 0 && report.averagePlayers <= 20);
      assert.ok(["low", "very-low"].includes(report.confidence));
      assert.match(report.text, /估算|预算|经验|启发式/);
      assert.doesNotMatch(report.summary, /(?:官方最低|保证\s*\d+\s*人|保证不卡|百分之百)/);
      assert.match(report.warnings.join("\n"), /不是官方|启发式/);
    });
  }
}
monotone("concurrentPlayers", [1, 4, 10, 20, 40, 60], allKeys, { totalPlayers: 60, playerHoursPerDay: 0.25 });
monotone("pluginCount", [0, 10, 30, 80], ["cpuThreads", "heapGiB", "ramGiB"], { core: "plugin" });
monotone("modCount", [0, 20, 80, 150], ["cpuThreads", "heapGiB", "ramGiB"], { core: "modded", pluginCount: 0 });
monotone("viewDistance", [4, 6, 10, 16, 24, 32], ["cpuThreads", "heapGiB", "ramGiB", "uploadMbps"], { simulationDistance: 4 });
monotone("simulationDistance", [4, 6, 10, 16, 24, 32], ["cpuThreads", "heapGiB", "ramGiB"], { viewDistance: 32 });
monotone("worldCount", [1, 2, 4], ["heapGiB", "ramGiB", "storageGiB"]);
monotone("dimensionCount", [1, 3, 6], ["heapGiB", "ramGiB", "storageGiB"]);
monotone("residentEntities", [0, 100, 1000, 10000], ["cpuThreads", "heapGiB", "ramGiB"]);
monotone("permanentChunks", [0, 100, 1000, 10000], ["cpuThreads", "heapGiB", "ramGiB"]);
monotone("otherServicesGiB", [0, 1, 4, 16], ["ramGiB"]);
monotone("redstone", ["none", "light", "medium", "heavy", "extreme"], ["cpuThreads", "heapGiB", "ramGiB"]);
monotone("extraLoad", ["light", "medium", "heavy"], ["cpuThreads", "heapGiB", "ramGiB"]);
monotone("spread", ["together", "normal", "scattered"], ["cpuThreads", "heapGiB", "ramGiB"]);
monotone("exploration", ["light", "medium", "heavy", "extreme"], ["cpuThreads", "storageGiB", "uploadMbps"]);

// Work from command blocks or datapack scripts exists independently of mod /
// plugin counts. Check both CPU tiers, because one rounded tier can stay flat
// even while the other changes. Neither tier is a continuous benchmark.
for (const core of ["vanilla", "plugin", "modded", "hybrid"]) {
  const context = { core, pluginCount: 0, modCount: 0, concurrentPlayers: 24, totalPlayers: 24, playerHoursPerDay: 3, viewDistance: 16, simulationDistance: 16, residentEntities: 0, redstone: "none", exploration: "light" };
  const light = reportFor({ ...context, extraLoad: "light" });
  const heavy = reportFor({ ...context, extraLoad: "heavy" });
  check("scriptOnlyLoad", `${core} script-only CPU`, () => assert.ok(heavy.minimum.cpuThreads > light.minimum.cpuThreads || heavy.recommended.cpuThreads > light.recommended.cpuThreads));
  check("scriptOnlyLoad", `${core} script-only heap`, () => assert.ok(heavy.recommended.heapGiB > light.recommended.heapGiB));
  check("scriptOnlyLoad", `${core} declared workload`, () => {
    assert.match(heavy.assumptions.join("\n"), /额外脚本.*单独预留.*GiB.*CPU/);
    assert.match(heavy.assumptions.join("\n"), /命令方块和数据包负载不要求模组或插件数量大于 0/);
    for (const plan of plans) for (const key of ["storageGiB", "uploadMbps", "monthlyTrafficGiB"]) assert.equal(heavy[plan][key], light[plan][key], "CPU-only script workload fabricated a data-transfer or world-growth measurement");
  });
}

// CPU/player-only scale warnings miss large offline worlds and download-heavy
// hosting. These are fixed examples, not coefficients chosen by the model.
const scaleBase = { core: "vanilla", concurrentPlayers: 1, totalPlayers: 1, playerHoursPerDay: 1, modCount: 0, pluginCount: 0, extraLoad: "light", redstone: "none", viewDistance: 3, simulationDistance: 3, worldCount: 1, dimensionCount: 1, backupCopies: 0, exploration: "light", dailyGrowthGiB: 0, cycleDays: 1 };
for (const [title, patch] of [
  ["million-block pregeneration radius", { pregeneration: "full", pregenRadiusBlocks: 1000000 }],
  ["large measured world and growth", { currentWorldGiB: 1000000, dailyGrowthGiB: 10000, cycleDays: 3650 }],
  ["ten thousand dimensions", { worldCount: 100, dimensionCount: 100 }],
  ["large same-host download burst", { concurrentPlayers: 24, totalPlayers: 24, resourcePackMiB: 1024, resourcePackHosting: "same-server", joinsPerHour: 100000 }],
]) {
  const r = reportFor({ ...scaleBase, ...patch });
  check("scaleWarnings", `${title} confidence`, () => assert.equal(r.confidence, "very-low", "Storage/dimension/network extremes must not silently keep the normal model uncertainty tier"));
  check("scaleWarnings", `${title} explicit warning`, () => {
    const warning = r.warnings.find((value) => /超出.*估算范围|超.*规模|规模.*超出/.test(value));
    assert.ok(warning && /存储|磁盘|世界|维度|网络|带宽/.test(warning), "Explain the non-CPU scale limitation before procurement");
  });
}

let shorter;
for (const cycleDays of [1, 7, 30, 90, 365]) {
  const longer = reportFor({ cycleDays });
  if (shorter) for (const plan of plans) {
    for (const key of instantKeys) check("periodIsolation", `${cycleDays}d ${plan}.${key}`, () => assert.equal(longer[plan][key], shorter[plan][key], "Opening duration changed instantaneous requirement"));
    for (const key of ["storageGiB", "monthlyTrafficGiB"]) check("periodIsolation", `${cycleDays}d ${plan}.${key}`, () => assert.ok(longer[plan][key] >= shorter[plan][key]));
  }
  shorter = longer;
}
for (const optional of ["currentWorldGiB", "dailyGrowthGiB", "physicalMemoryGiB", "uploadMbps", "pregenRadiusBlocks", "joinsPerHour", "residentEntities", "permanentChunks", "otherServicesGiB"]) {
  check("optionalOverrides", `${optional} unknown variants`, () => assert.deepEqual(reportFor({ [optional]: "" }), reportFor({ [optional]: undefined })));
}
check("optionalOverrides", "zero daily growth remains zero", () => {
  const one = reportFor({ currentWorldGiB: 8, dailyGrowthGiB: 0, cycleDays: 1 });
  const year = reportFor({ currentWorldGiB: 8, dailyGrowthGiB: 0, cycleDays: 365 });
  assert.deepEqual(year.worldGiB, one.worldGiB, "Explicit zero daily growth was replaced by an inferred growth rate");
});
check("optionalOverrides", "measured daily growth preserves units", () => {
  const a = reportFor({ currentWorldGiB: 8, dailyGrowthGiB: 2, cycleDays: 1 });
  const b = reportFor({ currentWorldGiB: 8, dailyGrowthGiB: 2, cycleDays: 31 });
  assert.ok(Math.abs((b.worldGiB.low - a.worldGiB.low) - 60) < 1e-8, "GiB/day does not match low world growth");
  assert.ok(Math.abs((b.worldGiB.high - a.worldGiB.high) - 60) < 1e-8, "GiB/day does not match high world growth");
});
let pregenerated;
for (const pregeneration of ["none", "partial", "full"]) {
  const current = reportFor({ pregeneration, pregenRadiusBlocks: 1000 });
  if (pregenerated) for (const plan of plans) {
    check("pregeneration", `${pregeneration} ${plan} CPU`, () => assert.ok(current[plan].cpuThreads <= pregenerated[plan].cpuThreads));
    check("pregeneration", `${pregeneration} ${plan} disk`, () => assert.ok(current[plan].storageGiB >= pregenerated[plan].storageGiB));
  }
  pregenerated = current;
}

const externalSmall = reportFor({ resourcePackHosting: "external", resourcePackMiB: 0 });
const externalLarge = reportFor({ resourcePackHosting: "external", resourcePackMiB: 128 });
for (const plan of plans) for (const key of ["uploadMbps", "monthlyTrafficGiB"]) check("resourceHosting", `external ${plan}.${key}`, () => assert.equal(externalLarge[plan][key], externalSmall[plan][key], "External pack inflated game-server outgoing traffic"));
const localLarge = reportFor({ resourcePackHosting: "same-server", resourcePackMiB: 128, joinsPerHour: 12 });
for (const plan of plans) {
  check("resourceHosting", `local pack ${plan} upload`, () => assert.ok(localLarge[plan].uploadMbps >= externalLarge[plan].uploadMbps));
  check("resourceHosting", `local pack ${plan} traffic`, () => assert.ok(localLarge[plan].monthlyTrafficGiB > externalLarge[plan].monthlyTrafficGiB));
}

let moreFrequent;
for (const backupIntervalHours of [1, 6, 24, 72, 720]) {
  const lessFrequent = reportFor({ backupCopies: 3, backupLocation: "remote", backupIntervalHours });
  if (moreFrequent) for (const plan of plans) {
    check("backups", `${backupIntervalHours}h ${plan} traffic`, () => assert.ok(lessFrequent[plan].monthlyTrafficGiB <= moreFrequent[plan].monthlyTrafficGiB));
    for (const metric of ["cpuThreads", "heapGiB", "ramGiB"]) check("backups", `${backupIntervalHours}h ${plan}.${metric}`, () => assert.equal(lessFrequent[plan][metric], moreFrequent[plan][metric]));
  }
  moreFrequent = lessFrequent;
}
const noJoins = reportFor({ resourcePackHosting: "same-server", resourcePackMiB: 128, joinsPerHour: 0 });
const noPack = reportFor({ resourcePackHosting: "same-server", resourcePackMiB: 0, joinsPerHour: 0 });
for (const plan of plans) check("resourceHosting", `zero joins ${plan} average transfer`, () => assert.equal(noJoins[plan].monthlyTrafficGiB, noPack[plan].monthlyTrafficGiB, "Explicit zero joins was replaced by estimated joins"));

const noBackups = reportFor({ backupCopies: 0 });
const localBackups = reportFor({ backupCopies: 3, backupLocation: "local" });
const remoteBackups = reportFor({ backupCopies: 3, backupLocation: "remote" });
const bothBackups = reportFor({ backupCopies: 3, backupLocation: "both" });
for (const plan of plans) {
  check("backups", `local ${plan} storage`, () => assert.ok(localBackups[plan].storageGiB >= noBackups[plan].storageGiB));
  check("backups", `remote ${plan} traffic`, () => assert.ok(remoteBackups[plan].monthlyTrafficGiB >= noBackups[plan].monthlyTrafficGiB));
  check("backups", `both ${plan} local copies`, () => assert.equal(bothBackups[plan].storageGiB, localBackups[plan].storageGiB));
  check("backups", `both ${plan} remote copies`, () => assert.equal(bothBackups[plan].monthlyTrafficGiB, remoteBackups[plan].monthlyTrafficGiB));
}

// Exact data volume is an independent physical oracle. Isolate pack downloads
// from the game's heuristic traffic, and keep backup traffic disabled.
for (const [resourcePackMiB, joinsPerHour, cycleDays, runningHoursPerDay] of [[64, 8, 30, 24], [1, 1, 1, 1], [128, 12, 7, 8]]) {
  // At full occupancy average=peak, a supplied peak hourly join rate is also
  // the hourly rate throughout opening hours. Monthly budgets always use 30d.
  const context = { resourcePackHosting: "same-server", backupCopies: 0, joinsPerHour, cycleDays, runningHoursPerDay, totalPlayers: 20, playerHoursPerDay: runningHoursPerDay };
  const without = reportFor({ ...context, resourcePackMiB: 0 });
  const withPack = reportFor({ ...context, resourcePackMiB });
  const payloadGiB = resourcePackMiB / 1024 * joinsPerHour * 30 * runningHoursPerDay;
  // Outputs may round up in 10 GiB steps or include a declared 25% transport
  // reserve. Eight-bit/decimal/binary conversion mistakes exceed this interval.
  for (const plan of plans) check("units", `pack payload ${resourcePackMiB}/${plan}`, () => {
    const delta = withPack[plan].monthlyTrafficGiB - without[plan].monthlyTrafficGiB;
    assert.ok(delta >= Math.max(0, payloadGiB - 10) && delta <= payloadGiB * 1.25 + 10, `Pack payload expected ${payloadGiB} GiB, got ${delta}`);
  });
}

// A 64 GiB complete backup transferred once each day contributes exactly
// 1,920 GiB of payload per 30d, and transferring it in one hour needs about
// 152.71 decimal Mbps before the report's transport reserve and rounding.
const backupContext = { currentWorldGiB: 64, dailyGrowthGiB: 0, backupLocation: "remote", backupIntervalHours: 24, resourcePackMiB: 0 };
const backupNone = reportFor({ ...backupContext, backupCopies: 0 });
const backupDaily = reportFor({ ...backupContext, backupCopies: 1 });
const backupPayloadGiB = 64 * 30;
const backupPayloadMbps = 64 * 2 ** 30 * 8 / 1e6 / 3600;
for (const plan of plans) {
  check("units", `daily backup ${plan} GiB`, () => {
    const delta = backupDaily[plan].monthlyTrafficGiB - backupNone[plan].monthlyTrafficGiB;
    assert.ok(delta >= backupPayloadGiB - 10 && delta <= backupPayloadGiB * 1.25 + 10, `Daily backup payload expected ${backupPayloadGiB} GiB, got ${delta}`);
  });
  check("units", `daily backup ${plan} Mbps`, () => {
    const delta = backupDaily[plan].uploadMbps - backupNone[plan].uploadMbps;
    assert.ok(delta >= backupPayloadMbps - 10 && delta <= backupPayloadMbps * 1.25 + 10, `One-hour backup payload expected ${backupPayloadMbps} Mbps, got ${delta}`);
  });
}

// Exercise legal extremes independently of the invalid-boundary sweep. Keep
// average population consistent with peak population, even at the maximum
// declared total player count (100,000 * 0.12 / 24 = 500 concurrent players).
for (const extreme of [
  { concurrentPlayers: 1, totalPlayers: 1, playerHoursPerDay: 0, runningHoursPerDay: 0.5, core: "vanilla", worldCount: 1, dimensionCount: 1, viewDistance: 3, simulationDistance: 3, backupCopies: 0, cycleDays: 1, resourcePackMiB: 0, extraLoad: "light", redstone: "none", exploration: "light", spread: "together" },
  { concurrentPlayers: 500, totalPlayers: 100000, playerHoursPerDay: 0.12, runningHoursPerDay: 24, core: "hybrid", modCount: 2000, pluginCount: 1000, worldCount: 100, dimensionCount: 100, viewDistance: 32, simulationDistance: 32, backupCopies: 100, backupIntervalHours: 1, backupLocation: "both", cycleDays: 3650, resourcePackMiB: 1024, resourcePackHosting: "same-server", joinsPerHour: 100000, currentWorldGiB: 1000000, dailyGrowthGiB: 10000, residentEntities: 1000000, permanentChunks: 1000000, otherServicesGiB: 4096, pregenRadiusBlocks: 1000000, pregeneration: "full", extraLoad: "heavy", redstone: "extreme", exploration: "extreme", spread: "scattered" },
]) {
  const r = reportFor(extreme);
  for (const metric of allKeys) check("validExtremes", `${extreme.concurrentPlayers} peak ${metric}`, () => {
    assert.ok(Number.isFinite(r.minimum[metric]) && r.minimum[metric] >= 0);
    assert.ok(Number.isFinite(r.recommended[metric]) && r.recommended[metric] >= r.minimum[metric]);
  });
  check("validExtremes", `${extreme.concurrentPlayers} peak population`, () => {
    assert.ok(r.averagePlayers >= 0 && r.averagePlayers <= extreme.concurrentPlayers);
    assert.ok(Number.isFinite(r.worldGiB.high) && r.worldGiB.high >= r.worldGiB.low);
    assert.ok(Number.isFinite(r.loadedChunks) && r.loadedChunks > 0);
  });
}
for (const version of ["1.17", "1.16.5", "1.12.2", "1.8.9"]) check("legacySimulation", version, () => {
  const a = reportFor({ version, viewDistance: 10, simulationDistance: 4 });
  const b = reportFor({ version, viewDistance: 10, simulationDistance: 10 });
  for (const plan of plans) for (const metric of instantKeys) assert.equal(a[plan][metric], b[plan][metric], "Old Vanilla version treated independent simulation-distance as supported");
});

for (const [field, limits] of Object.entries(SERVER_SIZING_LIMITS)) {
  for (const value of [NaN, Infinity, -Infinity, "NaN", "Infinity", "1e3", "", null, {}, [], limits.min - 1, limits.max + 1]) {
    if (value === "" && !Object.hasOwn(base, field)) continue;
    check("invalidBoundaries", `${field} ${JSON.stringify(value)}`, () => {
      const input = { ...base, core: "hybrid", [field]: value };
      assert.ok(validateServerSizing(input).errors.length > 0, "Invalid input accepted");
      const result = estimateServerSizing(input);
      assert.ok(result.errors.length > 0 && result.report === null, "Invalid input produced a usable report");
    });
  }
}
const report = { checks: Object.values(counts).reduce((sum, value) => sum + value, 0), counts, errors, limitation: "These are correctness/relationship properties and unit oracles, not empirical workload benchmarks. The site's budget coefficients are heuristic." };
mkdirSync(new URL("../coverage/", import.meta.url), { recursive: true });
writeFileSync(new URL("../coverage/server-sizing-independent-result.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  throw new Error(`${errors.length} independent server-sizing checks failed`);
}
console.log(`Independent server-sizing audit passed: ${report.checks} checks;`, counts);
