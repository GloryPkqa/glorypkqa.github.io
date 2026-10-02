import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "./mc-test-runtime.mjs";
import { jvmProbePassed } from "./mc-jvm-probe-result.mjs";
import { verifyJvmProbeClassifier } from "./verify-mc-jvm-probe-result.mjs";

// Independent Java 8 HotSpot acceptance audit. Every subprocess exits through
// -version: no JAR, game main class, server socket, world or EULA is executed.
const option = (name) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const binary = process.platform === "win32" ? "java.exe" : "java";
const cache = join(root, "coverage", "java8");
const cachedHome = existsSync(cache) ? readdirSync(cache).map((name) => join(cache, name)).find((home) => existsSync(join(home, "bin", binary))) : undefined;
const home = option("--java-home") ?? process.env.JAVA_HOME ?? cachedHome;
const explicitJava = option("--java");
const java = explicitJava ? (/[\\/]/.test(explicitJava) ? resolve(explicitJava) : explicitJava) : (home ? join(resolve(home), "bin", binary) : binary);
const directory = join(root, "coverage", "server-launch-java8-native-tmp");
mkdirSync(directory, { recursive: true });
const env = { ...process.env };
for (const key of ["_JAVA_OPTIONS", "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS"]) delete env[key];
const records = [];
const counts = { controls: 0, flagDefaults: 0, flagBounds: 0, collectorProfiles: 0, productDependencies: 0 };
const classifierChecks = verifyJvmProbeClassifier();
function probe(id, args, expected = "accept", category = "controls") {
  assert.ok(!args.includes("-jar") && args.at(-1) === "-version", `${id}: only version probes are permitted`);
  const result = spawnSync(java, args, { cwd: directory, env, windowsHide: true, encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024 });
  if (result.error) throw new Error(`${id}: JVM probe could not execute: ${result.error.message}`);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const pass = jvmProbePassed(result, expected);
  records.push({ id, args, expected, exitCode: result.status, signal: result.signal, pass, output });
  counts[category]++;
  return output;
}
const prefix = ["-Xms32m", "-Xmx64m"];
const runtime = probe("runtime-java8", [...prefix, "-version"]);
assert.match(runtime, /version "1\.8\.0_\d+/, "This audit requires Java 8 HotSpot; select --java or --java-home");
assert.match(runtime, /64-Bit.*(?:Server|HotSpot)/, "Use a maintained 64-bit Java 8 HotSpot runtime");

// Fixed positive / negative controls come from JVM-major history, not the
// application's metadata. CMS/AggressiveOpts are still recognized in Java 8.
for (const [id, args, expected] of [
  ["gc-g1", ["-XX:+UseG1GC"], "accept"],
  ["gc-parallel", ["-XX:+UseParallelGC"], "accept"],
  ["gc-serial", ["-XX:+UseSerialGC"], "accept"],
  ["gc-cms-still-supported-in8", ["-XX:+UseConcMarkSweepGC"], "accept"],
  ["legacy-aggressiveopts-still-supported-in8", ["-XX:+AggressiveOpts"], "accept"],
  ["legacy-permsize-obsolete", ["-XX:PermSize=16m"], "obsolete"],
  ["unknown-option", ["-XX:+PkqaFlagDoesNotExist"], "reject"],
  ["zgc-not-present", ["-XX:+UseZGC"], "reject"],
  ["generational-zgc-not-present", ["-XX:+ZGenerational"], "reject"],
  ["unified-logging-not-present", ["-Xlog:gc"], "reject"],
  ["collector-conflict", ["-XX:+UseG1GC", "-XX:+UseParallelGC"], "reject"],
  ["g1-minyoung-needs-unlock", ["-XX:+UseG1GC", "-XX:G1NewSizePercent=5"], "reject"],
  ["g1-maxyoung-needs-unlock", ["-XX:+UseG1GC", "-XX:G1MaxNewSizePercent=60"], "reject"],
  ["g1-mixedlive-needs-unlock", ["-XX:+UseG1GC", "-XX:G1MixedGCLiveThresholdPercent=85"], "reject"],
  ["g1-oldcset-needs-unlock", ["-XX:+UseG1GC", "-XX:G1OldCSetRegionThresholdPercent=10"], "reject"],
  ["unlock-order-matters", ["-XX:+UseG1GC", "-XX:G1NewSizePercent=5", "-XX:+UnlockExperimentalVMOptions"], "reject"],
  ["g1-experimental-supported", ["-XX:+UseG1GC", "-XX:+UnlockExperimentalVMOptions", "-XX:G1NewSizePercent=5", "-XX:G1MaxNewSizePercent=60", "-XX:G1MixedGCLiveThresholdPercent=85", "-XX:G1OldCSetRegionThresholdPercent=10"], "accept"],
  ["stringdedup-maintained8-supported", ["-XX:+UseG1GC", "-XX:+UseStringDeduplication"], "accept"],
  ["exit-on-oom-maintained8-supported", ["-XX:+ExitOnOutOfMemoryError"], "accept"],
  ["processor-count-maintained8-backport", ["-XX:ActiveProcessorCount=2"], "accept"],
]) probe(id, [...prefix, ...args, "-version"], expected);

const { makeServerLaunch, SERVER_JVM_FLAGS, SERVER_GC_OPTIONS, flagSupportReason } = loadTs("../src/lib/mc/server-launch.ts");
const base = { version: "1.16.5", javaVersion: 8, executable: java, jar: "server.jar", platform: "powershell", minMemoryMiB: 256, maxMemoryMiB: 512, collector: "g1", selectedFlags: [], numericValues: {}, nogui: true };
function argsFor(input, id) {
  const result = makeServerLaunch(input);
  assert.deepEqual(result.errors, [], `${id}: product rejected the supported probe profile`);
  const marker = result.javaArgs.indexOf("-jar");
  assert.ok(marker > 0 && result.javaArgs[marker + 1] === input.jar);
  return [...result.javaArgs.slice(0, marker).map((value) => /^-Xms/.test(value) ? "-Xms32m" : /^-Xmx/.test(value) ? "-Xmx64m" : value), "-version"];
}
function flagInput(flag, value) {
  const collector = flag.collector ?? flag.collectors?.find((entry) => entry === "g1") ?? "g1";
  const selectedFlags = [flag.id], numericValues = value === undefined ? {} : { [flag.id]: value };
  if (flag.id === "ConcGCThreads") { selectedFlags.push("ParallelGCThreads"); numericValues.ParallelGCThreads = Math.max(4, value ?? flag.defaultValue); }
  if (flag.id === "PrintGCDateStamps") selectedFlags.push("PrintGCDetails");
  if (flag.id === "G1NewSizePercent" && value > 60) { selectedFlags.push("G1MaxNewSizePercent"); numericValues.G1MaxNewSizePercent = value; }
  if (flag.id === "G1MaxNewSizePercent" && value < 5) { selectedFlags.push("G1NewSizePercent"); numericValues.G1NewSizePercent = value; }
  return { ...base, collector, selectedFlags, numericValues };
}
for (const flag of SERVER_JVM_FLAGS) {
  const input = flagInput(flag);
  if (flagSupportReason(flag, 8, input.collector)) continue;
  probe(`flag-${flag.id}-default`, argsFor(input, flag.id), "accept", "flagDefaults");
  if (flag.kind === "number") for (const [label, value] of [["min", flag.min], ["max", flag.max]]) {
    if (value === undefined) continue;
    probe(`flag-${flag.id}-${label}`, argsFor(flagInput(flag, value), `${flag.id}-${label}`), "accept", "flagBounds");
  }
}
for (const option of SERVER_GC_OPTIONS.filter((entry) => entry.javaMin <= 8)) {
  const input = { ...base, collector: option.id, selectedFlags: SERVER_JVM_FLAGS.filter((flag) => !flagSupportReason(flag, 8, option.id) && flag.id !== "DisableExplicitGC").map((flag) => flag.id) };
  probe(`collector-${option.id}-all-compatible`, argsFor(input, option.id), "accept", "collectorProfiles");
}
// Product dependency guards are checked separately from JVM argument parsing.
for (const selectedFlags of [["DisableExplicitGC", "ExplicitGCInvokesConcurrent"], ["PrintGCDateStamps"], ["ConcGCThreads"]]) {
  assert.ok(makeServerLaunch({ ...base, selectedFlags }).errors.length > 0, `${selectedFlags}: missing product dependency guard`);
  counts.productDependencies++;
}
for (const [flag, numericValues] of [["G1NewSizePercent", { G1NewSizePercent: 100 }], ["G1MaxNewSizePercent", { G1MaxNewSizePercent: 0 }], ["ConcGCThreads", { ParallelGCThreads: 1, ConcGCThreads: 2 }]]) {
  assert.ok(makeServerLaunch({ ...base, selectedFlags: flag === "ConcGCThreads" ? [flag, "ParallelGCThreads"] : [flag], numericValues }).errors.length > 0);
  counts.productDependencies++;
}
const metadataPath = join(cache, "adoptium-asset.json");
const isCachedRuntime = resolve(java).startsWith(`${resolve(cache)}${process.platform === "win32" ? "\\" : "/"}`);
const asset = isCachedRuntime && existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, "utf8").replace(/^\uFEFF/, "")) : null;
const report = { java, platform: process.platform, architecture: process.arch, classifierChecks, runtime: runtime.trim(), asset: asset ? { version: asset.version?.semver, link: asset.binary?.package?.link, sha256: asset.binary?.package?.checksum } : null, counts, probes: records.length, failures: records.filter((entry) => !entry.pass), records, limitations: ["Actual JVM execution covers this maintained Java 8 update only, not every historical Java 8 update or distribution.", "The cached Adoptium archive was SHA256-verified at acquisition before extraction; an externally supplied --java runtime requires independent distribution verification. This audit does not install or change Java settings.", "Every process executes -version only with 32/64 MiB heap; this validates option acceptance, not Minecraft/plugin performance or capacity."] };
writeFileSync(join(root, "coverage", "server-launch-java8-native-result.json"), `${JSON.stringify(report, null, 2)}\n`);
if (report.failures.length) { console.error(JSON.stringify(report.failures, null, 2)); throw new Error(`${report.failures.length} Java 8 native probes failed`); }
console.log(`Native Java 8 launch audit passed: ${records.length} real JVM probes;`, counts);
