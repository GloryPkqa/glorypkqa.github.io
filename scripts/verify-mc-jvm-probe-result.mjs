import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { jvmProbePassed } from "./mc-jvm-probe-result.mjs";

export function verifyJvmProbeClassifier() {
  // Fixed messages were captured from the real Java 8/17/21/25 controls.
  // They are independent of the site's option metadata and generated argv.
  const nativeRejections = [
    "Unrecognized VM option 'PkqaFlagDoesNotExist'",
    "Unrecognized option: -Xlog:gc",
    "Conflicting collector combinations in option list; please refer to the release notes for the combinations allowed",
    "Error occurred during initialization of VM\nMultiple garbage collectors selected",
    "Error: VM option 'G1NewSizePercent' is experimental and must be enabled via -XX:+UnlockExperimentalVMOptions.",
    "Error: The unlock option must precede 'G1NewSizePercent'.",
    "Improperly specified VM option 'G1HeapRegionSize=-1m'",
    "uintx G1ReservePercent=200 is outside the allowed range [ 0 ... 50 ]",
    "G1MaxNewSizePercent (20) must be greater than or equal to G1NewSizePercent (80)",
    "G1NewSizePercent (80) must be less than or equal to G1MaxNewSizePercent (20)",
  ];
  let checks = 0;
  const check = (result, expected, pass, label) => { assert.equal(jvmProbePassed(result, expected), pass, label); checks++; };
  for (const stderr of nativeRejections) check({ status: 1, signal: null, stderr }, "reject", true, stderr);
  const rejected = nativeRejections[0];
  for (const stderr of ["", "Error: Could not create the Java Virtual Machine.", "Error occurred during initialization of VM", "Error: A fatal exception has occurred. Program will exit."]) check({ status: 1, signal: null, stderr }, "reject", false, `Generic process failure: ${stderr}`);
  for (const stderr of [
    "There is insufficient memory for the Java Runtime Environment to continue.",
    "Native memory allocation (malloc) failed to allocate 268435456 bytes for mark overflow stack",
    "Could not reserve enough space for object heap",
    "java.lang.OutOfMemoryError: unable to create native thread",
    "A fatal error has been detected by the Java Runtime Environment: EXCEPTION_ACCESS_VIOLATION",
    "Problematic frame: SIGSEGV; hs_err_pid123.log",
  ]) check({ status: 1, signal: null, stderr: `${rejected}\n${stderr}` }, "reject", false, stderr);
  for (const result of [
    { status: null, signal: "SIGTERM", stderr: rejected },
    { status: 1, signal: "SIGKILL", stderr: rejected },
    { status: null, signal: null, stderr: rejected },
    { status: "1", signal: null, stderr: rejected },
    { status: 1, signal: null, error: new Error("ETIMEDOUT"), stderr: rejected },
    { status: 0, signal: null, stderr: rejected },
  ]) check(result, "reject", false, "Abnormal/malformed termination never proves option rejection");
  check({ status: 0, signal: null, stderr: 'openjdk version "21"' }, "accept", true, "Normal runtime output");
  check({ status: 0, signal: null, stdout: "bool HeapDumpOnOutOfMemoryError = false\nbool ExitOnOutOfMemoryError = false" }, "accept", true, "PrintFlagsFinal option names are not actual OOM failures");
  check({ status: 0, signal: null, stderr: "warning: Option PrintGCDetails was deprecated" }, "accept", true, "Deprecated yet active option remains accepted");
  check({ status: 0, signal: null, stderr: "Warning: Ignoring option ZGenerational; support was removed in 24.0" }, "obsolete", true, "Explicit ignored-option control");
  check({ status: 0, signal: null, stderr: "Warning: Ignoring option ZGenerational; support was removed in 24.0" }, "accept", false, "Ignored is not active");
  check({ status: 0, signal: null, stderr: 'openjdk version "21"' }, "obsolete", false, "Obsolete expectation requires evidence");
  check({ status: 0, signal: "SIGTERM", stderr: 'openjdk version "21"' }, "accept", false, "Signal cannot be an acceptance");

  // A real child that terminates itself supplies independent process evidence:
  // Linux/macOS return a signal and Windows may instead report numeric exit 1.
  const terminated = spawnSync(process.execPath, ["-e", 'process.kill(process.pid, "SIGTERM")'], { encoding: "utf8", windowsHide: true, timeout: 5000 });
  assert.ok(!terminated.error, `Self-termination control could not run: ${terminated.error?.message}`);
  assert.ok(terminated.signal || terminated.status !== 0, "The control must actually terminate abnormally");
  check(terminated, "reject", false, "Real abnormal termination is not a HotSpot option rejection");
  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(`JVM probe classification checks passed: ${verifyJvmProbeClassifier()}`);
