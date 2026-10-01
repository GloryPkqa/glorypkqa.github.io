export type ColorMode = "solid" | "gradient" | "alternate" | "manual";
export type TextStyle = { mode: ColorMode; colorA: string; colorB: string; overrides: Record<number, string>; bold: boolean; italic: boolean };
export type ColoredPart = { text: string; color: string; bold: boolean; italic: boolean };

export function defaultTextStyle(colorA = "#55FF55"): TextStyle {
  return { mode: "solid", colorA, colorB: "#55FFFF", overrides: {}, bold: false, italic: false };
}

export function characters(text: string) { return Array.from(text); }

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

function snbt(value: string) { return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`; }

export function textComponent(parts: ColoredPart[], version: string) {
  const entries = parts.length ? parts : [{ text: "", color: "#FFFFFF", bold: false, italic: false }];
  if (version === "1.20.4" || version === "1.20.6") {
    const content = entries.map(({ text, color, bold, italic }) => ({ text, color, bold, italic }));
    return JSON.stringify(content.length === 1 ? content[0] : content);
  }
  const content = entries.map(({ text, color, bold, italic }) => `{text:${snbt(text)},color:${snbt(color)},bold:${bold},italic:${italic}}`);
  return content.length === 1 ? content[0] : `[${content.join(",")}]`;
}
