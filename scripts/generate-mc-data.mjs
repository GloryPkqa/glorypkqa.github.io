import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const minecraftData = require("minecraft-data");
const output = join(process.cwd(), "public", "mc-data");
const versions = ["1.8.9", "1.12.2", "1.16.5", "1.17", "1.20.4", "1.20.6", "1.21.5", "1.21.8", "26.1"];
const chinese = JSON.parse(await readFile(join(process.cwd(), "scripts", "mc-zh-cn.json"), "utf8"));
const itemCategories = JSON.parse(await readFile(join(process.cwd(), "scripts", "mc-item-categories.json"), "utf8"));
const fallbackIcons = JSON.parse(await readFile(join(process.cwd(), "scripts", "mc-fallback-icons.json"), "utf8"));
const processingRecipes = JSON.parse(await readFile(join(process.cwd(), "scripts", "mc-processing-recipes.json"), "utf8"));
const oldProcessingRecipes = JSON.parse(await readFile(join(process.cwd(), "scripts", "mc-processing-old.json"), "utf8"));

await mkdir(output, { recursive: true });

for (const version of versions) {
  const data = minecraftData(version);
  // The older game assets use different locale keys. Shared IDs use the verified
  // modern translation; unmatched names remain in English instead of guessing.
  const names = chinese[version] ?? chinese["1.20.4"];
  if (!data?.itemsArray?.length || !data?.enchantmentsArray?.length || !data?.blocksArray?.length) {
    throw new Error(`Minecraft data missing for ${version}`);
  }

  const recipes = {};
  for (const recipe of (version === "1.8.9" || version === "1.12.2" ? [] : Object.values(data.recipes ?? {}).flat())) {
    const result = data.items[recipe.result.id]?.name;
    if (!result) continue;
    const mapped = recipe.inShape
      ? { shape: recipe.inShape.map((row) => row.map((id) => id === null ? null : data.items[id]?.name ?? null)), count: recipe.result.count }
      : { ingredients: recipe.ingredients?.map((id) => data.items[id]?.name).filter(Boolean) ?? [], count: recipe.result.count };
    (recipes[result] ??= []).push(mapped);
  }

  const payload = {
    version,
    sourceVersion: data.version.minecraftVersion,
    items: data.itemsArray
      .filter((item) => item.name !== "air")
      .map(({ name, displayName, stackSize }) => ({ name, displayName, displayNameZh: names.items[name] ?? displayName, stackSize, category: itemCategories.items[name]?.category ?? "misc", icon: itemCategories.items[name]?.renderable === true, iconUrl: fallbackIcons[name] ?? null })),
    blocks: data.blocksArray.map(({ name, displayName }) => ({ name, displayName })),
    entities: data.entitiesArray
      .filter(({ type }) => ["mob", "animal", "living", "ambient", "hostile", "water_creature", "passive"].includes(type))
      .map(({ name, displayName, type }) => ({ name, displayName, displayNameZh: names.entities[name] ?? displayName, type })),
    recipes,
    processingRecipes: processingRecipes[version] ?? oldProcessingRecipes[version] ?? [],
    enchantments: data.enchantmentsArray.map(({ name, displayName, maxLevel, exclude, category }) => ({
      name, displayName, displayNameZh: names.enchantments[name] ?? displayName, maxLevel, exclude, category,
    })),
    effects: data.effectsArray.filter((effect, index, all) => all.findIndex((entry) => entry.name === effect.name) === index).map(({ id, name, displayName, type }) => ({
      id, name: name === "BadLuck" ? "unluck" : name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(), displayName, displayNameZh: names.effects[name === "BadLuck" ? "unluck" : name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()] ?? displayName, type,
    })),
  };

  await writeFile(join(output, `${version}.json`), JSON.stringify(payload));
  console.log(`Generated ${version}: ${payload.items.length} items, ${payload.enchantments.length} enchantments`);
}
