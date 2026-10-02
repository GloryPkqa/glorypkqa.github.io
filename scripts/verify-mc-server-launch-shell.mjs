import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "./mc-test-runtime.mjs";

// The only JAR executed is ServerLaunchArgProbe, compiled below from the
// checked-in small fixture. No Minecraft server, port, EULA or world is used.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const windows = process.platform === "win32";
const suffix = windows ? ".exe" : "";
const cached = join(root, "coverage", "java25");
const cachedHome = existsSync(cached) ? readdirSync(cached).map(name => join(cached, name)).find(path => existsSync(join(path, "bin", `java${suffix}`))) : undefined;
const javaHome = option("--java-home") ?? process.env.JAVA_HOME ?? cachedHome;
const java = javaHome ? join(resolve(javaHome), "bin", `java${suffix}`) : `java${suffix}`;
const javac = javaHome ? join(resolve(javaHome), "bin", `javac${suffix}`) : `javac${suffix}`;
const jarTool = javaHome ? join(resolve(javaHome), "bin", `jar${suffix}`) : `jar${suffix}`;
const env = { ...process.env };
for (const key of ["_JAVA_OPTIONS", "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS"]) delete env[key];
const directory = join(root, "coverage", "server-launch-shell");
const classes = join(directory, "classes");
mkdirSync(classes, { recursive: true });
function run(executable, args, extra = {}) {
  return spawnSync(executable, args, { env, cwd: directory, windowsHide: true, encoding: "utf8", timeout: 20000, maxBuffer: 2 * 1024 * 1024, ...extra });
}
function requireSuccess(id, result) {
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${id}\n${result.stdout}\n${result.stderr}`);
}
const versionProbe = run(java, ["-Xms32m", "-Xmx64m", "-version"]);
requireSuccess("Java fixture runtime", versionProbe);
assert.match(versionProbe.stderr, /(?:version|openjdk) "25\./, "Use JDK 25 (--java-home or JAVA_HOME) for this offline fixture.");
requireSuccess("Compile offline Java fixture", run(javac, ["-encoding", "UTF-8", "-d", classes, join(root, "scripts", "ServerLaunchArgProbe.java")]));
const fixtureJar = join(directory, "fixture.jar");
requireSuccess("Package offline Java fixture", run(jarTool, ["--create", "--file", fixtureJar, "--main-class", "ServerLaunchArgProbe", "-C", classes, "."]));

function findCommand(names) {
  for (const name of names) {
    if (/[\\/]/.test(name) && existsSync(name)) return name;
    const found = run(windows ? "where.exe" : "which", [name]);
    if (found.status === 0) {
      const first = found.stdout.trim().split(/\r?\n/)[0];
      if (first && existsSync(first)) return first;
    }
  }
  return null;
}
const sh = option("--sh") ?? findCommand(windows ? ["sh.exe", "C:/Users/Pkqa/scoop/shims/sh.exe"] : ["sh"]);
const powershells = windows ? [...new Set([findCommand(["pwsh.exe"]), findCommand(["powershell.exe"])].filter(Boolean))] : [];
const cmd = windows ? (process.env.ComSpec ?? "C:/Windows/System32/cmd.exe") : null;
let cygwin = false;
if (sh && windows) cygwin = /CYGWIN|MSYS|MINGW/i.test(run(sh, ["-c", "uname -s"]).stdout);
function shPath(value) {
  if (!windows) return value;
  if (!cygwin) return value.replace(/\\/g, "/");
  const converted = run(sh, ["-c", 'cygpath -u -- "$1"', "path-convert", value]);
  requireSuccess("Convert path for installed Windows POSIX shell", converted);
  return converted.stdout.trim();
}

let aliasedJava = java;
if (javaHome) {
  // Keep separate aliases for each canonical installation. A repeated audit
  // must use the requested JAVA_HOME, rather than retain the previous run's
  // junction. Never remove a real JDK or mutate a link's target in place.
  const canonicalHome = realpathSync(resolve(javaHome));
  const homeKey = createHash("sha256").update(windows ? canonicalHome.toLowerCase() : canonicalHome).digest("hex").slice(0, 16);
  const alias = join(directory, `Java & 中文 O'Neil ’“ ${homeKey}`);
  if (!existsSync(alias)) symlinkSync(resolve(javaHome), alias, windows ? "junction" : "dir");
  assert.equal(realpathSync(alias), canonicalHome, "A fixture alias must resolve to the explicitly selected Java installation.");
  aliasedJava = join(alias, "bin", `java${suffix}`);
}
const { makeServerLaunch } = loadTs("../src/lib/mc/server-launch.ts");
const records = [], unsupported = [];
const counts = { classPathControls: 0, cmdCommands: 0, cmdScripts: 0, cmdOverriddenErrorLevel: 0, powershellCommands: 0, powershellScripts: 0, shCommands: 0, shScripts: 0 };
const normalize = value => realpathSync(value).replace(/\\/g, "/");
const policyBlocked = output => /PSSecurityException|cannot be loaded because running scripts is disabled|not digitally signed|运行脚本.*禁止|禁止.*运行脚本|未.*数字签名|无法加载文件.*脚本/i.test(output)
  // Windows PowerShell 5.1 can emit localized errors in the OEM code page.
  // These three ASCII markers survive decoding; require all of them so an
  // unrelated access-denied file or JVM failure cannot be silently skipped.
  || (/about_Execution_Policies/i.test(output) && /SecurityError/i.test(output) && /UnauthorizedAccess/i.test(output));
assert.equal(policyBlocked("\uFFFD about_Execution_Policies \uFFFD SecurityError \uFFFD UnauthorizedAccess"), true);
assert.equal(policyBlocked("SecurityError UnauthorizedAccess: file is not readable"), false);
assert.equal(policyBlocked("ClassNotFoundException: ServerLaunchArgProbe"), false);
const caseOptions = [
  { id: "spaced-unicode", nogui: true, flags: ["GCLog", "AlwaysPreTouch", "G1NewSizePercent", "G1MaxNewSizePercent"], jarName: "core & 中文 O'Neil ’“.jar" },
  { id: "no-nogui", nogui: false, flags: ["PrintCommandLineFlags"], jarName: "plain server.jar" },
  { id: "literal-shell-syntax", nogui: true, flags: ["GCLog"], jarName: windows ? "$(echo marker) `literal` %name% !bang!.jar" : "$(touch marker);`literal` 'single' *.jar" },
];
// Even correctly passed argv cannot make a JAR path containing the operating
// system's class-path delimiter load its main class. Freeze that native negative
// control so the product's new error cannot regress into a quoting workaround.
const delimiterJar = join(directory, windows ? "class;path.jar" : "class:path.jar");
copyFileSync(fixtureJar, delimiterJar);
const delimiter = run(java, ["-Xms32m", "-Xmx64m", "-jar", delimiterJar]);
assert.ifError(delimiter.error);
assert.equal(delimiter.status, 1);
assert.match(delimiter.stderr, /ClassNotFoundException/);
records.push({ id: "native/classpath-separator-negative", category: "classPathControls", pass: true, exitCode: delimiter.status, expected: "ClassNotFoundException", output: delimiter.stderr });
counts.classPathControls++;
function verify(id, result, expected, category, mayBePolicyBlocked = false) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (mayBePolicyBlocked && policyBlocked(output)) {
    unsupported.push({ id, reason: "Existing PowerShell execution policy refused the unsigned fixture; policy was not changed.", exitCode: result.status, output });
    return;
  }
  assert.ifError(result.error);
  const match = output.match(/^MC_LAUNCH_PROBE=(\{.*\})\r?$/m);
  let evidence;
  try {
    assert.ok(match, `${id}: expected offline fixture output\n${output}`);
    evidence = JSON.parse(match[1]);
    assert.equal(result.status, 7, `${id}: script / wrapper must preserve native exit 7\n${output}`);
    assert.deepEqual(evidence.arguments, expected.nogui ? ["nogui"] : [], `${id}: literal program arguments`);
    assert.deepEqual(evidence.jvmArguments, expected.activeFlags, `${id}: native JVM options were expanded, split or lost`);
    assert.equal(normalize(evidence.jar), normalize(expected.jarPath), `${id}: quoted JAR path changed`);
    assert.equal(normalize(evidence.cwd), normalize(expected.cwd), `${id}: working directory`);
    assert.equal(evidence.exitCode, 7);
    assert.match(evidence.javaVersion, /^25\./);
    records.push({ id, category, pass: true, exitCode: result.status, evidence });
    counts[category]++;
  } catch (error) {
    records.push({ id, category, pass: false, exitCode: result.status, output, evidence, error: error.message });
  }
}
function cmdInvocation(command, cwd, overrideEnv = env) {
  // Explicit /d disables user AutoRun hooks. /v:on proves the downloaded script
  // correctly disables inherited delayed expansion. Verbatim mode gives cmd its
  // documented /s /c pair of outer quotes, without Node adding another layer.
  return run(cmd, ["/d", "/v:on", "/s", "/c", `"${command}"`], { cwd, env: overrideEnv, windowsVerbatimArguments: true });
}

const platforms = [cmd && "cmd", powershells.length && "powershell", sh && "sh"].filter(Boolean);
assert.ok(platforms.length, "At least one existing shell is required.");
for (const platform of platforms) {
  for (const row of caseOptions) {
    // CMD cannot safely represent percent / exclamation path text in a copied
    // one-line command; its explicit rejection is covered by the logic suite.
    if (platform === "cmd" && row.id === "literal-shell-syntax") continue;
    const folder = join(directory, `${platform}-${row.id} & 中文 O'Neil !parent! %folder%`);
    const caller = join(folder, "caller");
    mkdirSync(caller, { recursive: true });
    const jarPath = join(folder, row.jarName);
    copyFileSync(fixtureJar, jarPath);
    // A literal relative JAR name is sufficient: downloaded scripts move to
    // their own directory; copied commands are run from that same directory.
    const executable = platform === "sh" ? shPath(aliasedJava) : aliasedJava;
    const out = makeServerLaunch({ version: "26.1", javaVersion: 25, executable, jar: row.jarName, platform,
      minMemoryMiB: 32, maxMemoryMiB: 64, collector: "g1", selectedFlags: row.flags, numericValues: {}, nogui: row.nogui });
    assert.deepEqual(out.errors, [], `${platform}/${row.id}: supported fixture rejected`);
    const scriptPath = join(folder, `start${out.extension}`);
    writeFileSync(scriptPath, platform === "powershell" ? `\uFEFF${out.script}` : out.script, "utf8");
    const expected = { nogui: row.nogui, activeFlags: out.activeFlags, jarPath, cwd: folder };
    if (platform === "cmd") {
      verify(`${platform}/${row.id}/command`, cmdInvocation(out.command, folder), expected, "cmdCommands");
      verify(`${platform}/${row.id}/script`, cmdInvocation('"..\\start.bat"', caller), expected, "cmdScripts");
      if (row.id === "spaced-unicode") verify(`${platform}/${row.id}/script-errorlevel-environment`, cmdInvocation('"..\\start.bat"', caller, { ...env, ERRORLEVEL: "0" }), expected, "cmdOverriddenErrorLevel");
    } else if (platform === "powershell") {
      for (const shell of powershells) {
        const variant = /(?:^|[\\/])pwsh(?:\.exe)?$/i.test(shell) ? "pwsh" : "windows-powershell";
        verify(`${variant}/${row.id}/command`, run(shell, ["-NoProfile", "-NonInteractive", "-Command", `${out.command}; exit $LASTEXITCODE`], { cwd: folder }), expected, "powershellCommands");
        verify(`${variant}/${row.id}/script`, run(shell, ["-NoProfile", "-NonInteractive", "-File", scriptPath], { cwd: caller }), expected, "powershellScripts", true);
      }
    } else {
      verify(`${platform}/${row.id}/command`, run(sh, ["-c", out.command], { cwd: folder }), expected, "shCommands");
      verify(`${platform}/${row.id}/script`, run(sh, [shPath(scriptPath)], { cwd: caller }), expected, "shScripts");
    }
    // The only JVM side effect selected is its known GC log file. A literal
    // glob and command-substitution JAR name must never create this marker.
    assert.equal(existsSync(join(folder, "marker")), false, `${platform}/${row.id}: shell syntax executed`);
    if (row.flags.includes("GCLog")) assert.ok(readdirSync(folder).some(name => /^gc\.log/.test(name)), `${platform}/${row.id}: quoted GC log option was not used`);
  }
}
const failures = records.filter(record => !record.pass);
const summary = { verifiedAt: new Date().toISOString(), fixture: "scripts/ServerLaunchArgProbe.java", java, platforms, counts, probes: records.length, failures, unsupported, records };
writeFileSync(join(root, "coverage", "server-launch-shell-result.json"), JSON.stringify(summary, null, 2));
assert.deepEqual(failures.map(failure => ({ id: failure.id, error: failure.error })), [], "Actual shell launch failures");
console.log(`Server launch shell audit passed: ${records.length} real offline JAR invocations (${platforms.join(", ")}); ${unsupported.length} execution-policy limitations.`);
