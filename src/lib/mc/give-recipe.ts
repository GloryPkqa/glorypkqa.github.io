import { MAX_COMPONENT_LORE_LINES, versionAtLeast, type McCatalog } from "@/lib/mc/give";
import { isCommandTarget, targetErrorHint } from "@/lib/mc/target";
import { commandWhitespace, compoundNbt, isCommandWhitespace, targetNbtUnsupportedHint, trimCommandWhitespace } from "@/lib/mc/targetNbt";

export type ImportedGiveResult = { item: string; count: number; components: Record<string, unknown> };

function parseSnbt(source: string, version: string): unknown {
  const modern = versionAtLeast(version, "1.21.5");
  const unsupported = targetNbtUnsupportedHint(`@p[nbt={value:${source}}]`);
  if (unsupported) throw new Error(unsupported);
  if (!compoundNbt(`{value:${source}}`, version)) throw new Error("指令属性中的 SNBT 格式无效或与当前版本不匹配。");
  let at = 0;
  const skip = () => { while (at < source.length && isCommandWhitespace(source[at])) at++; };
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
          const escaped = source[at++];
          if (escaped === first || escaped === "\\") value += escaped;
          else if (modern && escaped === "u" && /^[a-fA-F0-9]{4}$/.test(source.slice(at, at + 4))) {
            value += String.fromCharCode(Number.parseInt(source.slice(at, at + 4), 16)); at += 4;
          } else if (modern && escaped in { b: 1, t: 1, n: 1, f: 1, r: 1, s: 1 }) {
            value += ({ b: "\b", t: "\t", n: "\n", f: "\f", r: "\r", s: " " } as Record<string, string>)[escaped];
          } else throw new Error("指令中有不支持的字符串转义。");
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
            : (() => { const start = at; while (at < source.length && source[at] !== ":") at++; return trimCommandWhitespace(source.slice(start, at)); })();
          if (typeof key !== "string" || !key || source[at++] !== ":") throw new Error("指令属性格式不正确。");
          if (Object.hasOwn(object, key)) throw new Error("指令中有重复属性。");
          if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("指令中有不支持的属性名。");
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
    while (at < source.length && !isCommandWhitespace(source[at]) && !",]}".includes(source[at])) at++;
    const token = source.slice(start, at);
    if (token === "true") return true;
    if (token === "false") return false;
    if (/^[+-]?\d+$/.test(token)) return Number(token);
    if ((modern && /^[0-9.+-]/.test(token)) || /[()]/.test(token)) throw new Error("暂不支持导入这类 SNBT 数字或表达式；请使用本站 /give 工具重新生成。");
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
    else if (char === "," && depth === 0) { parts.push(trimCommandWhitespace(source.slice(start, at))); start = at + 1; }
    if (depth < 0) throw new Error("指令中的括号不匹配。");
  }
  if (quote || depth) throw new Error("指令中的引号或括号没有闭合。");
  parts.push(trimCommandWhitespace(source.slice(start)));
  if (parts.length > 1 && parts.at(-1) === "") parts.pop();
  return parts;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Selector arguments may contain whitespace, quoted names, nested compounds
// and lists. Only whitespace outside the whole selector separates the item.
function giveItemSource(source: string) {
  const prefix = source.match(new RegExp(`^/?give${commandWhitespace.source}+`));
  if (!prefix) throw new Error("请粘贴完整的 Java 版 /give 指令。");
  let at = prefix[0].length;
  const targetStart = at;
  const brackets: string[] = [];
  let quote = "";
  for (; at < source.length; at++) {
    const char = source[at];
    if (quote) {
      if (char === "\\") at++;
      else if (char === quote) quote = "";
    } else if (char === "'" || char === '"') quote = char;
    else if (char === "[" || char === "{") brackets.push(char);
    else if (char === "]" || char === "}") {
      if (brackets.pop() !== (char === "]" ? "[" : "{")) throw new Error("目标选择器中的括号不匹配。");
    } else if (isCommandWhitespace(char) && !brackets.length) break;
    if (brackets.length > 16) throw new Error("目标选择器的嵌套层数过多。");
  }
  if (quote || brackets.length) throw new Error("目标选择器中的引号或括号没有闭合。");
  if (at === targetStart || at === source.length) throw new Error("请粘贴包含目标和物品的完整 /give 指令。");
  return { target: source.slice(targetStart, at), itemSource: trimCommandWhitespace(source.slice(at)) };
}

function validateLiteralText(value: unknown, depth = 0): void {
  if (depth > 16) throw new Error("名称或描述的嵌套层数过多。");
  if (!isObject(value) || typeof value.text !== "string") throw new Error("名称或描述需要有效的文字内容。");
  const allowed = new Set(["text", "color", "bold", "italic", "underlined", "strikethrough", "obfuscated", "extra"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("暂不支持这类文本属性，请使用本站 /give 生成器中的名称和描述。");
  const colors = /^(#[a-fA-F0-9]{6}|black|dark_blue|dark_green|dark_aqua|dark_red|dark_purple|gold|gray|dark_gray|blue|green|aqua|red|light_purple|yellow|white)$/;
  if (value.color !== undefined && (typeof value.color !== "string" || !colors.test(value.color))) throw new Error("名称或描述中的颜色无效。");
  if (["bold", "italic", "underlined", "strikethrough", "obfuscated"].some((key) => value[key] !== undefined && typeof value[key] !== "boolean")) throw new Error("名称或描述中的样式需为 true 或 false。");
  if (value.extra !== undefined) {
    if (!Array.isArray(value.extra)) throw new Error("名称或描述的 extra 需要是文本列表。");
    value.extra.forEach((entry) => validateLiteralText(entry, depth + 1));
  }
}

export function importGiveForRecipe(command: string, version: string, catalog?: McCatalog): ImportedGiveResult {
  if (!versionAtLeast(version, "1.20.5")) throw new Error(`${version} 的原版工作台配方不能直接生成带属性的物品；请选 1.20.6 或更新版本。`);
  const source = trimCommandWhitespace(command);
  if (source.length > 12_000) throw new Error("指令过长，请粘贴本站生成的 /give 指令。");
  const { target, itemSource } = giveItemSource(source);
  if (!isCommandTarget(target, version, { playersOnly: true })) throw new Error(targetErrorHint(target, version, { playersOnly: true }));
  const match = itemSource.match(/^((?:minecraft:)?[a-z0-9_]+)([\s\S]*)$/);
  if (!match) throw new Error("请粘贴完整的 Java 版 /give 指令。");
  const item = match[1].replace(/^minecraft:/i, "").toLowerCase();
  if (catalog && (catalog.version !== version || !catalog.items.some((entry) => entry.name === item))) throw new Error("这件物品不在当前版本的物品目录中，请检查 /give 的版本。");
  if (isCommandWhitespace(match[2][0] ?? "") && /^[\[{]/.test(trimCommandWhitespace(match[2]))) throw new Error("物品组件必须紧接物品 ID，中间不能有空格。");
  let tail = trimCommandWhitespace(match[2]);
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
    rawComponents = trimCommandWhitespace(tail.slice(1, end));
    if (tail.length > end + 1 && !isCommandWhitespace(tail[end + 1])) throw new Error("物品组件与产物数量之间需要空格。");
    tail = trimCommandWhitespace(tail.slice(end + 1));
  }
  if (tail && !/^\d+$/.test(tail)) throw new Error("无法识别指令末尾的产物数量。");
  const count = tail ? Number(tail) : 1;
  if (count < 1 || count > 64) throw new Error("配方产物数量需为 1–64。");

  const components: Record<string, unknown> = {};
  if (rawComponents) for (const part of topLevelParts(rawComponents)) {
    const separator = part.indexOf("=");
    if (separator < 1) throw new Error("指令组件格式不正确。");
    const key = trimCommandWhitespace(part.slice(0, separator)).replace(/^minecraft:/, "");
    if (!["custom_name", "lore", "enchantments", "stored_enchantments", "unbreakable"].includes(key)) throw new Error(`暂不支持导入 ${key}；请使用本站 /give 工具生成的指令。`);
    if (`minecraft:${key}` in components) throw new Error(`重复的 ${key} 属性。`);
    const value = parseSnbt(part.slice(separator + 1), version);
    if (key === "custom_name" || key === "lore") {
      const entries = key === "lore" ? value : [value];
      if (!Array.isArray(entries) || entries.some((entry) => version === "1.20.6" ? typeof entry !== "string" : !isObject(entry))) throw new Error("名称或描述的格式与所选版本不匹配。");
      if (key === "lore" && entries.length > MAX_COMPONENT_LORE_LINES) throw new Error(`当前版本的物品描述最多支持 ${MAX_COMPONENT_LORE_LINES} 行。`);
      for (const entry of entries) {
        let text: unknown = entry;
        if (version === "1.20.6") {
          try { text = JSON.parse(entry as string); } catch { throw new Error("名称或描述中的 JSON 文本无效。"); }
        }
        validateLiteralText(text);
      }
    } else if (key === "enchantments" || key === "stored_enchantments") {
      if (!isObject(value)) throw new Error("附魔属性格式不正确。");
      const levels = version === "1.20.6" ? value.levels : value;
      if (!isObject(levels) || (version === "1.20.6" && Object.keys(value).some((field) => field !== "levels")) || (version !== "1.20.6" && "levels" in value)) throw new Error("附魔格式与所选版本不匹配，请在 /give 工具选择相同版本后重新复制。");
      if (Object.entries(levels).some(([id, level]) => !/^minecraft:[a-z0-9_]+$/.test(id) || !Number.isInteger(level) || (level as number) < 1 || (level as number) > 255)) throw new Error("附魔 ID 或等级无效。");
      if (catalog && Object.keys(levels).some((id) => !catalog.enchantments.some((entry) => id === `minecraft:${entry.name}`))) throw new Error("附魔不属于当前版本，请在 /give 工具选择相同版本后重新复制。");
    } else if (!isObject(value) || Object.keys(value).length) throw new Error("无法破坏属性格式不正确；本站仅支持 unbreakable={}。");
    components[`minecraft:${key}`] = value;
  }
  return { item, count, components };
}
