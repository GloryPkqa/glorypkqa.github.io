import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "./mc-test-runtime.mjs";
import { jvmProbePassed } from "./mc-jvm-probe-result.mjs";
import { verifyJvmProbeClassifier } from "./verify-mc-jvm-probe-result.mjs";

// Explicitly select Java 17 or 21. The audit executes -version only; no game
// main class, JAR, socket listener, world creation or system installation runs.
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const major = Number(option("--major"));
assert.ok([17, 21].includes(major), "Pass --major 17 or --major 21 explicitly");
const home = option("--java-home"), explicitJava = option("--java");
assert.ok(home || explicitJava, "Pass an explicit --java-home or --java; this audit never guesses a JVM major");
const java = explicitJava ? (/[\\/]/.test(explicitJava) ? resolve(explicitJava) : explicitJava) : join(resolve(home), "bin", process.platform === "win32" ? "java.exe" : "java");
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const directory = join(root, "coverage", `server-launch-java${major}-native-tmp`);
mkdirSync(directory, { recursive: true });
const env = { ...process.env };
for (const key of ["_JAVA_OPTIONS", "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS"]) delete env[key];
const counts = { controls: 0, flagDefaults: 0, flagBounds: 0, collectorProfiles: 0, productDependencies: 0 };
const classifierChecks = verifyJvmProbeClassifier();
const records = [];
function probe(id, args, expected = "accept", category = "controls") {
  assert.ok(!args.includes("-jar") && args.at(-1) === "-version", `${id}: only version probes are permitted`);
  const result = spawnSync(java, args, { cwd: directory, env, windowsHide: true, timeout: 15000, encoding: "utf8", maxBuffer: 1024 * 1024 });
  if (result.error) throw new Error(`${id}: JVM probe could not run: ${result.error.message}`);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const pass = jvmProbePassed(result, expected);
  records.push({ id, args, expected, exitCode: result.status, signal: result.signal, pass, output });
  counts[category]++;
  return output;
}
const prefix = ["-Xms32m", "-Xmx64m"];
const runtime = probe(`runtime-java${major}`, [...prefix, "-version"]);
const runtimeMajorPattern = new RegExp(`(?:version|openjdk) "${major}(?=\\.|\")`);
for (const version of [`${major}`, `${major}.0.1`]) assert.match(`openjdk version "${version}"`, runtimeMajorPattern);
for (const version of [`${major}0`, `${major}0.1`, major === 17 ? "21" : "17"]) assert.doesNotMatch(`openjdk version "${version}"`, runtimeMajorPattern);
assert.match(runtime, runtimeMajorPattern, "Selected executable must match the requested JVM major");
assert.match(runtime, /64-Bit.*(?:Server|HotSpot)/, "This audit requires a 64-bit HotSpot runtime");

// These frozen native controls are deliberately independent of product
// metadata. Java 21 supports generational ZGC; Java 17 does not.
for (const [id, args, expected] of [
  ["gc-g1", ["-XX:+UseG1GC"], "accept"],
  ["gc-zgc", ["-XX:+UseZGC"], "accept"],
  ["gc-parallel", ["-XX:+UseParallelGC"], "accept"],
  ["gc-serial", ["-XX:+UseSerialGC"], "accept"],
  ["generational-zgc-major-boundary", ["-XX:+UseZGC", "-XX:+ZGenerational"], major === 21 ? "accept" : "reject"],
  ["gc-conflict", ["-XX:+UseG1GC", "-XX:+UseZGC"], "reject"],
  ["unknown-option", ["-XX:+PkqaFlagDoesNotExist"], "reject"],
  ["cms-removed", ["-XX:+UseConcMarkSweepGC"], "reject"],
  ["aggressiveopts-removed", ["-XX:+AggressiveOpts"], "reject"],
  ["permsize-removed", ["-XX:PermSize=16m"], "reject"],
  ["gc-date-stamps-removed", ["-XX:+PrintGCDateStamps"], "reject"],
  ["unified-logging-supported", ["-Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=5,filesize=10M"], "accept"],
  ["g1-young-min-needs-unlock", ["-XX:+UseG1GC", "-XX:G1NewSizePercent=5"], "reject"],
  ["g1-young-max-needs-unlock", ["-XX:+UseG1GC", "-XX:G1MaxNewSizePercent=60"], "reject"],
  ["g1-mixedlive-needs-unlock", ["-XX:+UseG1GC", "-XX:G1MixedGCLiveThresholdPercent=85"], "reject"],
  ["experimental-unlock-order-matters", ["-XX:+UseG1GC", "-XX:G1NewSizePercent=5", "-XX:+UnlockExperimentalVMOptions"], "reject"],
  ["g1-experimental-supported", ["-XX:+UseG1GC", "-XX:+UnlockExperimentalVMOptions", "-XX:G1NewSizePercent=5", "-XX:G1MaxNewSizePercent=60", "-XX:G1MixedGCLiveThresholdPercent=85", "-XX:G1OldCSetRegionThresholdPercent=10"], "accept"],
  ["g1-young-bound-conflict", ["-XX:+UseG1GC", "-XX:+UnlockExperimentalVMOptions", "-XX:G1NewSizePercent=80", "-XX:G1MaxNewSizePercent=20"], "reject"],
  ["g1-percentage-outside-range", ["-XX:+UseG1GC", "-XX:G1ReservePercent=200"], "reject"],
]) probe(id, [...prefix, ...args, "-version"], expected);

const { makeServerLaunch, SERVER_JVM_FLAGS, SERVER_GC_OPTIONS, flagSupportReason } = loadTs("../src/lib/mc/server-launch.ts");
const base = { version: major === 21 ? "1.20.6" : "1.20.4", javaVersion: major, executable: java, jar: "server.jar", platform: "powershell", minMemoryMiB: 256, maxMemoryMiB: 512, collector: "g1", selectedFlags: [], numericValues: {}, nogui: true };
function argsFor(input, id, combined = false) {
  const result = makeServerLaunch(input);
  assert.deepEqual(result.errors, [], `${id}: product rejected a supported probe profile`);
  const marker = result.javaArgs.indexOf("-jar");
  assert.ok(marker > 0 && result.javaArgs[marker + 1] === input.jar);
  const args = result.javaArgs.slice(0, marker).map(value => /^-Xms/.test(value) ? "-Xms32m" : /^-Xmx/.test(value) ? "-Xmx64m" : value);
  if (!combined && args.some(value => value.startsWith("-XX:ActiveProcessorCount="))) {
    // Preserve the tested CPU number but bound ergonomic G1 native marking
    // memory. The separate PrintFlagsFinal control verifies the max is active.
    args.push("-XX:ParallelGCThreads=4", "-XX:ConcGCThreads=1");
  }
  return [...args, "-version"];
}
function flagInput(flag, value) {
  const collector = flag.collector ?? "g1";
  const selectedFlags = [flag.id], numericValues = value === undefined ? {} : { [flag.id]: value };
  if (flag.id === "ConcGCThreads") { selectedFlags.push("ParallelGCThreads"); numericValues.ParallelGCThreads = Math.max(4, value ?? flag.defaultValue); }
  if (flag.id === "G1NewSizePercent" && value > 60) { selectedFlags.push("G1MaxNewSizePercent"); numericValues.G1MaxNewSizePercent = value; }
  if (flag.id === "G1MaxNewSizePercent" && value < 5) { selectedFlags.push("G1NewSizePercent"); numericValues.G1NewSizePercent = value; }
  return { ...base, collector, selectedFlags, numericValues };
}
for (const flag of SERVER_JVM_FLAGS) {
  const input = flagInput(flag);
  if (flagSupportReason(flag, major, input.collector)) continue;
  probe(`flag-${flag.id}-default`, argsFor(input, flag.id), "accept", "flagDefaults");
  if (flag.kind === "number") for (const [label, value] of [["min", flag.min], ["max", flag.max]]) {
    if (value === undefined) continue;
    probe(`flag-${flag.id}-${label}`, argsFor(flagInput(flag, value), `${flag.id}-${label}`), "accept", "flagBounds");
  }
}
for (const option of SERVER_GC_OPTIONS.filter(entry => entry.javaMin <= major)) {
  const selectedFlags = SERVER_JVM_FLAGS.filter(flag => !flagSupportReason(flag, major, option.id) && flag.id !== "DisableExplicitGC").map(flag => flag.id);
  probe(`collector-${option.id}-all-compatible`, argsFor({ ...base, collector: option.id, selectedFlags }, option.id, true), "accept", "collectorProfiles");
}
// Test supported ZGC independently of G1's dependency rule and confirm both
// extrema of the thread and collection fields remain accepted with ZGC.
for (const [id, numericValues, selectedFlags] of [
  ["zgc-concurrent-threads-greater-than-parallel", { ParallelGCThreads: 1, ConcGCThreads: 4 }, ["ParallelGCThreads", "ConcGCThreads"]],
  ["zgc-thread-minima", { ParallelGCThreads: 1, ConcGCThreads: 1 }, ["ParallelGCThreads", "ConcGCThreads"]],
  ["zgc-thread-maxima", { ParallelGCThreads: 1024, ConcGCThreads: 1024 }, ["ParallelGCThreads", "ConcGCThreads"]],
]) probe(id, argsFor({ ...base, collector: "zgc", numericValues, selectedFlags }, id), "accept", "collectorProfiles");
const cpuControl = probe("cpu-max-preserved-with-bounded-g1-workers", [...prefix, "-XX:+UseG1GC", "-XX:ActiveProcessorCount=1024", "-XX:ParallelGCThreads=4", "-XX:ConcGCThreads=1", "-XX:+PrintFlagsFinal", "-version"]);
assert.match(cpuControl, /\bActiveProcessorCount\s+=\s+1024\b/);
assert.match(cpuControl, /\bParallelGCThreads\s+=\s+4\b/);
assert.match(cpuControl, /\bConcGCThreads\s+=\s+1\b/);
if (major === 21) {
  const generational = probe("java21-generational-zgc-is-enabled", [...prefix, "-XX:+UseZGC", "-XX:+ZGenerational", "-XX:+PrintFlagsFinal", "-version"]);
  assert.match(generational, /\bUseZGC\s+=\s+true\b/);
  assert.match(generational, /\bZGenerational\s+=\s+true\b/, "Native positive control must actually enable generational ZGC");
}
for (const selectedFlags of [["DisableExplicitGC", "ExplicitGCInvokesConcurrent"], ["ConcGCThreads"]]) {
  assert.ok(makeServerLaunch({ ...base, selectedFlags }).errors.length > 0);
  counts.productDependencies++;
}
const report = { java, major, platform: process.platform, architecture: process.arch, classifierChecks, runtime: runtime.trim(), counts, probes: records.length, failures: records.filter(entry => !entry.pass), records, limitations: ["This run verifies the explicitly selected JVM major on the recorded host platform and architecture only; it does not prove all historical updates or platforms.", "Every subprocess executes -version only with a 32/64 MiB heap; successful option acceptance is not a Minecraft/server performance benchmark.", "Individual ActiveProcessorCount probes retain the tested CPU count but fix G1 workers to 4 parallel / 1 concurrent to avoid host-resource exhaustion; PrintFlagsFinal independently confirms the CPU maximum."] };
writeFileSync(join(root, "coverage", `server-launch-java${major}-native-result.json`), `${JSON.stringify(report, null, 2)}\n`);
if (report.failures.length) { console.error(JSON.stringify(report.failures, null, 2)); throw new Error(`${report.failures.length} Java ${major} native probes failed`); }
console.log(`Native Java ${major} launch audit passed: ${records.length} real JVM probes;`, counts);
