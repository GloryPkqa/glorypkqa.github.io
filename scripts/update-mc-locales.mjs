import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const minecraftData = require("minecraft-data");
const versions = ["1.20.4", "1.20.6", "1.21.5", "1.21.8", "26.1"];

async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

const manifest = await json("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
const output = {};

for (const version of versions) {
  const listed = manifest.versions.find((entry) => entry.id === version);
  if (!listed) throw new Error(`Mojang manifest does not contain ${version}`);
  const metadata = await json(listed.url);
  const assets = await json(metadata.assetIndex.url);
  const language = assets.objects["minecraft/lang/zh_cn.json"];
  if (!language) throw new Error(`No zh_cn asset for ${version}`);
  const response = await fetch(`https://resources.download.minecraft.net/${language.hash.slice(0, 2)}/${language.hash}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Could not fetch zh_cn for ${version}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (createHash("sha1").update(buffer).digest("hex") !== language.hash) throw new Error(`SHA-1 mismatch for ${version}`);
  const names = JSON.parse(buffer.toString("utf8"));
  const data = minecraftData(version);
  const itemNames = {};
  for (const item of data.itemsArray) {
    const translated = names[`item.minecraft.${item.name}`] ?? names[`block.minecraft.${item.name}`];
    if (translated) itemNames[item.name] = translated;
  }
  const enchantmentNames = {};
  for (const enchantment of data.enchantmentsArray) {
    const translated = names[`enchantment.minecraft.${enchantment.name}`];
    if (translated) enchantmentNames[enchantment.name] = translated;
  }
  const effectNames = {};
  for (const effect of data.effectsArray) {
    const id = effect.name === "BadLuck" ? "unluck" : effect.name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
    const translated = names[`effect.minecraft.${id}`];
    if (translated) effectNames[id] = translated;
  }
  const entityNames = {};
  for (const entity of data.entitiesArray) {
    const translated = names[`entity.minecraft.${entity.name}`];
    if (translated) entityNames[entity.name] = translated;
  }
  output[version] = { sourceHash: language.hash, items: itemNames, enchantments: enchantmentNames, effects: effectNames, entities: entityNames };
  console.log(`${version}: ${Object.keys(itemNames).length} item, ${Object.keys(enchantmentNames).length} enchantment, ${Object.keys(effectNames).length} effect translations`);
}

await writeFile(join(process.cwd(), "scripts", "mc-zh-cn.json"), JSON.stringify(output));
