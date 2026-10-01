export type McItem = { name: string; displayName: string; displayNameZh: string; stackSize: number; category: string; icon: boolean; iconUrl: string | null };
export type McEnchantment = {
  name: string;
  displayName: string;
  displayNameZh: string;
  maxLevel: number;
  exclude: string[];
  category: string;
};
export type McCatalog = {
  version: string;
  sourceVersion: string;
  items: McItem[];
  blocks?: { name: string; displayName: string }[];
  entities?: { name: string; displayName: string; displayNameZh: string; type: string }[];
  recipes?: Record<string, { shape?: (string | null)[][]; ingredients?: string[]; count: number }[]>;
  enchantments: McEnchantment[];
  effects: { name: string; displayName: string; displayNameZh: string; type: string }[];
};
export type SelectedEnchantment = { name: string; level: number };

export const MC_VERSIONS = ["26.1", "1.21.8", "1.21.5", "1.20.6", "1.20.4"] as const;

function snbtString(value: string) {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function legacyText(value: string) {
  return snbtString(JSON.stringify({ text: value, italic: false }));
}

function modernText(value: string) {
  return `{text:${snbtString(value)},italic:false}`;
}

export function makeGiveCommand(input: {
  version: string;
  item: string;
  count: number;
  target: string;
  name: string;
  lore: string[];
  unbreakable: boolean;
  enchantments: SelectedEnchantment[];
}) {
  const { version, item, count, target, name, lore, unbreakable, enchantments } = input;
  const itemId = `minecraft:${item}`;
  const stored = item === "enchanted_book";

  if (version === "1.20.4") {
    const nbt: string[] = [];
    if (enchantments.length) {
      nbt.push(`${stored ? "StoredEnchantments" : "Enchantments"}:[${enchantments.map(({ name: id, level }) => `{id:${snbtString(`minecraft:${id}`)},lvl:${level}s}`).join(",")}]`);
    }
    if (name || lore.length) {
      const display = [name && `Name:${legacyText(name)}`, lore.length && `Lore:[${lore.map(legacyText).join(",")}]`].filter(Boolean);
      nbt.push(`display:{${display.join(",")}}`);
    }
    if (unbreakable) nbt.push("Unbreakable:1b");
    return `/give ${target} ${itemId}${nbt.length ? `{${nbt.join(",")}}` : ""} ${count}`;
  }

  const components: string[] = [];
  if (enchantments.length) {
    const levels = enchantments.map(({ name: id, level }) => `${snbtString(`minecraft:${id}`)}:${level}`).join(",");
    components.push(`${stored ? "stored_enchantments" : "enchantments"}=${version === "1.20.6" ? `{levels:{${levels}}}` : `{${levels}}`}`);
  }

  const text = version === "1.20.6" ? legacyText : modernText;
  if (name) components.push(`custom_name=${text(name)}`);
  if (lore.length) components.push(`lore=[${lore.map(text).join(",")}]`);
  if (unbreakable) components.push("unbreakable={}");

  return `/give ${target} ${itemId}${components.length ? `[${components.join(",")}]` : ""} ${count}`;
}

export function enchantmentWarnings(selected: SelectedEnchantment[], catalog: McCatalog | null) {
  if (!catalog) return [];
  const byName = new Map(catalog.enchantments.map((enchantment) => [enchantment.name, enchantment]));
  const warnings: string[] = [];
  for (let i = 0; i < selected.length; i++) {
    const enchantment = byName.get(selected[i].name);
    if (!enchantment) continue;
    if (selected[i].level > enchantment.maxLevel) {
      warnings.push(`${enchantment.displayName} 超过原版最高等级 ${enchantment.maxLevel}`);
    }
    for (let j = i + 1; j < selected.length; j++) {
      if (enchantment.exclude.includes(selected[j].name)) {
        warnings.push(`${enchantment.displayName} 与 ${byName.get(selected[j].name)?.displayName ?? selected[j].name} 原版互斥`);
      }
    }
  }
  return warnings;
}
