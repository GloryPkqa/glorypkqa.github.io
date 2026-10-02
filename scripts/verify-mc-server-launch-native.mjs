import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "./mc-test-runtime.mjs";

// Every process in this audit ends with -version. No JAR, game main class,
// EULA, world creation, network listener or server lifecycle is executed.
const option = (name) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const executableName = process.platform === "win32" ? "java.exe" : "java";
const cached = join(root, "coverage", "java25");
const cachedHome = existsSync(cached) ? readdirSync(cached).map((name) => join(cached, name)).find((home) => existsSync(join(home, "bin", executableName))) : undefined;
const javaHome = option("--java-home") ?? process.env.JAVA_HOME ?? cachedHome;
const javaOption = option("--java");
const java = javaOption ? (/[\\/]/.test(javaOption) ? resolve(javaOption) : javaOption) : (javaHome ? join(resolve(javaHome), "bin", executableName) : executableName);
const env = { ...process.env };
for (const key of ["_JAVA_OPTIONS", "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS"]) delete env[key];
const probeDirectory = join(root, "coverage", "server-launch-native-tmp");
mkdirSync(probeDirectory, { recursive: true });
const records = [];
const counts = { runtimeMetadata: 0, controls: 0, flagDefaults: 0, flagBounds: 0, collectorProfiles: 0 };
function probe(id, args, expect = "accept", category = "controls") {
  assert.ok(!args.includes("-jar") && args.at(-1) === "-version", `${id}: only a version probe may be executed`);
  const result = spawnSync(java, args, { cwd: probeDirectory, env, windowsHide: true, timeout: 15000, encoding: "utf8", maxBuffer: 1024 * 1024 });
  if (result.error) throw new Error(`${id}: Java probe could not run: ${result.error.message}`);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const pass = expect === "reject" ? result.status !== 0 : expect === "obsolete" ? result.status === 0 && /ignoring option|obsolete|support was removed/i.test(output) : result.status === 0 && !/ignoring option|unrecognized vm option|support was removed/i.test(output);
  records.push({ id, args, expect, exitCode: result.status, pass, output });
  counts[category]++;
  return output;
}

const runtime = probe("runtime-java25", ["-Xms32m", "-Xmx64m", "-version"]);
assert.match(runtime, /(?:version|openjdk) "25\./, "Native launch audit requires JDK 25; pass --java / --java-home or JAVA_HOME");
const fixture = JSON.parse(readFileSync(new URL("./fixtures/mc-server-java-runtime.json", import.meta.url), "utf8"));
const { makeServerLaunch, recommendedJavaForVersion, SERVER_GC_OPTIONS, SERVER_JVM_FLAGS: SERVER_FLAGS } = loadTs("../src/lib/mc/server-launch.ts");
for (const row of fixture.versions) {
  assert.equal(recommendedJavaForVersion(row.id), row.majorVersion, `${row.id}: independently verified Mojang Java runtime`);
  assert.match(row.sha1, /^[a-f0-9]{40}$/);
  counts.runtimeMetadata++;
}

// Fixed controls establish that the real JVM can distinguish supported,
// unavailable, conflicting, experimental and obsolete options. Their expected
// results do not come from the application's compatibility metadata.
for (const [id, args, expected] of [
  ["gc-g1", ["-XX:+UseG1GC"], "accept"],
  ["gc-zgc-generational-default", ["-XX:+UseZGC"], "accept"],
  ["gc-parallel", ["-XX:+UseParallelGC"], "accept"],
  ["gc-serial", ["-XX:+UseSerialGC"], "accept"],
  ["gc-conflict", ["-XX:+UseG1GC", "-XX:+UseZGC"], "reject"],
  ["gc-cms-removed", ["-XX:+UseConcMarkSweepGC"], "reject"],
  ["vm-unknown", ["-XX:+PkqaFlagDoesNotExist"], "reject"],
  ["vm-permsize-removed", ["-XX:PermSize=16m"], "reject"],
  ["vm-aggressiveopts-removed", ["-XX:+AggressiveOpts"], "reject"],
  ["g1-newsize-needs-unlock", ["-XX:+UseG1GC", "-XX:G1NewSizePercent=20"], "reject"],
  ["g1-maxnewsize-needs-unlock", ["-XX:+UseG1GC", "-XX:G1MaxNewSizePercent=60"], "reject"],
  ["g1-mixedlive-needs-unlock", ["-XX:+UseG1GC", "-XX:G1MixedGCLiveThresholdPercent=85"], "reject"],
  ["g1-unlock-order-matters", ["-XX:+UseG1GC", "-XX:G1NewSizePercent=20", "-XX:+UnlockExperimentalVMOptions"], "reject"],
  ["g1-experimental-valid", ["-XX:+UseG1GC", "-XX:+UnlockExperimentalVMOptions", "-XX:G1NewSizePercent=20", "-XX:G1MaxNewSizePercent=60", "-XX:G1MixedGCLiveThresholdPercent=85"], "accept"],
  ["zgenerational-obsolete-on25", ["-XX:+UseZGC", "-XX:+ZGenerational"], "obsolete"],
  ["g1-region-rounds-up", ["-XX:+UseG1GC", "-XX:G1HeapRegionSize=3m"], "accept"],
  ["g1-region-clamps-small-value", ["-XX:+UseG1GC", "-XX:G1HeapRegionSize=512k"], "accept"],
  ["g1-region-invalid-negative-size", ["-XX:+UseG1GC", "-XX:G1HeapRegionSize=-1m"], "reject"],
  ["g1-young-bound-conflict", ["-XX:+UseG1GC", "-XX:+UnlockExperimentalVMOptions", "-XX:G1NewSizePercent=80", "-XX:G1MaxNewSizePercent=20"], "reject"],
]) probe(id, ["-Xms32m", "-Xmx64m", ...args, "-version"], expected);

const base = { version: "26.1", javaVersion: 25, executable: java, jar: "server.jar", platform: "powershell", minMemoryMiB: 256, maxMemoryMiB: 512, collector: "g1", selectedFlags: [], numericValues: {}, nogui: true };
const supported = (flag, collector) => (!flag.javaMin || flag.javaMin <= 25) && (!flag.javaMax || flag.javaMax >= 25) && (!flag.collector || flag.collector === collector) && (!flag.collectors || flag.collectors.includes(collector));
function jvmArgs(input, id, { combined = false } = {}) {
  const output = makeServerLaunch(input);
  assert.deepEqual(output.errors, [], `${id}: product rejected a declared supported profile`);
  assert.ok(Array.isArray(output.javaArgs), `${id}: exported javaArgs are required for native verification`);
  const marker = output.javaArgs.indexOf("-jar");
  assert.ok(marker > 0 && output.javaArgs[marker + 1] === input.jar, `${id}: JVM options must precede -jar`);
  const args = output.javaArgs.slice(0, marker).map((value) => /^-Xms/.test(value) ? "-Xms32m" : /^-Xmx/.test(value) ? "-Xmx64m" : value);
  if (args.some((value) => value.startsWith("-XX:ActiveProcessorCount=")) && !combined) {
    // The option controls the JVM's ergonomic worker counts. Its 1,024-CPU
    // bound is legal, but automatic G1 workers can reserve hundreds of MiB of
    // native marking memory even with a 64 MiB heap. Isolate argument support
    // from host resource exhaustion without altering the tested CPU value.
    // An explicit PrintFlagsFinal control below proves that 1,024 stays active.
    args.push("-XX:ParallelGCThreads=4", "-XX:ConcGCThreads=1");
  }
  const soft = args.find((value) => value.startsWith("-XX:SoftMaxHeapSize="));
  if (soft) {
    // A large soft limit is tested alone with an equally large virtual maximum
    // (no pretouch); aggregate profiles keep all committed heap <=64 MiB.
    if (combined) args[args.indexOf(soft)] = "-XX:SoftMaxHeapSize=32m";
    else {
      const amount = soft.slice(soft.indexOf("=") + 1);
      args[args.findIndex((value) => /^-Xmx/.test(value))] = `-Xmx${amount}`;
    }
  }
  return [...args, "-version"];
}

for (const flag of SERVER_FLAGS) {
  const collector = flag.collector ?? "g1";
  if (!supported(flag, collector)) continue;
  const input = { ...base, collector, selectedFlags: flag.id === "ConcGCThreads" && collector === "g1" ? [flag.id, "ParallelGCThreads"] : [flag.id] };
  probe(`flag-${flag.id}-default`, jvmArgs(input, flag.id), "accept", "flagDefaults");
  if (flag.kind === "number") for (const [label, value] of [["min", flag.min], ["max", flag.max]]) {
    if (value === undefined) continue;
    const bounded = { ...input, numericValues: { [flag.id]: value, ...(flag.id === "ConcGCThreads" && collector === "g1" ? { ParallelGCThreads: Math.max(4, value) } : {}) } };
    // A cross-setting constraint can make one endpoint unavailable when the
    // other setting remains at its default. Those inputs must be rejected by
    // the application and are tested by the pure regression suite instead.
    if (makeServerLaunch(bounded).errors.length) {
      assert.ok((flag.id === "G1NewSizePercent" && label === "max") || (flag.id === "G1MaxNewSizePercent" && label === "min"), `${flag.id}-${label}: unexpected product rejection of a declared bound`);
      continue;
    }
    probe(`flag-${flag.id}-${label}`, jvmArgs(bounded, `${flag.id}-${label}`), "accept", "flagBounds");
  }
}
const activeProcessorControl = probe("active-processors-max-preserved-with-bounded-gc-workers", ["-Xms32m", "-Xmx64m", "-XX:+UseG1GC", "-XX:ActiveProcessorCount=1024", "-XX:ParallelGCThreads=4", "-XX:ConcGCThreads=1", "-XX:+PrintFlagsFinal", "-version"]);
assert.match(activeProcessorControl, /\bActiveProcessorCount\s+=\s+1024\b/, "CPU-bound probe must preserve the catalog maximum");
assert.match(activeProcessorControl, /\bParallelGCThreads\s+=\s+4\b/, "CPU-bound probe must bound ergonomic GC workers");
assert.match(activeProcessorControl, /\bConcGCThreads\s+=\s+1\b/, "CPU-bound probe must bound concurrent GC workers");
for (const option of SERVER_GC_OPTIONS) {
  const collector = option.id;
  const active = SERVER_FLAGS.filter((flag) => supported(flag, collector) && flag.id !== "DisableExplicitGC");
  const input = { ...base, collector, selectedFlags: active.map((flag) => flag.id) };
  // Only documented JVM-major incompatibility may skip a collector; ordinary
  // product errors must fail this gate rather than silently erase coverage.
  if (option.javaMin > 25) continue;
  probe(`collector-${collector}-all-compatible`, jvmArgs(input, collector, { combined: true }), "accept", "collectorProfiles");
}

const report = { java, runtime: runtime.trim(), counts, probes: records.length, failures: records.filter((row) => !row.pass), records, limitations: ["Runtime execution covers installed HotSpot JDK 25 only; Java 8/16/17/21 boundaries use primary documentation and product regression tests.", "No server or plugin was executed; successful -version validates JVM argument acceptance, not workload performance.", "Aggregated profiles clamp heap/SoftMaxHeapSize to 32/64 MiB to avoid expensive pretouch allocations.", "Individual ActiveProcessorCount probes preserve the tested CPU value but explicitly limit G1 workers to 4 parallel / 1 concurrent; this avoids a host-resource stress test and is independently confirmed with PrintFlagsFinal."] };
mkdirSync(join(root, "coverage"), { recursive: true });
writeFileSync(join(root, "coverage", "server-launch-native-result.json"), `${JSON.stringify(report, null, 2)}\n`);
if (report.failures.length) {
  console.error(JSON.stringify(report.failures, null, 2));
  throw new Error(`${report.failures.length} native JVM checks failed`);
}
console.log(`Native server launch audit passed: ${records.length} real JDK 25 probes;`, counts);
