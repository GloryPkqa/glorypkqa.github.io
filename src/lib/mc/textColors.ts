export type ColorMode = "solid" | "gradient" | "alternate" | "manual";
export type TextStyle = { mode: ColorMode; colorA: string; colorB: string; overrides: Record<number, string>; bold: boolean; italic: boolean };
export type ColoredPart = { text: string; color: string; bold: boolean; italic: boolean };

export function defaultTextStyle(colorA = "#55FF55"): TextStyle {
  return { mode: "solid", colorA, colorB: "#55FFFF", overrides: {}, bold: false, italic: false };
}

export function characters(text: string) {
  // Keep combining marks, flags and joined emoji together when applying colors.
  return typeof Intl.Segmenter === "function"
    ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (entry) => entry.segment)
    : Array.from(text);
}

// A text edit replaces one range. Keep paints on the unchanged prefix/suffix,
// shift suffix positions, and leave newly inserted/replaced characters unpainted.
export function remapTextColors(before: string, after: string, overrides: Record<number, string>, caret?: number | null) {
  const oldChars = characters(before), newChars = characters(after);
  let prefix = 0, suffix = 0;
  // The caret identifies the edited range when repeated letters make a diff
  // ambiguous. DOM caret offsets count UTF-16 units, paints count graphemes.
  const boundary = typeof caret === "number" && Number.isInteger(caret) && caret >= 0 && caret <= after.length ? caret : null;
  let offset = 0, caretIndex = 0;
  if (boundary !== null) for (const char of newChars) { if (offset + char.length > boundary) break; offset += char.length; caretIndex++; }
  const tail = boundary !== null && offset === boundary && before !== after ? newChars.length - caretIndex : -1;
  const caretMatches = tail >= 0 && tail <= oldChars.length && newChars.slice(newChars.length - tail).join("") === oldChars.slice(oldChars.length - tail).join("");
  if (caretMatches) suffix = tail;
  while (prefix < oldChars.length - suffix && prefix < newChars.length - suffix && oldChars[prefix] === newChars[prefix]) prefix++;
  if (!caretMatches) while (suffix < oldChars.length - prefix && suffix < newChars.length - prefix && oldChars[oldChars.length - 1 - suffix] === newChars[newChars.length - 1 - suffix]) suffix++;
  const mapped: Record<number, string> = {};
  for (const [key, color] of Object.entries(overrides)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= oldChars.length) continue;
    if (index < prefix) mapped[index] = color;
    else if (index >= oldChars.length - suffix) mapped[index + newChars.length - oldChars.length] = color;
  }
  return mapped;
}

function blend(first: string, last: string, ratio: number) {
  const color = [1, 3, 5].map((index) => {
    const start = Number.parseInt(first.slice(index, index + 2), 16);
    const end = Number.parseInt(last.slice(index, index + 2), 16);
    return Math.round(start + (end - start) * ratio).toString(16).padStart(2, "0");
  });
  return `#${color.join("").toUpperCase()}`;
}

export function coloredParts(text: string, style: TextStyle): ColoredPart[] {
  const chars = characters(text);
  const parts: ColoredPart[] = [];
  chars.forEach((char, index) => {
    const color = style.mode === "gradient" ? blend(style.colorA, style.colorB, chars.length < 2 ? 0 : index / (chars.length - 1))
      : style.mode === "alternate" ? index % 2 ? style.colorB : style.colorA
      : style.mode === "manual" ? style.overrides[index] ?? style.colorA : style.colorA;
    const previous = parts.at(-1);
    if (previous?.color === color) previous.text += char;
    else parts.push({ text: char, color, bold: style.bold, italic: style.italic });
  });
  return parts;
}

export function modernSnbtString(value: string) {
  return `'${value.replace(/['\\\u0000-\u001f]/g, (char) => char === "'" || char === "\\" ? `\\${char}` : `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`)}'`;
}

const CLASSIC_TEXT_COLORS = { black: "#000000", dark_blue: "#0000AA", dark_green: "#00AA00", dark_aqua: "#00AAAA", dark_red: "#AA0000", dark_purple: "#AA00AA", gold: "#FFAA00", gray: "#AAAAAA", dark_gray: "#555555", blue: "#5555FF", green: "#55FF55", aqua: "#55FFFF", red: "#FF5555", light_purple: "#FF55FF", yellow: "#FFFF55", white: "#FFFFFF" };
const classicTextVersion = (version: string) => version.startsWith("1.") && Number(version.split(".")[1]) < 16;

function nearestClassicColor(hex: string) {
  const rgb = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  const distance = (value: string) => [1, 3, 5].reduce((sum, at, index) => sum + (rgb[index] - Number.parseInt(value.slice(at, at + 2), 16)) ** 2, 0);
  return Object.entries(CLASSIC_TEXT_COLORS).sort((a, b) => distance(a[1]) - distance(b[1]))[0];
}

export function previewTextParts(parts: ColoredPart[], version: string): ColoredPart[] {
  return classicTextVersion(version) ? parts.map((part) => ({ ...part, color: nearestClassicColor(part.color)[1] })) : parts;
}

export function textComponent(parts: ColoredPart[], version: string) {
  const entries = parts.length ? parts : [{ text: "", color: "#FFFFFF", bold: false, italic: false }];
  if (version.startsWith("1.") && Number(version.split(".")[1]) <= 20) {
    // Hex text colors arrived in Java 1.16. Earlier versions need a named dye.
    const colorForVersion = (hex: string) => classicTextVersion(version) ? nearestClassicColor(hex)[0] : hex;
    const content = entries.map(({ text, color, bold, italic }) => ({ text, color: colorForVersion(color), bold, italic }));
    return JSON.stringify(content.length === 1 ? content[0] : content);
  }
  const content = entries.map(({ text, color, bold, italic }) => `{text:${modernSnbtString(text)},color:${modernSnbtString(color)},bold:${bold},italic:${italic}}`);
  return content.length === 1 ? content[0] : `[${content.join(",")}]`;
}
