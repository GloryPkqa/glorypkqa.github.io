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
const selectorEntities = {};

await mkdir(output, { recursive: true });

for (const version of versions) {
  const data = minecraftData(version);
  // These releases register the upcoming 1.21 content, but ordinary worlds
  // cannot use it without the Update 1.21 experiment. Keep our default catalog
  // restricted to stable content (official 1.20.3 and 1.20.5 release notes).
  const stableOnly = version === "1.20.4" || version === "1.20.6";
  const baseline = stableOnly ? minecraftData("1.20.2") : null;
  const stableNames = (key, extras = []) => new Set([...(baseline?.[key] ?? []).map(({ name }) => name === "grass" ? "short_grass" : version === "1.20.6" && name === "scute" ? "turtle_scute" : name), ...extras]);
  const allowedItems = stableNames("itemsArray", version === "1.20.6" ? ["armadillo_scute", "wolf_armor", "armadillo_spawn_egg"] : []);
  const allowedBlocks = stableNames("blocksArray");
  const allowedEntities = stableNames("entitiesArray", version === "1.20.6" ? ["armadillo"] : []);
  const validItems = new Set(data.itemsArray.filter(({ name }) => name !== "air" && (!stableOnly || allowedItems.has(name))).map(({ name }) => name));
  const stableIngredient = (value) => !value || (Array.isArray(value) ? value : [value]).every((id) => id.startsWith("#") || validItems.has(id.replace(/^minecraft:/, "")));
  // The older game assets use different locale keys. Shared IDs use the verified
  // modern translation; unmatched names remain in English instead of guessing.
  const names = chinese[version] ?? chinese["1.20.4"];
  if (!data?.itemsArray?.length || !data?.enchantmentsArray?.length || !data?.blocksArray?.length) {
    throw new Error(`Minecraft data missing for ${version}`);
  }
  if (version !== "1.8.9" && version !== "1.12.2") {
    selectorEntities[version] = [...new Set(data.entitiesArray.filter(({ name }) => !stableOnly || allowedEntities.has(name)).map(({ name }) => name))].sort();
  }

  const recipes = {};
  for (const recipe of (version === "1.8.9" || version === "1.12.2" ? [] : Object.values(data.recipes ?? {}).flat())) {
    const result = data.items[recipe.result.id]?.name;
    if (!result || !validItems.has(result)) continue;
    const mapped = recipe.inShape
      ? { shape: recipe.inShape.map((row) => row.map((id) => id === null ? null : data.items[id]?.name ?? null)), count: recipe.result.count }
      : { ingredients: recipe.ingredients?.map((id) => data.items[id]?.name).filter(Boolean) ?? [], count: recipe.result.count };
    if ((mapped.shape?.flat() ?? mapped.ingredients).some((id) => id && !validItems.has(id))) continue;
    (recipes[result] ??= []).push(mapped);
  }

  const payload = {
    version,
    sourceVersion: data.version.minecraftVersion,
    items: data.itemsArray
      .filter((item) => validItems.has(item.name))
      .map(({ name, displayName, stackSize }) => ({ name, displayName, displayNameZh: names.items[name] ?? displayName, stackSize, category: itemCategories.items[name]?.category ?? "misc", icon: itemCategories.items[name]?.renderable === true, iconUrl: fallbackIcons[name] ?? null })),
    blocks: data.blocksArray.filter(({ name }) => !stableOnly || allowedBlocks.has(name)).map(({ name, displayName }) => ({ name, displayName })),
    entities: data.entitiesArray
      // Older protocol data repeats object entries and occasionally labels valid
      // mobs UNKNOWN. Java 26.1's official EntityType.canSummon excludes exactly
      // player and fishing_bobber; entity categories do not determine summonability.
      .filter(({ name, type }, index, all) => (version === "1.8.9" ? /^[A-Za-z0-9_]+$/ : /^[a-z0-9_]+$/).test(name)
        && !["player", "fishing_bobber"].includes(name)
        && all.findIndex((entry) => entry.name === name) === index
        && (version !== "1.8.9" && version !== "1.12.2" || ["mob", "animal", "living", "ambient", "hostile", "water_creature", "passive"].includes(type)))
      .filter(({ name }) => !stableOnly || allowedEntities.has(name))
      .map(({ name, displayName, type }) => ({ name, displayName, displayNameZh: names.entities[name] ?? displayName, type })),
    recipes,
    processingRecipes: (processingRecipes[version] ?? oldProcessingRecipes[version] ?? []).filter((recipe) => stableIngredient(recipe.result) && [recipe.ingredient, recipe.template, recipe.base, recipe.addition].every(stableIngredient)),
    enchantments: data.enchantmentsArray.filter(({ name }) => !stableOnly || !["density", "breach", "wind_burst"].includes(name)).map(({ name, displayName, maxLevel, exclude, category }) => ({
      name, displayName, displayNameZh: names.enchantments[name] ?? displayName, maxLevel, exclude, category,
    })),
    effects: data.effectsArray.filter(({ name }) => !stableOnly || !["TrialOmen", "RaidOmen", "WindCharged", "Weaving", "Oozing", "Infested"].includes(name)).filter((effect, index, all) => all.findIndex((entry) => entry.name === effect.name) === index).map(({ id, name, displayName, type }) => ({
      id, name: name === "BadLuck" ? "unluck" : name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(), displayName, displayNameZh: names.effects[name === "BadLuck" ? "unluck" : name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()] ?? displayName, type,
    })),
  };

  await writeFile(join(output, `${version}.json`), JSON.stringify(payload));
  console.log(`Generated ${version}: ${payload.items.length} items, ${payload.enchantments.length} enchantments`);
}
await writeFile(join(process.cwd(), "src", "lib", "mc", "selectorEntities.ts"), `// Generated by scripts/generate-mc-data.mjs. Includes non-summonable selector types.\nexport const SELECTOR_ENTITIES: Record<string, string[]> = ${JSON.stringify(selectorEntities)};\n`);
