export type BannerLayer = { pattern: string; color: string };

export const BANNER_COLORS = [
  { id: "white", zh: "白色", hex: "#f9fffe" }, { id: "orange", zh: "橙色", hex: "#f9801d" },
  { id: "magenta", zh: "品红色", hex: "#c74ebd" }, { id: "light_blue", zh: "淡蓝色", hex: "#9abed9" },
  { id: "yellow", zh: "黄色", hex: "#fed83d" }, { id: "lime", zh: "黄绿色", hex: "#80c71f" },
  { id: "pink", zh: "粉红色", hex: "#f38baa" }, { id: "gray", zh: "灰色", hex: "#474f52" },
  { id: "light_gray", zh: "淡灰色", hex: "#9d9d97" }, { id: "cyan", zh: "青色", hex: "#169c9c" },
  { id: "purple", zh: "紫色", hex: "#8932b8" }, { id: "blue", zh: "蓝色", hex: "#3c44aa" },
  { id: "brown", zh: "棕色", hex: "#835432" }, { id: "green", zh: "绿色", hex: "#5e7c16" },
  { id: "red", zh: "红色", hex: "#b02e26" }, { id: "black", zh: "黑色", hex: "#1d1d21" },
] as const;

// Legacy short IDs are used by Java 1.13 through 1.20.4 BlockEntityTag.
export const BANNER_PATTERNS = [
  ["stripe_bottom", "底横条", "bs", "stripes"], ["stripe_top", "顶横条", "ts", "stripes"],
  ["stripe_left", "左竖条", "ls", "stripes"], ["stripe_right", "右竖条", "rs", "stripes"],
  ["stripe_center", "中竖条", "cs", "stripes"], ["stripe_middle", "中横条", "ms", "stripes"],
  ["stripe_downright", "右斜条", "drs", "stripes"], ["stripe_downleft", "左斜条", "dls", "stripes"],
  ["small_stripes", "细竖条", "ss", "stripes"], ["cross", "斜十字", "cr", "stripes"],
  ["straight_cross", "正十字", "sc", "stripes"],
  ["square_bottom_left", "左下角", "bl", "corners"], ["square_bottom_right", "右下角", "br", "corners"],
  ["square_top_left", "左上角", "tl", "corners"], ["square_top_right", "右上角", "tr", "corners"],
  ["triangle_bottom", "底三角", "bt", "shapes"], ["triangle_top", "顶三角", "tt", "shapes"],
  ["triangles_bottom", "底锯齿", "bts", "shapes"], ["triangles_top", "顶锯齿", "tts", "shapes"],
  ["diagonal_left", "左下半", "ld", "shapes"], ["diagonal_right", "右下半", "rud", "shapes"],
  ["diagonal_up_left", "左上半", "lud", "shapes"], ["diagonal_up_right", "右上半", "rd", "shapes"],
  ["half_horizontal", "上半部", "hh", "shapes"], ["half_horizontal_bottom", "下半部", "hhb", "shapes"],
  ["half_vertical", "左半部", "vh", "shapes"], ["half_vertical_right", "右半部", "vhr", "shapes"],
  ["circle", "圆形", "mc", "shapes"], ["rhombus", "菱形", "mr", "shapes"],
  ["border", "边框", "bo", "ornaments"], ["curly_border", "锯齿边框", "cbo", "ornaments"],
  ["bricks", "砖纹", "bri", "ornaments"], ["gradient", "向下渐变", "gra", "ornaments"],
  ["gradient_up", "向上渐变", "gru", "ornaments"],
  ["creeper", "苦力怕", "cre", "special"], ["skull", "骷髅", "sku", "special"],
  ["flower", "花朵", "flo", "special"], ["globe", "地球", "glb", "special"],
  ["mojang", "Mojang 标志", "moj", "special"], ["piglin", "猪灵", "pig", "special"],
  ["flow", "涡流", "flw", "special"], ["guster", "旋风", "gus", "special"],
] as const;

const patternMap = new Map<string, { id: string; zh: string; code: string; group: string }>(BANNER_PATTERNS.map(([id, zh, code, group]) => [id, { id, zh, code, group }]));

export function bannerPattern(id: string) { return patternMap.get(id); }
export function bannerColor(id: string) { return BANNER_COLORS.find((entry) => entry.id === id); }
export function availableBannerPatterns(version: string) {
  const [major, minor, patch] = version.split(".").map(Number);
  const modern = major > 1 || minor > 20 || (minor === 20 && patch >= 5);
  const piglin = major > 1 || minor > 16 || (minor === 16 && patch >= 2);
  return BANNER_PATTERNS.filter(([id]) => (modern || (id !== "flow" && id !== "guster")) && (piglin || id !== "piglin"));
}

export function makeBannerCommand(input: { version: string; target: "banner" | "shield"; base: string; layers: BannerLayer[]; player?: string }) {
  const { version, target, base, layers, player = "@p" } = input;
  if (!bannerColor(base) || !/^(@[aprs]|[A-Za-z0-9_]{3,16})$/.test(player)) return "";
  if (layers.some((layer) => !bannerPattern(layer.pattern) || !bannerColor(layer.color) || !availableBannerPatterns(version).some(([id]) => id === layer.pattern))) return "";
  const item = target === "banner" ? `${base}_banner` : "shield";
  if (version.split(".").map(Number)[0] === 1 && Number(version.split(".")[1]) < 21 && !(Number(version.split(".")[1]) === 20 && Number(version.split(".")[2]) >= 5)) {
    const parts = [target === "shield" ? `Base:${BANNER_COLORS.findIndex((entry) => entry.id === base)}` : "", layers.length ? `Patterns:[${layers.map(({ pattern, color }) => `{Pattern:${JSON.stringify(bannerPattern(pattern)!.code)},Color:${BANNER_COLORS.findIndex((entry) => entry.id === color)}}`).join(",")}]` : ""].filter(Boolean);
    return `/give ${player} minecraft:${item}${parts.length ? `{BlockEntityTag:{${parts.join(",")}}}` : ""} 1`;
  }
  const components = [target === "shield" ? `base_color=${base}` : "", layers.length ? `banner_patterns=[${layers.map(({ pattern, color }) => `{pattern:"minecraft:${pattern}",color:"${color}"}`).join(",")}]` : ""].filter(Boolean);
  return `/give ${player} minecraft:${item}${components.length ? `[${components.join(",")}]` : ""} 1`;
}
