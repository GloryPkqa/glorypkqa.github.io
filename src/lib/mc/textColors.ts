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

export function modernSnbtString(value: string) {
  return `'${value.replace(/['\\\u0000-\u001f]/g, (char) => char === "'" || char === "\\" ? `\\${char}` : `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`)}'`;
}

export function textComponent(parts: ColoredPart[], version: string) {
  const entries = parts.length ? parts : [{ text: "", color: "#FFFFFF", bold: false, italic: false }];
  if (version.startsWith("1.") && Number(version.split(".")[1]) <= 20) {
    // Hex text colors arrived in Java 1.16. Earlier versions need a named dye.
    const legacyColors = { black: "#000000", dark_blue: "#0000AA", dark_green: "#00AA00", dark_aqua: "#00AAAA", dark_red: "#AA0000", dark_purple: "#AA00AA", gold: "#FFAA00", gray: "#AAAAAA", dark_gray: "#555555", blue: "#5555FF", green: "#55FF55", aqua: "#55FFFF", red: "#FF5555", light_purple: "#FF55FF", yellow: "#FFFF55", white: "#FFFFFF" };
    const colorForVersion = (hex: string) => {
      if (Number(version.split(".")[1]) >= 16) return hex;
      const rgb = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
      return Object.entries(legacyColors).sort((a, b) => {
        const distance = (value: string) => [1, 3, 5].reduce((sum, at, index) => sum + (rgb[index] - Number.parseInt(value.slice(at, at + 2), 16)) ** 2, 0);
        return distance(a[1]) - distance(b[1]);
      })[0][0];
    };
    const content = entries.map(({ text, color, bold, italic }) => ({ text, color: colorForVersion(color), bold, italic }));
    return JSON.stringify(content.length === 1 ? content[0] : content);
  }
  const content = entries.map(({ text, color, bold, italic }) => `{text:${modernSnbtString(text)},color:${modernSnbtString(color)},bold:${bold},italic:${italic}}`);
  return content.length === 1 ? content[0] : `[${content.join(",")}]`;
}
