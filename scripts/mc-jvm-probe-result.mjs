// A failed process is not sufficient evidence that HotSpot rejected an option.
// Signals, VM crashes and host memory exhaustion must fail the audit itself.
const argumentRejections = [
  /^Unrecognized (?:VM )?option[ :]/im,
  /^Improperly specified VM option[ :]/im,
  /^(?:Error: )?VM option '[^\r\n]+' is (?:experimental|diagnostic) and must be enabled via /im,
  /^(?:Error: )?The unlock option must precede '[^\r\n]+'/im,
  /^(?:Conflicting collector combinations in option list|Multiple garbage collectors selected)\b/im,
  /^\w+(?:\s+\w+)?=.* is outside the allowed range\b/im,
  /^[A-Za-z][A-Za-z0-9_]* \([^\r\n)]+\) must be (?:greater than or equal to|less than or equal to) [A-Za-z][A-Za-z0-9_]* \(/m,
];
const infrastructureFailure = /\bOutOfMemoryError\b|insufficient memory|not enough memory|Cannot allocate memory|Could not reserve enough space|Native memory allocation|unable to create native thread|fatal error has been detected|EXCEPTION_ACCESS_VIOLATION|SIGSEGV|SIGBUS|hs_err_pid/i;
const ignoredOption = /ignoring option|obsolete|support was removed/i;

export function jvmProbePassed(result, expected = "accept") {
  if (result.error || result.signal || !Number.isInteger(result.status)) return false;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (infrastructureFailure.test(output)) return false;
  if (expected === "reject") return result.status !== 0 && argumentRejections.some(pattern => pattern.test(output));
  if (expected === "obsolete") return result.status === 0 && ignoredOption.test(output);
  if (expected !== "accept") throw new Error(`Unknown JVM probe expectation: ${expected}`);
  return result.status === 0 && !ignoredOption.test(output) && !argumentRejections.some(pattern => pattern.test(output));
}
