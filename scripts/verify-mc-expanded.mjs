import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTs(relative, imports = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("exports", "require", compiled)(exports, (id) => imports[id] ?? require(id));
  return exports;
}

const give = loadTs("../src/lib/mc/give.ts");
const banner = loadTs("../src/lib/mc/banner.ts");
const pack = loadTs("../src/lib/mc/datapack.ts", { "@/lib/mc/give": give });
const zip = loadTs("../src/lib/mc/zip.ts");

for (const version of give.MC_VERSIONS) {
  const catalog = JSON.parse(readFileSync(new URL(`../public/mc-data/${version}.json`, import.meta.url), "utf8"));
  assert.equal(catalog.version, version);
  assert.ok(catalog.items.length > 300);
  assert.ok(catalog.effects.length > 20);
  assert.equal(new Set(catalog.effects.map((effect) => effect.name)).size, catalog.effects.length);
  if (give.versionAtLeast(version, "1.16")) assert.ok(catalog.processingRecipes.length > 100);
  else assert.equal(catalog.processingRecipes.length, 0);
}
const old = JSON.parse(readFileSync(new URL("../public/mc-data/1.8.9.json", import.meta.url), "utf8"));
const newer = JSON.parse(readFileSync(new URL("../public/mc-data/1.17.json", import.meta.url), "utf8"));
assert.ok(!old.items.some((item) => item.name === "copper_ingot"));
assert.ok(newer.items.some((item) => item.name === "copper_ingot"));
assert.ok(!banner.availableBannerPatterns("1.16.5").some(([id]) => id === "flow"));
assert.ok(banner.availableBannerPatterns("1.20.6").some(([id]) => id === "flow"));
assert.match(banner.makeBannerCommand({ version: "1.16.5", target: "banner", base: "black", layers: [{ pattern: "circle", color: "white" }] }), /BlockEntityTag:\{Patterns:/);
assert.match(banner.makeBannerCommand({ version: "1.21.8", target: "shield", base: "black", layers: [{ pattern: "circle", color: "white" }] }), /base_color=black,banner_patterns=/);

const validItems = new Set(["diamond", "stick", "diamond_sword"]);
const input = { version: "1.16.5", title: "Test", description: "A pack", namespace: "pkqa", recipeEnabled: true, recipeName: "sword", recipeType: "shaped", grid: ["diamond", "diamond", "diamond", "", "stick", "", "", "stick", ""], result: "diamond_sword", resultCount: 1, lootEnabled: true, lootName: "gift", rolls: 1, loot: [{ item: "diamond", weight: 3, count: 2 }], validItems };
for (const [version, format, recipeFolder, lootFolder] of [["1.16.5", 6, "recipes", "loot_tables"], ["1.17", 7, "recipes", "loot_tables"], ["1.20.4", 26, "recipes", "loot_tables"], ["1.20.6", 41, "recipes", "loot_tables"], ["1.21.5", 71, "recipe", "loot_table"], ["1.21.8", 81, "recipe", "loot_table"], ["26.1", 101, "recipe", "loot_table"]]) {
  const result = pack.createDataPackFiles({ ...input, version });
  assert.deepEqual(result.errors, []);
  assert.equal(JSON.parse(result.files[0].content).pack.pack_format, format);
  assert.ok(result.files.some((file) => file.name === `data/pkqa/${recipeFolder}/sword.json`));
  assert.ok(result.files.some((file) => file.name === `data/pkqa/${lootFolder}/gift.json`));
  const recipe = JSON.parse(result.files[1].content);
  assert.equal(recipe.type, "minecraft:crafting_shaped");
  assert.deepEqual(recipe.pattern, ["AAA", " B ", " B "]);
  if (give.versionAtLeast(version, "1.21.5")) assert.equal(recipe.key.A, "minecraft:diamond");
  else assert.deepEqual(recipe.key.A, { item: "minecraft:diamond" });
  const bytes = zip.zipFiles(result.files);
  assert.equal(new DataView(bytes.buffer).getUint32(0, true), 0x04034b50);
  assert.equal(new DataView(bytes.buffer).getUint32(bytes.length - 22, true), 0x06054b50);
}
assert.ok(pack.createDataPackFiles({ ...input, version: "1.16.5", result: "mace" }).errors.length);
console.log("MC expanded version, banner, data pack and ZIP fixtures passed.");
