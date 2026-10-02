import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadTs } from "./mc-test-runtime.mjs";

const { makeServerLaunch, recommendedJavaForVersion, SERVER_GC_OPTIONS, SERVER_JVM_FLAGS, SERVER_JVM_GROUPS, flagSupportReason, formatServerFlag } = loadTs("../src/lib/mc/server-launch.ts");
const counts = { fixedCommands: 0, versionMatrix: 0, memoryInputs: 0, pathInputs: 0, flagInputs: 0, dependencies: 0, scriptContracts: 0 };
const base = { version: "26.1", javaVersion: 25, executable: "java", jar: "server.jar", platform: "cmd", minMemoryMiB: 1024, maxMemoryMiB: 2048, collector: "default", selectedFlags: [], numericValues: {}, nogui: true };
const ok = (changes = {}) => {
  const out = makeServerLaunch({ ...base, ...changes });
  assert.deepEqual(out.errors, [], JSON.stringify(changes));
  assert.ok(out.command && out.script); assert.ok(out.javaArgs.includes("-jar"));
  return out;
};
const bad = (changes, message) => {
  const out = makeServerLaunch({ ...base, ...changes });
  assert.ok(out.errors.length, JSON.stringify(changes));
  if (message) assert.match(out.errors.join("\n"), message);
  assert.equal(out.command, ""); assert.equal(out.script, "");
  assert.deepEqual(out.javaArgs, []); assert.deepEqual(out.activeFlags, []);
  return out;
};

// Fixed expectations are handwritten, rather than re-derived from the catalog.
for (const [platform, command, extension] of [
  ["cmd", '"java" "-Xms1024m" "-Xmx2048m" -jar "server.jar" nogui', ".bat"],
  ["powershell", "& 'java' '-Xms1024m' '-Xmx2048m' -jar 'server.jar' nogui", ".ps1"],
  ["sh", "'java' '-Xms1024m' '-Xmx2048m' -jar 'server.jar' nogui", ".sh"],
]) {
  const out = ok({ platform }); assert.equal(out.command, command); assert.equal(out.extension, extension);
  assert.deepEqual(out.javaArgs, ["-Xms1024m", "-Xmx2048m", "-jar", "server.jar", "nogui"]);
  assert.equal(ok({ platform, nogui: false }).command, command.replace(/ nogui$/, ""));
  counts.fixedCommands += 2;
}
const runtime = { "26.1": 25, "1.21.8": 21, "1.21.5": 21, "1.20.6": 21, "1.20.4": 17, "1.17": 16, "1.16.5": 8, "1.12.2": 8, "1.8.9": 8 };
for (const [version, javaVersion] of Object.entries(runtime)) {
  assert.equal(recommendedJavaForVersion(version), javaVersion);
  for (const platform of ["cmd", "powershell", "sh"]) {
    for (const collector of ["default", "g1", "zgc", "parallel", "serial"]) {
      if (collector === "zgc" && javaVersion < 17) bad({ version, javaVersion, platform, collector }, /Java 17/);
      else {
        const out = ok({ version, javaVersion, platform, collector });
        const chosen = out.activeFlags.filter(f => /^-XX:\+Use(?:G1|Z|Parallel|Serial)GC$/.test(f));
        assert.equal(chosen.length, collector === "default" ? 0 : 1);
      }
      counts.versionMatrix++;
    }
  }
  if (javaVersion >= 16) { bad({ version, javaVersion: javaVersion - 1 }, /需要 Java/); counts.versionMatrix++; }
  if (javaVersion < 25) { assert.match(ok({ version, javaVersion: 25 }).warnings.join("\n"), /官方运行时/); counts.versionMatrix++; }
}
for (const version of ["1.16.7", "latest", "__proto__", "", "26.2"]) { assert.equal(recommendedJavaForVersion(version), null); bad({ version }); counts.versionMatrix++; }
for (const javaVersion of [0, 7, 26, 25.1, NaN, Infinity, "25", ""]) { bad({ javaVersion }); counts.versionMatrix++; }
bad({ collector: "UseG1GC -jar evil.jar" }); bad({ platform: "bash; touch evil" }); counts.versionMatrix += 2;

for (const field of ["minMemoryMiB", "maxMemoryMiB", "physicalMemoryMiB"]) {
  for (const value of ["", " ", "1e3", "0x400", "1m", "-1", "0", "15", "16777217", "1.5", "NaN", "Infinity", "1024;echo evil", NaN, Infinity, -1, 1.5]) {
    if (field === "physicalMemoryMiB" && value === "") { ok({ [field]: value }); }
    else bad({ [field]: value });
    counts.memoryInputs++;
  }
}
bad({ minMemoryMiB: 2049, maxMemoryMiB: 2048 }, /不能超过/); counts.memoryInputs++;
for (const values of [{ minMemoryMiB: "001024", maxMemoryMiB: "02048" }, { minMemoryMiB: 16, maxMemoryMiB: 16 }, { minMemoryMiB: 1024, maxMemoryMiB: 16777216 }, { physicalMemoryMiB: undefined }, { physicalMemoryMiB: "" }]) { ok(values); counts.memoryInputs++; }
assert.match(ok({ physicalMemoryMiB: 2048 }).warnings.join("\n"), /物理内存/);
assert.match(ok({ physicalMemoryMiB: 2500 }).warnings.join("\n"), /余量较小/);
assert.ok(!ok({ physicalMemoryMiB: 8192 }).warnings.some(w => /内存.*余量较小|堆已达到/.test(w))); counts.memoryInputs += 3;

// Injection-bearing paths are either preserved literally by shell quoting, or
// explicitly rejected where CMD expansion prevents one-line representation.
for (const platform of ["cmd", "powershell", "sh"]) {
  for (const field of ["jar", "executable"]) {
    for (const value of ["", " java", "java ", "bad\nvalue.jar", "bad\rvalue.jar", "bad\0value.jar", "bad\tvalue.jar", "x".repeat(4097)]) {
      bad({ platform, [field]: value }); counts.pathInputs++;
    }
    if (platform === "cmd") for (const value of ["%TEMP%/server.jar", "!evil!/server.jar", 'x" & echo evil & "y.jar', "x|y.jar", "x>y.jar", "x<y.jar", "x*y.jar", "x?y.jar"]) {
      bad({ platform, [field]: value }); counts.pathInputs++;
    }
  }
  for (const jar of ["args.txt", "server.jar --help", "@evil.jar", "server.JAR.exe"]) { bad({ platform, jar }); counts.pathInputs++; }
  for (const executable of ["run.bat", "run.cmd", "run.ps1", "run.sh", "C:\\Java\\", "/usr/bin/"]) { bad({ platform, executable }); counts.pathInputs++; }
  ok({ platform, jar: "./@server.jar" }); counts.pathInputs++;
}
const cmd = ok({ executable: "C:\\Java (64)&^\\bin\\java.exe", jar: "中文 & (one)^.jar" });
assert.ok(cmd.command.includes('"C:\\Java (64)&^\\bin\\java.exe"'));
assert.ok(cmd.command.includes('"中文 & (one)^.jar"')); counts.pathInputs++;
const ps = ok({ platform: "powershell", executable: "C:\\O’Neil\\java.exe", jar: "O'Neil ‘x’ $(echo evil) `echo.jar" });
assert.ok(ps.command.includes("C:\\O’’Neil\\java.exe"));
assert.ok(ps.command.includes("O''Neil ‘‘x’’ $(echo evil) `echo.jar")); counts.pathInputs++;
const sh = ok({ platform: "sh", executable: "/Java's/bin/java", jar: "'$(touch evil); `echo evil` *.jar" });
assert.ok(sh.command.includes(`'/Java'"'"'s/bin/java'`));
assert.ok(sh.command.includes(`''"'"'$(touch evil); \`echo evil\` *.jar'`)); counts.pathInputs++;
const log = ok({ platform: "sh", selectedFlags: ["GCLog"] });
assert.ok(log.command.includes("'-Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=5,filesize=10M'")); counts.pathInputs++;
for (const platform of ["cmd", "powershell", "sh"]) {
  for (const jar of platform === "sh" ? ["name:separator.jar", "/tmp/parent:directory/server.jar"] : ["name;separator.jar", "C:\\parent;directory\\server.jar"]) {
    bad({ platform, jar }, /类路径分隔符/); counts.pathInputs++;
  }
}

assert.equal(new Set(SERVER_JVM_FLAGS.map(flag => flag.id)).size, SERVER_JVM_FLAGS.length);
assert.ok(SERVER_JVM_FLAGS.length >= 30);
assert.equal(new Set(SERVER_JVM_GROUPS.map(group => group.id)).size, SERVER_JVM_GROUPS.length);
for (const flag of SERVER_JVM_FLAGS) {
  assert.ok(SERVER_JVM_GROUPS.some(group => group.id === flag.group));
  const javaVersion = flag.javaMax === 8 ? 8 : flag.id === "ZGenerational" ? 21 : 25;
  const version = javaVersion === 8 ? "1.16.5" : javaVersion === 21 ? "1.21.8" : "26.1";
  const collector = flag.collector ?? flag.collectors?.[0] ?? "default";
  const deps = flag.id === "ConcGCThreads" && collector === "g1" ? ["ParallelGCThreads"] : flag.id === "PrintGCDateStamps" ? ["PrintGCDetails"] : [];
  const selection = { version, javaVersion, collector, selectedFlags: [flag.id, ...deps] };
  const out = ok(selection);
  assert.ok(out.activeFlags.includes(formatServerFlag(flag, flag.defaultValue, javaVersion)));
  if (flag.experimental) assert.ok(out.activeFlags.indexOf("-XX:+UnlockExperimentalVMOptions") < out.activeFlags.findIndex(a => a.startsWith(`-XX:${flag.id}=`)));
  counts.flagInputs++;
  if (flag.kind === "number") {
    for (const value of ["", "1.5", "1e3", "0x10", "1m", "Infinity", "1;echo evil", -1, NaN, Infinity, flag.max + 1]) {
      bad({ ...selection, numericValues: { [flag.id]: value } }); counts.flagInputs++;
    }
  }
  for (const major of [8, 11, 16, 17, 21, 23, 24, 25]) {
    const reason = flagSupportReason(flag, major, collector);
    if (reason) { bad({ ...selection, version: major >= 25 ? "26.1" : "1.8.9", javaVersion: major }, undefined); counts.flagInputs++; }
  }
  if (flag.collector || flag.collectors) { bad({ ...selection, collector: "serial" }); counts.flagInputs++; }
}
for (const selectedFlags of [["PkqaInvalidFlag"], ["UseG1GC", "UseZGC"], ["-Xmx999999m"], ["GCLog;echo evil"], ["UnlockExperimentalVMOptions"], ["__proto__"]]) { bad({ selectedFlags }); counts.flagInputs++; }
const deduplicated = ok({ selectedFlags: ["PrintCommandLineFlags", "PrintCommandLineFlags"] });
assert.equal(deduplicated.activeFlags.filter(flag => flag === "-XX:+PrintCommandLineFlags").length, 1); counts.flagInputs++;

for (const [values, pattern] of [
  [{ collector: "g1", selectedFlags: ["DisableExplicitGC", "ExplicitGCInvokesConcurrent"] }, /不能同时/],
  [{ version: "1.8.9", javaVersion: 8, selectedFlags: ["PrintGCDateStamps"] }, /同时勾选/],
  [{ collector: "g1", selectedFlags: ["ConcGCThreads"] }, /同时设置/],
  [{ collector: "g1", selectedFlags: ["ConcGCThreads", "ParallelGCThreads"], numericValues: { ConcGCThreads: 3, ParallelGCThreads: 2 } }, /不能超过/],
  [{ collector: "g1", selectedFlags: ["G1NewSizePercent"], numericValues: { G1NewSizePercent: 61 } }, /最小比例/],
  [{ collector: "g1", selectedFlags: ["G1MaxNewSizePercent"], numericValues: { G1MaxNewSizePercent: 4 } }, /最小比例/],
  [{ collector: "g1", selectedFlags: ["G1NewSizePercent", "G1MaxNewSizePercent"], numericValues: { G1NewSizePercent: 50, G1MaxNewSizePercent: 49 } }, /最小比例/],
  [{ collector: "g1", selectedFlags: ["G1HeapRegionSize"], numericValues: { G1HeapRegionSize: 3 } }, /只能是/],
  [{ collector: "g1", selectedFlags: ["G1HeapRegionSize"], numericValues: { G1HeapRegionSize: 32 }, maxMemoryMiB: 16, minMemoryMiB: 16 }, /不能超过最大堆/],
]) { bad(values, pattern); counts.dependencies++; }
for (const javaVersion of [17, 24, 25]) { bad({ version: "1.8.9", javaVersion, collector: "zgc", selectedFlags: ["ZGenerational"] }); counts.dependencies++; }
for (const javaVersion of [21, 22, 23]) { ok({ version: "1.21.8", javaVersion, collector: "zgc", selectedFlags: ["ZGenerational"] }); counts.dependencies++; }
assert.match(ok({ collector: "zgc", minMemoryMiB: 2048, maxMemoryMiB: 2048, selectedFlags: ["ZUncommitDelay"] }).warnings.join("\n"), /初始堆与最大堆相同/); counts.dependencies++;
assert.match(ok({ version: "1.8.9", javaVersion: 8, selectedFlags: ["ExitOnOutOfMemoryError"] }).warnings.join("\n"), /8u92/); counts.dependencies++;
assert.match(ok({ version: "1.8.9", javaVersion: 8, collector: "g1", selectedFlags: ["UseStringDeduplication"] }).warnings.join("\n"), /8u20/); counts.dependencies++;

for (const platform of ["cmd", "powershell", "sh"]) {
  const out = ok({ platform });
  assert.ok(!/eula\s*=\s*true|Set-ExecutionPolicy|netsh|firewall|chmod|sudo/i.test(out.script));
  assert.equal(out.script.includes("\uFEFF"), false); // PS1 BOM belongs to the download encoding.
  assert.match(out.warnings.join("\n"), /Forge.*args\.txt/);
  if (platform === "cmd") {
    assert.ok(out.script.startsWith("@echo off\r\nsetlocal DisableDelayedExpansion\r\nset \"ERRORLEVEL=\"\r\nchcp 65001 >nul\r\n"));
    assert.match(out.script, /pushd "%~dp0" \|\| exit \/b 1/);
    assert.match(out.script, /exit \/b %MC_LAUNCH_EXIT%/);
  } else if (platform === "powershell") {
    assert.match(out.script, /Set-Location -LiteralPath \$PSScriptRoot/);
    assert.match(out.script, /exit \$LASTEXITCODE/);
  } else {
    assert.ok(out.script.startsWith("#!/bin/sh\n"));
    assert.ok(out.script.includes('CDPATH= cd -P "$mc_dir" || exit 1'));
    assert.ok(out.script.includes(`exec ${out.command}`));
  }
  counts.scriptContracts++;
}
// The catalog deliberately limits values to a useful supported subset. The
// separate native script uses independent positive and negative HotSpot controls.
const total = Object.values(counts).reduce((a, b) => a + b, 0);
mkdirSync("coverage", { recursive: true });
writeFileSync("coverage/server-launch-result.json", JSON.stringify({ total, counts, flags: SERVER_JVM_FLAGS.length, gc: SERVER_GC_OPTIONS.length, versions: Object.keys(runtime).length }, null, 2));
// If present, the independently downloaded metadata fixture must also agree.
try {
  const evidence = JSON.parse(readFileSync(new URL("./fixtures/mc-server-java-runtime.json", import.meta.url), "utf8"));
  for (const entry of evidence.versions) assert.equal(recommendedJavaForVersion(entry.id), entry.majorVersion);
} catch (error) { if (error.code !== "ENOENT") throw error; }
console.log(`Server launch verification passed: ${total} scenarios (${SERVER_JVM_FLAGS.length} flags, 9 MC versions, 3 shells).`);
