import { versionAtLeast } from "@/lib/mc/give";

type NbtType = "byte" | "short" | "int" | "long" | "float" | "double" | "string" | "compound" | "list" | "BArray" | "IArray" | "LArray";
type NbtValue = { type: NbtType; string?: string };
const integerTypes: NbtType[] = ["byte", "short", "int", "long"];
const width: Record<string, number> = { byte: 8, short: 16, int: 32, long: 64 };
const typeSuffix: Record<string, NbtType> = { b: "byte", s: "short", i: "int", l: "long" };
const digitRun = "[0-9]+(?:_+[0-9]+)*";
const modernFloat = new RegExp(`^[+-]?(?:(?:${digitRun})(?:\\.(?:${digitRun})?)?|\\.(?:${digitRun}))(?:[eE][+-]?(?:${digitRun}))?([fFdD])?$`);
const oldFloat = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?([fFdD])?$/;
export const commandWhitespace = /[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]/;
export const isCommandWhitespace = (char: string) => commandWhitespace.test(char);
export function trimCommandWhitespace(value: string) {
  let first = 0, last = value.length;
  while (first < last && isCommandWhitespace(value[first])) first++;
  while (last > first && isCommandWhitespace(value[last - 1])) last--;
  return value.slice(first, last);
}

// Character names depend on the server JDK. Browsers have no equivalent of
// Character.codePointOf: explain this unsupported syntax rather than accepting
// an unknown name or claiming Vanilla rejects a valid one.
export function targetNbtUnsupportedHint(source: string) {
  if (!/\bnbt\s*=/.test(source)) return "";
  for (let index = 0; index < source.length; index++) {
    if (source[index] !== "\\") continue;
    if (source[index + 1] === "N" && source[index + 2] === "{") return "暂不支持按 Unicode 字符名称转义；请直接使用字符，或改用 \\u / \\U 数字转义。";
    index++;
  }
  return "";
}

function inIntegerRange(value: bigint, type: NbtType, unsigned: boolean) {
  const bits = BigInt(width[type]);
  const one = BigInt(1), zero = BigInt(0);
  return unsigned ? value >= zero && value < (one << bits) : value >= -(one << (bits - one)) && value < (one << (bits - one));
}

function numeric(token: string, expanded: boolean, assumed?: NbtType): NbtValue | null {
  const float = (expanded ? modernFloat : oldFloat).exec(token);
  if (float && (float[1] || /[.eE]/.test(token))) {
    const type = float[1]?.toLowerCase() === "f" ? "float" : "double";
    const number = Number(token.replaceAll("_", "").replace(/[fFdD]$/, ""));
    if (expanded && (!Number.isFinite(number) || (type === "float" && !Number.isFinite(Math.fround(number))))) return null;
    return { type };
  }
  if (!expanded) {
    const legacy = /^([+-]?\d+)([bBsSlL])?$/.exec(token);
    if (!legacy) return { type: "string", string: token };
    const type = legacy[2] ? typeSuffix[legacy[2].toLowerCase()] : "int";
    try { return inIntegerRange(BigInt(legacy[1]), type, false) ? { type } : { type: "string", string: token }; } catch { return { type: "string", string: token }; }
  }
  // Hexadecimal b is a digit: 0x11b is an int (283), while 0x11ub is a byte.
  const radix = /^([+-]?)0([xXbB])([\da-fA-F]+(?:_+[\da-fA-F]+)*)([sSuU]?[bBsSiIlL])?$/.exec(token);
  const decimal = /^([+-]?(?:0|[1-9]\d*(?:_+\d+)*))([sSuU]?[bBsSiIlL])?$/.exec(token);
  let suffix: string, value: bigint, unsigned: boolean;
  try {
    if (radix) {
      const digits = radix[3].replaceAll("_", ""); suffix = radix[4]?.toLowerCase() ?? "";
      if (radix[2].toLowerCase() === "b" && !/^[01]+$/.test(digits)) return null;
      value = BigInt(`0${radix[2].toLowerCase()}${digits}`);
      if (radix[1] === "-") value = -value;
      unsigned = !suffix.startsWith("s");
    } else if (decimal) {
      suffix = decimal[2]?.toLowerCase() ?? "";
      value = BigInt(decimal[1].replaceAll("_", "")); unsigned = suffix.startsWith("u");
    } else return null;
  } catch { return null; }
  if (unsigned && token.startsWith("-")) return null;
  const type = suffix ? typeSuffix[suffix.at(-1)!] : assumed ?? "int";
  return inIntegerRange(value, type, unsigned) ? { type } : null;
}

// UUID.fromString accepts short groups and masks oversized groups. Its fallback
// requires five positive hexadecimal longs and a total of at most 36 chars.
function uuidString(value: string) {
  if (value.length > 36) return false;
  const groups = value.split("-");
  if (groups.length !== 5) return false;
  return groups.every((group) => {
    if (!/^\+?[a-fA-F0-9]+$/.test(group)) return false;
    try { return BigInt(`0x${group.replace(/^\+/, "")}`) <= BigInt("0x7fffffffffffffff"); } catch { return false; }
  });
}

export function compoundNbt(source: string, version: string) {
  let index = 0;
  const expanded = versionAtLeast(version, "1.21.5");
  const space = () => { while (index < source.length && isCommandWhitespace(source[index])) index++; };
  function quoted(): string | null {
    const quote = source[index++]; let result = "";
    while (index < source.length) {
      const char = source[index++];
      if (char === quote) return result;
      if (char !== "\\") { result += char; continue; }
      if (index >= source.length) return null;
      const escape = source[index++];
      if (escape === "\\" || escape === quote || (expanded && ["'", '"'].includes(escape))) { result += escape; continue; }
      const simple: Record<string, string> = { b: "\b", s: " ", t: "\t", n: "\n", f: "\f", r: "\r" };
      if (expanded && Object.hasOwn(simple, escape)) { result += simple[escape]; continue; }
      const digits = expanded ? ({ x: 2, u: 4, U: 8 } as Record<string, number>)[escape] : 0;
      if (!digits) return null;
      const hex = source.slice(index, index + digits);
      if (hex.length !== digits || !/^[a-fA-F0-9]+$/.test(hex) || (escape === "U" && Number.parseInt(hex, 16) > 0x10ffff)) return null;
      result += String.fromCodePoint(Number.parseInt(hex, 16)); index += digits;
    }
    return null;
  }
  function token() { const start = index; while (index < source.length && /[A-Za-z0-9_.+-]/.test(source[index])) index++; return source.slice(start, index); }
  function value(depth: number, arrayType?: NbtType): NbtValue | null {
    if (depth > 512) return null;
    space();
    if (source[index] === '"' || source[index] === "'") { const string = quoted(); return string === null ? null : { type: "string", string }; }
    const open = source[index];
    if (open !== "{" && open !== "[") {
      const raw = token(); if (!raw) return null;
      space();
      if (expanded && source[index] === "(") {
        if (arrayType || !["bool", "uuid"].includes(raw)) return null;
        index++; const arg = value(depth + 1); space();
        if (source[index] === ",") { index++; space(); }
        if (!arg || source[index++] !== ")") return null;
        if (raw === "uuid") return arg.type === "string" && uuidString(arg.string ?? "") ? { type: "IArray" } : null;
        return integerTypes.includes(arg.type) || ["float", "double"].includes(arg.type) ? { type: "byte" } : null;
      }
      if (/^[0-9.+-]/.test(raw)) return numeric(raw, expanded, arrayType);
      if (!expanded && /^true$|^false$/i.test(raw)) return { type: "byte" };
      if (expanded && !arrayType && (raw === "true" || raw === "false")) return { type: "byte" };
      return { type: "string", string: raw };
    }
    if (arrayType) return null;
    index++; space(); const close = open === "{" ? "}" : "]";
    let typed: NbtType | undefined, type: NbtType = open === "{" ? "compound" : "list";
    if (open === "[" && /[BIL]/.test(source[index] ?? "")) {
      const start = index, prefix = source[index++]; space();
      if (source[index] === ";") { index++; space(); typed = prefix === "B" ? "byte" : prefix === "I" ? "int" : "long"; type = `${prefix}Array` as NbtType; }
      else index = start;
    }
    if (source[index] === close) { index++; return { type }; }
    let listType: NbtType | undefined;
    while (index < source.length) {
      if (open === "{") {
        const isQuoted = source[index] === '"' || source[index] === "'";
        const key = isQuoted ? quoted() : token();
        // Both legacy TagParser and modern SNBT reject empty compound keys,
        // even when the key is quoted. Empty string values remain valid.
        if (key === null || key === "") return null;
        space(); if (source[index++] !== ":") return null;
      }
      const item = value(depth + 1, expanded ? typed : undefined); if (!item) return null;
      if (typed) {
        if (!integerTypes.includes(item.type) || (expanded ? width[item.type] > width[typed] : item.type !== typed)) return null;
      } else if (open === "[" && !expanded) {
        if (listType && listType !== item.type) return null;
        listType = item.type;
      }
      space(); if (source[index] === close) { index++; return { type }; }
      if (source[index++] !== ",") return null;
      space(); if (source[index] === close) { index++; return { type }; }
    }
    return null;
  }
  if (!source.startsWith("{")) return false;
  const parsed = value(0); space();
  return parsed?.type === "compound" && index === source.length;
}
