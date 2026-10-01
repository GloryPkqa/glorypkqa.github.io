import { versionAtLeast } from "@/lib/mc/give";

export type ImportedGiveResult = { item: string; count: number; components: Record<string, unknown> };

function parseSnbt(source: string): unknown {
  let at = 0;
  const skip = () => { while (/\s/.test(source[at] ?? "")) at++; };
  const read = (depth: number): unknown => {
    if (depth > 16) throw new Error("指令嵌套层数过多。");
    skip();
    const first = source[at];
    if (first === "'" || first === '"') {
      at++;
      let value = "";
      while (at < source.length) {
        const char = source[at++];
        if (char === first) return value;
        if (char === "\\") {
          if (at >= source.length) break;
          value += source[at++];
        } else value += char;
      }
      throw new Error("指令中有未闭合的引号。");
    }
    if (first === "[" || first === "{") {
      at++;
      const array = first === "[";
      const closing = array ? "]" : "}";
      const values: unknown[] = [];
      const object: Record<string, unknown> = {};
      skip();
      while (source[at] !== closing) {
        if (at >= source.length) throw new Error("指令中的括号没有闭合。");
        if (array) values.push(read(depth + 1));
        else {
          const key = source[at] === "'" || source[at] === '"'
            ? read(depth + 1)
            : (() => { const start = at; while (at < source.length && source[at] !== ":") at++; return source.slice(start, at).trim(); })();
          if (typeof key !== "string" || !key || source[at++] !== ":") throw new Error("指令属性格式不正确。");
          object[key] = read(depth + 1);
        }
        skip();
        if (source[at] === ",") { at++; skip(); }
        else if (source[at] !== closing) throw new Error("指令属性之间缺少逗号。");
      }
      at++;
      return array ? values : object;
    }
    const start = at;
    while (at < source.length && !/[\s,\]}]/.test(source[at])) at++;
    const token = source.slice(start, at);
    if (token === "true") return true;
    if (token === "false") return false;
    if (/^-?\d+$/.test(token)) return Number(token);
    if (token) return token;
    throw new Error("指令属性格式不正确。");
  };
  const result = read(0);
  skip();
  if (at !== source.length) throw new Error("指令属性后还有无法识别的内容。");
  return result;
}

function topLevelParts(source: string) {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let at = 0; at < source.length; at++) {
    const char = source[at];
    if (quote) {
      if (char === "\\") at++;
      else if (char === quote) quote = "";
    } else if (char === "'" || char === '"') quote = char;
    else if (char === "{" || char === "[") depth++;
    else if (char === "}" || char === "]") depth--;
    else if (char === "," && depth === 0) { parts.push(source.slice(start, at).trim()); start = at + 1; }
    if (depth < 0) throw new Error("指令中的括号不匹配。");
  }
  if (quote || depth) throw new Error("指令中的引号或括号没有闭合。");
  parts.push(source.slice(start).trim());
  return parts;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function importGiveForRecipe(command: string, version: string): ImportedGiveResult {
  if (!versionAtLeast(version, "1.20.5")) throw new Error(`${version} 的原版工作台配方不能直接生成带属性的物品；请选 1.20.6 或更新版本。`);
  const source = command.trim();
  if (source.length > 12_000) throw new Error("指令过长，请粘贴本站生成的 /give 指令。");
  const match = source.match(/^\/?give\s+\S+\s+((?:minecraft:)?[a-z0-9_]+)([\s\S]*)$/i);
  if (!match) throw new Error("请粘贴完整的 Java 版 /give 指令。");
  const item = match[1].replace(/^minecraft:/i, "").toLowerCase();
  let tail = match[2].trim();
  let rawComponents = "";
  if (tail.startsWith("{")) throw new Error("这条 /give 使用旧版 NBT；当前配方需要对应版本的物品组件指令。");
  if (tail.startsWith("[")) {
    let depth = 0;
    let quote = "";
    let end = -1;
    for (let at = 0; at < tail.length; at++) {
      const char = tail[at];
      if (quote) { if (char === "\\") at++; else if (char === quote) quote = ""; }
      else if (char === "'" || char === '"') quote = char;
      else if (char === "[") depth++;
      else if (char === "]" && --depth === 0) { end = at; break; }
    }
    if (end < 0) throw new Error("指令中的组件方括号没有闭合。");
    rawComponents = tail.slice(1, end);
    tail = tail.slice(end + 1).trim();
  }
  if (tail && !/^\d+$/.test(tail)) throw new Error("无法识别指令末尾的产物数量。");
  const count = tail ? Number(tail) : 1;
  if (count < 1 || count > 64) throw new Error("配方产物数量需为 1–64。");

  const components: Record<string, unknown> = {};
  if (rawComponents) for (const part of topLevelParts(rawComponents)) {
    const separator = part.indexOf("=");
    if (separator < 1) throw new Error("指令组件格式不正确。");
    const key = part.slice(0, separator).replace(/^minecraft:/, "");
    if (!["custom_name", "lore", "enchantments", "stored_enchantments", "unbreakable"].includes(key)) throw new Error(`暂不支持导入 ${key}；请使用本站 /give 工具生成的指令。`);
    if (`minecraft:${key}` in components) throw new Error(`重复的 ${key} 属性。`);
    const value = parseSnbt(part.slice(separator + 1));
    if (key === "custom_name" || key === "lore") {
      const entries = key === "lore" ? value : [value];
      if (!Array.isArray(entries) || entries.some((entry) => version === "1.20.6" ? typeof entry !== "string" : !isObject(entry))) throw new Error("名称或描述的格式与所选版本不匹配。");
      if (version === "1.20.6") for (const entry of entries) {
        try { JSON.parse(entry as string); } catch { throw new Error("名称或描述中的 JSON 文本无效。"); }
      }
    } else if (key === "enchantments" || key === "stored_enchantments") {
      if (!isObject(value)) throw new Error("附魔属性格式不正确。");
      const levels = version === "1.20.6" ? value.levels : value;
      if (!isObject(levels) || (version === "1.20.6" && Object.keys(value).some((field) => field !== "levels")) || (version !== "1.20.6" && "levels" in value)) throw new Error("附魔格式与所选版本不匹配，请在 /give 工具选择相同版本后重新复制。");
      if (Object.entries(levels).some(([id, level]) => !/^minecraft:[a-z0-9_]+$/.test(id) || !Number.isInteger(level) || (level as number) < 1 || (level as number) > 255)) throw new Error("附魔 ID 或等级无效。");
    } else if (!isObject(value) || Object.keys(value).length) throw new Error("无法破坏属性格式不正确；本站仅支持 unbreakable={}。");
    components[`minecraft:${key}`] = value;
  }
  return { item, count, components };
}
