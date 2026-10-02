import { compoundNbt, targetNbtUnsupportedHint } from "@/lib/mc/targetNbt";
import { versionAtLeast } from "@/lib/mc/give";
import { SELECTOR_ENTITIES } from "@/lib/mc/selectorEntities";

const decimal = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
const integer = /^-?\d+$/;
const word = /^[A-Za-z0-9_.+-]*$/;
// Vanilla's Identifier reader accepts empty paths and an empty namespace.
// Concrete type IDs still have to resolve in the version's entity registry.
const resource = /^(?:[a-z0-9_.-]*:)?[a-z0-9_./-]*$/;
const modernKeys = new Set(["x", "y", "z", "dx", "dy", "dz", "distance", "level", "x_rotation", "y_rotation", "limit", "sort", "gamemode", "name", "team", "type", "tag", "nbt", "scores", "advancements", "predicate"]);
const legacyKeys = new Set(["x", "y", "z", "dx", "dy", "dz", "r", "rm", "rx", "rxm", "ry", "rym", "c", "l", "lm", "m", "name", "team", "type", "tag"]);
const singletonKeys = new Set(["x", "y", "z", "dx", "dy", "dz", "distance", "level", "x_rotation", "y_rotation", "limit", "sort", "scores", "advancements"]);
const javaWhitespace = /[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]/;

function trimJava(source: string, startOnly = false) {
  let start = 0, end = source.length;
  while (start < end && javaWhitespace.test(source[start])) start++;
  if (!startOnly) while (end > start && javaWhitespace.test(source[end - 1])) end--;
  return source.slice(start, end);
}

// JS trim()/\s also consume NBSP, figure/narrow spaces and BOM. Brigadier
// does not. Quoted names and SNBT strings must retain these literal characters.
function unquotedJsOnlyWhitespace(source: string) {
  let quote = "", escaped = false;
  for (const char of source) {
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (/[\u00a0\u2007\u202f\ufeff]/.test(char)) return true;
  }
  return false;
}

// Split selector/maps without splitting commas inside quoted strings or NBT.
function entries(source: string): string[] | null {
  const result: string[] = [], stack: string[] = [];
  let quote = "", escaped = false, start = 0;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "[" || char === "{") stack.push(char);
    else if (char === "]" || char === "}") { if (stack.pop() !== (char === "]" ? "[" : "{")) return null; }
    else if (char === "," && !stack.length) { result.push(trimJava(source.slice(start, index))); start = index + 1; }
  }
  if (quote || escaped || stack.length) return null;
  result.push(trimJava(source.slice(start)));
  if (result.at(-1) === "") result.pop(); // Vanilla accepts a trailing comma.
  return result.some((entry) => entry === "") ? null : result;
}

function finiteNumber(value: string, whole = false) {
  return (whole ? integer : decimal).test(value) && Number.isFinite(Number(value))
    && (!whole || (Number(value) >= -2_147_483_648 && Number(value) <= 2_147_483_647));
}

function range(value: string, whole = false, nonnegative = false, circular = false) {
  const parts = value.split("..");
  if (parts.length > 2 || parts.every((part) => part === "")) return false;
  if (parts.some((part) => part !== "" && (!finiteNumber(part, whole) || (nonnegative && Number(part) < 0)))) return false;
  return circular || parts.length === 1 || !parts[0] || !parts[1] || Number(parts[0]) <= Number(parts[1]);
}

function stringValue(value: string) {
  if (word.test(value)) return true;
  if ((value[0] !== '"' && value[0] !== "'") || value.at(-1) !== value[0]) return false;
  for (let index = 1; index < value.length - 1; index++) {
    if (value[index] === value[0]) return false;
    if (value[index] === "\\" && (index + 1 >= value.length - 1 || !["\\", value[0]].includes(value[++index]))) return false;
  }
  return true;
}

function mapEntries(value: string) {
  if (!value.startsWith("{") || !value.endsWith("}")) return null;
  const parts = entries(value.slice(1, -1));
  if (!parts) return null;
  const pairs: [string, string][] = [];
  for (const part of parts) {
    const index = part.indexOf("=");
    if (index < 0) return null;
    pairs.push([trimJava(part.slice(0, index)), trimJava(part.slice(index + 1))]);
  }
  return pairs;
}


export function isCommandTarget(value: string, version: string, options: { playersOnly?: boolean } = {}) {
  const modern = versionAtLeast(version, "1.13");
  if (unquotedJsOnlyWhitespace(value)) return false;
  const target = trimJava(value);
  // Older selector readers are not Brigadier; preserve the existing legacy
  // capability boundary rather than borrowing modern control-character rules.
  if (!modern && /[\u0000-\u001f\u007f]/.test(target)) return false;
  if (stringValue(target) && target.length > 0) {
    const name = target[0] === '"' || target[0] === "'" ? target.slice(1, -1).replace(/\\([\\'"])/g, "$1") : target;
    if (name.length > 0 && name.length <= 16) return true;
    if (/^[a-fA-F0-9]{1,8}(?:-[a-fA-F0-9]{1,4}){3}-[a-fA-F0-9]{1,12}$/.test(name)) return !options.playersOnly || !modern;
  }
  const match = /^@([pares])(?:\[([\s\S]*)\])?$/.exec(target);
  if (!match || (match[1] === "s" && !versionAtLeast(version, "1.12"))) return false;
  if (match[2] === undefined) return !options.playersOnly || match[1] !== "e";
  const parts = entries(match[2]);
  if (!parts) return false;
  const seen = new Set<string>(), positive = new Set<string>(), inverse = new Set<string>();
  let selectsPlayers = match[1] !== "e";
  // @p/@a/@r already have an explicit player type. @s can filter its executor.
  if (modern && ["p", "a", "r"].includes(match[1])) positive.add("type");
  for (const part of parts) {
    const equal = part.indexOf("=");
    if (equal <= 0) return false;
    const key = trimJava(part.slice(0, equal)), raw = trimJava(part.slice(equal + 1));
    if (modern ? !modernKeys.has(key) : !legacyKeys.has(key) && !/^score_[A-Za-z0-9_.+-]+(?:_min)?$/.test(key)) return false;
    if (modern && singletonKeys.has(key) && seen.has(key)) return false;
    if (modern && match[1] === "s" && ["limit", "sort"].includes(key)) return false;
    seen.add(key);
    const negated = raw.startsWith("!"), item = negated ? trimJava(raw.slice(1), true) : raw;
    if (modern && ["name", "gamemode", "team", "type"].includes(key)) {
      if (positive.has(key) || !negated && key !== "team" && inverse.has(key)) return false;
      if (negated) inverse.add(key);
      else if (key !== "type" || !item.startsWith("#")) positive.add(key);
    }
    if (["x", "y", "z", "dx", "dy", "dz"].includes(key)) { if (!finiteNumber(raw)) return false; }
    else if (key === "limit") { if (!finiteNumber(raw, true) || Number(raw) < 1) return false; }
    else if (["c", "l", "lm", "r", "rm", "rx", "rxm", "ry", "rym"].includes(key) || key.startsWith("score_")) { if (!finiteNumber(raw, true)) return false; }
    else if (["distance", "x_rotation", "y_rotation"].includes(key)) { if (!range(raw, false, key === "distance", key !== "distance")) return false; }
    else if (key === "level") { if (!range(raw, true, true)) return false; selectsPlayers = true; }
    else if (key === "sort") { if (!["nearest", "furthest", "random", "arbitrary"].includes(raw)) return false; }
    else if (key === "gamemode" || key === "m") { if (!(modern ? ["survival", "creative", "adventure", "spectator"] : ["0", "1", "2", "3", "-1", "survival", "creative", "adventure", "spectator"]).includes(item)) return false; selectsPlayers = true; }
    else if (key === "name") { if (!stringValue(item)) return false; }
    else if (key === "tag" || key === "team") { if (!word.test(item)) return false; }
    else if (key === "type") {
      if (!(modern ? resource.test(item.replace(/^#/, "")) : /^[A-Za-z0-9_:.-]+$/.test(item))) return false;
      if (modern && !item.startsWith("#") && !SELECTOR_ENTITIES[version]?.includes(item.replace(/^minecraft:/, ""))) return false;
      if (!negated && ["player", "minecraft:player"].includes(item)) selectsPlayers = true;
    }
    else if (key === "predicate") { if (!versionAtLeast(version, "1.15") || !resource.test(item)) return false; }
    else if (key === "nbt") { if (!compoundNbt(item, version)) return false; }
    else if (key === "scores") { const pairs = mapEntries(raw); if (!pairs || pairs.some(([name, number]) => !word.test(name) || !range(number, true))) return false; }
    else if (key === "advancements") {
      const pairs = mapEntries(raw);
      if (!pairs || pairs.some(([id, progress]) => !resource.test(id) || (!["true", "false"].includes(progress) && !(mapEntries(progress)?.every(([criterion, achieved]) => word.test(criterion) && ["true", "false"].includes(achieved)))))) return false;
      if (pairs.length) selectsPlayers = true;
    }
  }
  return !options.playersOnly || selectsPlayers;
}

export function targetErrorHint(value: string, version: string, options: { playersOnly?: boolean } = {}) {
  const unsupported = targetNbtUnsupportedHint(value);
  if (unsupported) return unsupported;
  if (options.playersOnly && versionAtLeast(version, "1.13") && /^['"]?[a-fA-F0-9]{1,8}(?:-[a-fA-F0-9]{1,4}){3}-[a-fA-F0-9]{1,12}['"]?$/.test(value.trim())) return "玩家专用指令不能直接使用 UUID；请改用玩家名，或明确筛选玩家的选择器。";
  return "请填写有效目标，并检查选择器的选项、正反条件和当前版本语法。";
}
