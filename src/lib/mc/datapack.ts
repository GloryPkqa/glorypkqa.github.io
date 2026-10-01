import { versionAtLeast } from "@/lib/mc/give";

export type LootEntry = { item: string; weight: number; count: number };
export type PackInput = {
  version: string; title: string; description: string; namespace: string;
  recipeEnabled: boolean; recipeName: string; recipeType: "shaped" | "shapeless"; grid: string[]; result: string; resultCount: number;
  lootEnabled: boolean; lootName: string; rolls: number; loot: LootEntry[];
  validItems: Set<string>;
};

const FORMATS: Record<string, number> = { "1.16.5": 6, "1.17": 7, "1.20.4": 26, "1.20.6": 41, "1.21.5": 71, "1.21.8": 81, "26.1": 101 };
const slug = /^[a-z0-9_.-]+$/;
const itemId = (value: string) => value.trim().toLowerCase().replace(/^minecraft:/, "");
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export function createDataPackFiles(input: PackInput) {
  const errors: string[] = [];
  if (!FORMATS[input.version]) errors.push("该版本暂不支持数据包。");
  if (!input.title.trim()) errors.push("请填写数据包名称。");
  if (!slug.test(input.namespace)) errors.push("命名空间只能包含小写字母、数字、下划线、点和连字符。");
  if (!input.recipeEnabled && !input.lootEnabled) errors.push("请至少启用一种内容。");
  const recipeName = input.recipeName.trim();
  const lootName = input.lootName.trim();
  if (input.recipeEnabled && !slug.test(recipeName)) errors.push("配方文件名无效。");
  if (input.lootEnabled && !slug.test(lootName)) errors.push("战利品表文件名无效。");
  const hasItem = (value: string) => input.validItems.has(itemId(value));

  const grid = input.grid.map(itemId);
  const materials = grid.filter(Boolean);
  if (input.recipeEnabled) {
    if (!hasItem(input.result)) errors.push("配方产物不在当前版本的物品目录中。");
    if (!materials.length) errors.push("请至少放入一种配方材料。");
    if (materials.some((item) => !hasItem(item))) errors.push("配方中有不属于当前版本的材料。");
    if (!Number.isInteger(input.resultCount) || input.resultCount < 1 || input.resultCount > 64) errors.push("配方产物数量需为 1–64。");
  }
  if (input.lootEnabled) {
    if (!Number.isInteger(input.rolls) || input.rolls < 1 || input.rolls > 64) errors.push("抽取次数需为 1–64。");
    if (!input.loot.length || input.loot.some((entry) => !hasItem(entry.item))) errors.push("战利品列表中有无效物品。");
    if (input.loot.some((entry) => !Number.isInteger(entry.weight) || entry.weight < 1 || entry.weight > 1000 || !Number.isInteger(entry.count) || entry.count < 1 || entry.count > 64)) errors.push("战利品权重需为 1–1000，数量需为 1–64。");
  }
  if (errors.length) return { errors, files: [] as { name: string; content: string }[] };

  const pack = input.version === "26.1"
    ? { description: input.description.trim() || input.title.trim(), pack_format: 101, min_format: [101, 1], max_format: [101, 1] }
    : { description: input.description.trim() || input.title.trim(), pack_format: FORMATS[input.version] };
  const files = [{ name: "pack.mcmeta", content: json({ pack }) }];
  const folder = versionAtLeast(input.version, "1.21") ? { recipe: "recipe", loot: "loot_table" } : { recipe: "recipes", loot: "loot_tables" };

  if (input.recipeEnabled) {
    const result = versionAtLeast(input.version, "1.20.5")
      ? { id: `minecraft:${itemId(input.result)}`, count: input.resultCount }
      : { item: `minecraft:${itemId(input.result)}`, count: input.resultCount };
    const ingredient = (id: string) => versionAtLeast(input.version, "1.21.2") ? `minecraft:${id}` : { item: `minecraft:${id}` };
    let recipe: Record<string, unknown>;
    if (input.recipeType === "shapeless") {
      recipe = { type: "minecraft:crafting_shapeless", ingredients: materials.map(ingredient), result };
    } else {
      const usedRows = [0, 1, 2].filter((row) => grid.slice(row * 3, row * 3 + 3).some(Boolean));
      const usedColumns = [0, 1, 2].filter((column) => grid.some((id, index) => index % 3 === column && id));
      const keys = new Map<string, string>();
      const alphabet = "ABCDEFGHI";
      const pattern = usedRows.map((row) => usedColumns.map((column) => {
        const id = grid[row * 3 + column];
        if (!id) return " ";
        if (!keys.has(id)) keys.set(id, alphabet[keys.size]);
        return keys.get(id)!;
      }).join(""));
      recipe = { type: "minecraft:crafting_shaped", pattern, key: Object.fromEntries([...keys].map(([id, key]) => [key, ingredient(id)])), result };
    }
    files.push({ name: `data/${input.namespace}/${folder.recipe}/${recipeName}.json`, content: json(recipe) });
  }

  if (input.lootEnabled) {
    const entries = input.loot.map((entry) => ({ type: "minecraft:item", name: `minecraft:${itemId(entry.item)}`, weight: entry.weight, ...(entry.count === 1 ? {} : { functions: [{ function: "minecraft:set_count", count: entry.count }] }) }));
    files.push({ name: `data/${input.namespace}/${folder.loot}/${lootName}.json`, content: json({ type: "minecraft:generic", pools: [{ rolls: input.rolls, entries }] }) });
  }
  return { errors: [], files };
}
