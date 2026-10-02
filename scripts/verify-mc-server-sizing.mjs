import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadTs } from "./mc-test-runtime.mjs";

const { estimateServerSizing, validateServerSizing, SERVER_SIZING_LIMITS, supportsSimulationDistance } = loadTs("../src/lib/mc/server-sizing.ts");
const counts = { fixed: 0, invalid: 0, matrix: 0, monotonic: 0, separation: 0 };
const base = {
  version: "26.1", core: "vanilla", gameplay: "survival", concurrentPlayers: 10, totalPlayers: 30,
  modCount: 0, pluginCount: 0, extraLoad: "light", redstone: "light", spread: "normal",
  viewDistance: 10, simulationDistance: 8, exploration: "medium", pregeneration: "none",
  worldCount: 1, dimensionCount: 3, cycleDays: 90, runningHoursPerDay: 24, playerHoursPerDay: 3,
  backupCopies: 3, backupLocation: "local", backupIntervalHours: 24, resourcePackMiB: 0,
  resourcePackHosting: "external", networkQuality: "normal", targetRegion: "domestic",
};
const report = changes => {
  const result = estimateServerSizing({ ...base, ...changes });
  assert.deepEqual(result.errors, [], JSON.stringify(changes));
  assert.ok(result.report); const r = result.report;
  for (const key of Object.keys(r.minimum)) {
    assert.ok(Number.isFinite(r.minimum[key]) && r.minimum[key] >= 0, key);
    assert.ok(Number.isFinite(r.recommended[key]) && r.recommended[key] >= r.minimum[key], key);
  }
  assert.ok(r.minimum.ramGiB > r.minimum.heapGiB); assert.ok(r.recommended.ramGiB > r.recommended.heapGiB);
  assert.ok(r.worldGiB.high >= r.worldGiB.low);
  assert.match(r.text, /不是官方最低配置|非官方/); assert.match(r.text, /启发式/);
  assert.doesNotMatch(r.text, /NaN|Infinity|undefined/);
  return r;
};
const invalid = changes => {
  const i = { ...base, ...changes }, result = estimateServerSizing(i);
  assert.ok(result.errors.length, JSON.stringify(changes)); assert.equal(result.report, null);
  assert.deepEqual(result.errors, validateServerSizing(i).errors);
  counts.invalid++;
};
// Handwritten example: total 30 × 3h = 90 player-hours/day; divided by 24h = 3.75 players.
const fixed = report({});
assert.equal(fixed.averagePlayers, 3.75);
assert.equal(fixed.loadedChunks, 1764); // four disjoint groups × 21².
assert.deepEqual(fixed.minimum, { cpuThreads: 4, heapGiB: 3, ramGiB: 5, storageGiB: 200, uploadMbps: 3, monthlyTrafficGiB: 170 });
assert.deepEqual(fixed.recommended, { cpuThreads: 6, heapGiB: 4, ramGiB: 6, storageGiB: 850, uploadMbps: 5, monthlyTrafficGiB: 320 });
counts.fixed += 4;
assert.equal(report({ currentWorldGiB: 20, dailyGrowthGiB: 0 }).worldGiB.low, 20);
assert.equal(report({ currentWorldGiB: 20, dailyGrowthGiB: 0 }).worldGiB.high, 20);
assert.equal(report({ currentWorldGiB: 20, dailyGrowthGiB: 2, cycleDays: 30 }).worldGiB.low, 80);
assert.equal(report({ currentWorldGiB: 20, dailyGrowthGiB: 2, cycleDays: 30 }).worldGiB.high, 80);
counts.fixed += 4;
invalid({ concurrentPlayers: "" }); invalid({ totalPlayers: "" }); invalid({ concurrentPlayers: 31, totalPlayers: 30 });
invalid({ playerHoursPerDay: 25 }); invalid({ runningHoursPerDay: 1, playerHoursPerDay: 2 });
invalid({ concurrentPlayers: 2, totalPlayers: 100, playerHoursPerDay: 3 });
for (const version of ["1.16.7", "26.2", "", "__proto__", null]) invalid({ version });
for (const field of ["core", "gameplay", "extraLoad", "redstone", "spread", "exploration", "pregeneration", "backupLocation", "resourcePackHosting", "networkQuality", "targetRegion"]) {
  for (const value of ["", "__proto__", "unknown", null, 1]) invalid({ [field]: value });
}
const optional = ["currentWorldGiB", "dailyGrowthGiB", "physicalMemoryGiB", "uploadMbps", "pregenRadiusBlocks", "joinsPerHour", "residentEntities", "permanentChunks", "otherServicesGiB"];
for (const [key, limit] of Object.entries(SERVER_SIZING_LIMITS)) {
  const validBase = { core: "hybrid", modCount: 0, pluginCount: 0 };
  for (const value of [NaN, Infinity, -Infinity, null, true, {}, [], "Infinity", "0x10", "1e3", "-1", "nope", limit.max + 1]) invalid({ ...validBase, [key]: value });
  if (limit.integer) invalid({ ...validBase, [key]: Math.max(limit.min, 1) + 0.5 });
  if (limit.min > 0) invalid({ ...validBase, [key]: 0 });
  if (optional.includes(key)) {
    const blank = report({ ...validBase, [key]: "" }), missing = report({ ...validBase, [key]: undefined });
    assert.deepEqual(blank.minimum, missing.minimum); assert.deepEqual(blank.recommended, missing.recommended); counts.fixed++;
  }
}
for (const core of ["vanilla", "plugin", "modded", "hybrid"]) {
  for (const version of ["1.8.9", "1.12.2", "1.16.5", "1.17", "1.20.4", "1.20.6", "1.21.5", "1.21.8", "26.1"]) {
    for (const redstone of ["none", "light", "medium", "heavy", "extreme"]) {
      for (const exploration of ["light", "medium", "heavy", "extreme"]) {
        for (const gameplay of ["survival", "minigame", "creative"]) {
          const r = report({ core, version, redstone, exploration, gameplay, modCount: 100, pluginCount: 30 });
          if (core !== "vanilla") assert.match(r.warnings.join("\n"), /原版运行时参考/);
          if (!supportsSimulationDistance(version)) assert.match(r.assumptions.join("\n"), /没有独立 simulation-distance/);
          counts.matrix++;
        }
      }
    }
  }
}
const mono = (field, values, keys, changes = {}) => {
  let previous;
  for (const value of values) {
    const next = report({ ...changes, [field]: value });
    if (previous) for (const tier of ["minimum", "recommended"]) for (const key of keys) {
      assert.ok(next[tier][key] >= previous[tier][key], `${field}=${value} decreased ${tier}.${key}`); counts.monotonic++;
    }
    previous = next;
  }
};
mono("concurrentPlayers", [1, 2, 5, 10, 20, 50, 100, 200, 500], ["cpuThreads", "heapGiB", "ramGiB", "uploadMbps"], { totalPlayers: 500, playerHoursPerDay: 0.01 });
mono("viewDistance", Array.from({ length: 30 }, (_, i) => i + 3), ["heapGiB", "ramGiB", "uploadMbps"]);
mono("simulationDistance", Array.from({ length: 30 }, (_, i) => i + 3), ["cpuThreads", "heapGiB", "ramGiB"]);
mono("redstone", ["none", "light", "medium", "heavy", "extreme"], ["cpuThreads", "heapGiB", "ramGiB"]);
mono("spread", ["together", "normal", "scattered"], ["cpuThreads", "heapGiB", "ramGiB"]);
mono("exploration", ["light", "medium", "heavy", "extreme"], ["cpuThreads", "storageGiB", "uploadMbps", "monthlyTrafficGiB"]);
mono("modCount", [0, 10, 50, 100, 250, 500, 2000], ["cpuThreads", "heapGiB", "ramGiB"], { core: "modded" });
mono("pluginCount", [0, 10, 50, 100, 300, 1000], ["cpuThreads", "heapGiB", "ramGiB"], { core: "plugin" });
mono("extraLoad", ["light", "medium", "heavy"], ["cpuThreads", "heapGiB", "ramGiB"], { core: "hybrid", modCount: 150, pluginCount: 40 });
mono("extraLoad", ["light", "medium", "heavy"], ["cpuThreads", "heapGiB", "ramGiB"], { core: "vanilla", modCount: 0, pluginCount: 0 });
const smallScriptsBase = { concurrentPlayers: 1, totalPlayers: 1 };
const lightScripts = report(smallScriptsBase), heavyScripts = report({ ...smallScriptsBase, extraLoad: "heavy" });
assert.ok(heavyScripts.recommended.cpuThreads > lightScripts.recommended.cpuThreads);
assert.ok(heavyScripts.recommended.heapGiB > lightScripts.recommended.heapGiB);
counts.fixed += 2;
mono("cycleDays", [1, 7, 30, 90, 365, 3650], ["storageGiB"]);
mono("backupCopies", [0, 1, 3, 10, 100], ["storageGiB"]);
mono("permanentChunks", [0, 100, 1000, 10000, 1000000], ["cpuThreads", "heapGiB", "ramGiB"]);
mono("residentEntities", [0, 100, 1000, 10000, 1000000], ["cpuThreads", "heapGiB", "ramGiB"]);
mono("resourcePackMiB", [0, 16, 64, 128, 1024], ["uploadMbps", "monthlyTrafficGiB"], { resourcePackHosting: "same-server" });
mono("pregenRadiusBlocks", [0, 1000, 2000, 5000, 10000], ["storageGiB"], { pregeneration: "full" });
const same = (changes, keys) => {
  const a = report({}), b = report(changes);
  for (const tier of ["minimum", "recommended"]) for (const key of keys) { assert.equal(a[tier][key], b[tier][key], JSON.stringify(changes)); counts.separation++; }
};
same({ cycleDays: 3650 }, ["cpuThreads", "heapGiB", "ramGiB", "uploadMbps", "monthlyTrafficGiB"]);
same({ worldCount: 100, dimensionCount: 100 }, ["cpuThreads", "heapGiB", "ramGiB"]);
same({ backupCopies: 100 }, ["cpuThreads", "heapGiB", "ramGiB", "uploadMbps", "monthlyTrafficGiB"]);
same({ resourcePackMiB: 1024, resourcePackHosting: "external" }, ["cpuThreads", "heapGiB", "ramGiB", "storageGiB", "uploadMbps", "monthlyTrafficGiB"]);
same({ modCount: 2000, pluginCount: 1000 }, ["cpuThreads", "heapGiB", "ramGiB", "storageGiB", "uploadMbps", "monthlyTrafficGiB"]);
same({ networkQuality: "poor", targetRegion: "cross-region" }, ["cpuThreads", "heapGiB", "ramGiB", "uploadMbps"]);
same({ otherServicesGiB: 16 }, ["cpuThreads", "heapGiB", "storageGiB", "uploadMbps"]);
const other = report({ otherServicesGiB: 16 }); assert.equal(other.minimum.ramGiB, fixed.minimum.ramGiB + 16); counts.separation++;
for (const version of ["1.8.9", "1.12.2", "1.16.5", "1.17"]) {
  const a = report({ version, simulationDistance: "" }), b = report({ version, simulationDistance: 32 });
  assert.deepEqual(a.minimum, b.minimum); assert.deepEqual(a.recommended, b.recommended); counts.separation += 2;
}
const none = report({ pregeneration: "none", exploration: "extreme", pregenRadiusBlocks: 5000 });
const full = report({ pregeneration: "full", exploration: "extreme", pregenRadiusBlocks: 5000 });
assert.ok(full.minimum.cpuThreads <= none.minimum.cpuThreads); assert.ok(full.recommended.cpuThreads <= none.recommended.cpuThreads);
assert.ok(full.recommended.storageGiB > none.recommended.storageGiB); counts.separation += 3;
mkdirSync("coverage", { recursive: true });
const result = { scenarios: Object.values(counts).reduce((a, b) => a + b, 0), counts, modelVersion: "v1", note: "Heuristic math/validation verification, not a hardware benchmark or TPS guarantee." };
writeFileSync("coverage/server-sizing-result.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
