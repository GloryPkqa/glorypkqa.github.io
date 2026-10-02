import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crc32 } from "node:zlib";
import { loadTs } from "./mc-test-runtime.mjs";

const give = loadTs("../src/lib/mc/give.ts");
const { createDataPackFiles } = loadTs("../src/lib/mc/datapack.ts");
const { importGiveForRecipe } = loadTs("../src/lib/mc/give-recipe.ts");
const { coloredParts, defaultTextStyle, textComponent } = loadTs("../src/lib/mc/textColors.ts");
const { makePotionCommand } = loadTs("../src/lib/mc/potion.ts");
const banner = loadTs("../src/lib/mc/banner.ts");
const { zipFiles } = loadTs("../src/lib/mc/zip.ts");
let shapes = 0, itemCommands = 0, potionCases = 0, roundTrips = 0, recipeRecords = 0, bannerCases = 0, colorCases = 0;
const texts = ["", "测试中文 😀", "a'b\"c\\d", "line1\nline2\r\t", "\u0000\b\f\u001f", "literal \\u000a \\n", "{text:[x,y]} § &"];
const decoder = new TextDecoder();
for (const version of give.MC_VERSIONS) {
  const catalog = JSON.parse(readFileSync(new URL(`../public/mc-data/${version}.json`, import.meta.url), "utf8"));
  const validItems = new Set(catalog.items.map((item) => item.name));
  for (const key of ["items", "blocks", "entities", "effects", "enchantments"]) {
    assert.equal(new Set(catalog[key].map((entry) => entry.name)).size, catalog[key].length, `${version} duplicate ${key}`);
  }
  for (const [result, variants] of Object.entries(catalog.recipes)) {
    assert.ok(validItems.has(result), `${version} missing recipe output ${result}`);
    for (const recipe of variants) {
      assert.ok(Number.isInteger(recipe.count) && recipe.count > 0);
      const materials = recipe.shape?.flat() ?? recipe.ingredients;
      assert.ok(materials.some(Boolean));
      assert.ok(materials.every((id) => !id || validItems.has(id)));
      if (recipe.shape) assert.ok(recipe.shape.length <= 3 && recipe.shape.every((row) => row.length <= 3));
      recipeRecords++;
    }
  }
  for (const recipe of catalog.processingRecipes) {
    for (const field of [recipe.result, recipe.ingredient, recipe.base, recipe.addition, recipe.template]) {
      for (const id of field ? Array.isArray(field) ? field : [field] : []) assert.ok(id.startsWith("#") || validItems.has(id.replace(/^minecraft:/, "")), `${version} missing processing item ${id}`);
    }
    recipeRecords++;
  }
  if (["1.20.4", "1.20.6"].includes(version)) {
    for (const id of ["mace", "crafter", "copper_bulb", "breeze_spawn_egg", "heavy_core"]) assert.ok(!validItems.has(id));
    assert.ok(!catalog.effects.some((effect) => effect.name === "wind_charged"));
    assert.ok(!catalog.enchantments.some((entry) => entry.name === "density"));
    assert.ok(!catalog.entities.some((entity) => entity.name === "breeze"));
  }
  if (version === "1.20.6") for (const id of ["armadillo_scute", "wolf_armor", "turtle_scute"]) assert.ok(validItems.has(id));
  for (const mode of ["solid", "gradient", "alternate", "manual"]) for (const text of texts) {
    const parts = coloredParts(text, { ...defaultTextStyle(), mode, overrides: { 1: "#FF0000" } });
    assert.equal(parts.map((part) => part.text).join(""), text);
    assert.ok(parts.every((part) => /^#[a-fA-F0-9]{6}$/.test(part.color)));
    const component = textComponent(parts, version);
    assert.doesNotMatch(component, /[\u0000-\u001f]/);
    if (!give.versionAtLeast(version, "1.21.5")) {
      const parsed = JSON.parse(component), entries = Array.isArray(parsed) ? parsed : [parsed];
      assert.equal(entries.map((entry) => entry.text).join(""), text);
      if (!give.versionAtLeast(version, "1.16")) assert.ok(entries.every((entry) => !entry.color.startsWith("#")));
    }
    colorCases++;
  }
  for (const effect of catalog.effects) for (const level of [-5, 1, 2.5, 128, 256, Infinity, NaN]) {
    const command = makePotionCommand({ version, catalog, target: "@p", hideParticles: true, effects: [{ name: effect.name, level, duration: level }] });
    assert.match(command, /^\/give @p minecraft:potion/);
    assert.doesNotMatch(command, /NaN|Infinity|amplifier:-|Amplifier:-|Duration:-|duration:-/);
    potionCases++;
  }
  if (!give.versionAtLeast(version, "1.16")) continue;
  for (const item of catalog.items) {
    const enchantments = [{ name: catalog.enchantments[0].name, level: 1 }];
    const command = give.makeGiveCommand({ version, item: item.name, count: 1, target: "@p", name: "测试", lore: ["测试描述"], unbreakable: true, enchantments });
    assert.ok(command.startsWith(`/give @p minecraft:${item.name}`));
    assert.doesNotMatch(command, /NaN|undefined|[\n\r]/);
    itemCommands++;
    if (give.versionAtLeast(version, "1.20.5")) for (const text of texts) {
      const imported = importGiveForRecipe(give.makeGiveCommand({ version, item: item.name, count: 2, target: "@p", name: text, lore: [text], unbreakable: true, enchantments }), version);
      const lore = imported.components["minecraft:lore"][0];
      assert.equal(version === "1.20.6" ? JSON.parse(lore).text : lore.text, text);
      if (text) { const name = imported.components["minecraft:custom_name"]; assert.equal(version === "1.20.6" ? JSON.parse(name).text : name.text, text); }
      roundTrips++;
    }
  }
  const base = { version, title: "测试", description: "测试 ZIP", namespace: "pkqa", recipeEnabled: true, recipeName: "test", recipeType: "shaped", result: "diamond", resultCount: 1, lootEnabled: true, lootName: "test", rolls: 1, loot: [{ item: "diamond", weight: 1, count: 2 }], validItems };
  for (let mask = 1; mask < 512; mask++) {
    const grid = Array.from({ length: 9 }, (_, index) => mask & (1 << index) ? index % 2 ? "diamond" : "stick" : "");
    const output = createDataPackFiles({ ...base, grid }); assert.deepEqual(output.errors, []);
    const recipe = JSON.parse(output.files[1].content);
    const decoded = recipe.pattern.map((row) => [...row].map((key) => key === " " ? "" : (typeof recipe.key[key] === "string" ? recipe.key[key] : recipe.key[key].item).replace("minecraft:", "")));
    const occupied = grid.map((id, index) => id ? index : -1).filter((index) => index >= 0);
    const top = Math.min(...occupied.map((index) => Math.floor(index / 3))), bottom = Math.max(...occupied.map((index) => Math.floor(index / 3)));
    const left = Math.min(...occupied.map((index) => index % 3)), right = Math.max(...occupied.map((index) => index % 3));
    assert.deepEqual(decoded, Array.from({ length: bottom - top + 1 }, (_, row) => grid.slice((row + top) * 3 + left, (row + top) * 3 + right + 1)), `${version} mask ${mask}`);
    shapes++;
  }
  const output = createDataPackFiles({ ...base, grid: ["diamond", "", "", "", "stick", "", "", "", "diamond"] });
  const bytes = zipFiles(output.files), view = new DataView(bytes.buffer);
  let offset = 0;
  for (const file of output.files) {
    assert.equal(view.getUint32(offset, true), 0x04034b50);
    const size = view.getUint32(offset + 18, true), length = view.getUint16(offset + 26, true), extra = view.getUint16(offset + 28, true);
    const start = offset + 30 + length + extra, body = bytes.slice(start, start + size);
    assert.equal(decoder.decode(bytes.slice(offset + 30, offset + 30 + length)), file.name);
    assert.equal(decoder.decode(body), file.content);
    assert.equal(crc32(body), view.getUint32(offset + 14, true)); offset = start + size;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50);
  for (const mutation of [{ grid: [] }, { grid: Array(9).fill("") }, { namespace: "../bad" }, { namespace: "." }, { namespace: ".." }, { resultCount: 1.5 }, { result: "missing_item" }, { rolls: 0 }, { loot: [{ item: "diamond", weight: -1, count: 1 }] }]) assert.ok(createDataPackFiles({ ...base, grid: Array(9).fill("diamond"), ...mutation }).errors.length);
  assert.doesNotThrow(() => zipFiles(createDataPackFiles({ ...base, namespace: "my..pack", grid: Array(9).fill("diamond") }).files));
  for (const [pattern] of banner.availableBannerPatterns(version)) for (const color of banner.BANNER_COLORS) for (const target of ["banner", "shield"]) {
    assert.ok(banner.makeBannerCommand({ version, target, base: color.id, layers: [{ pattern, color: color.id }] })); bannerCases++;
  }
}
assert.throws(() => importGiveForRecipe("/give @p diamond[custom_name={text:'one',text:'two'}]", "26.1"), /重复属性/);
assert.throws(() => importGiveForRecipe("/give @p diamond[custom_name={__proto__:{x:1}}]", "26.1"), /不支持的属性/);
for (const name of ["../bad.json", "data/../bad.json", "/bad.json", "C:/bad.json"]) assert.throws(() => zipFiles([{ name, content: "{}" }]), /路径无效/);
console.log(JSON.stringify({ versions: give.MC_VERSIONS.length, shapes, itemCommands, roundTrips, recipeRecords, potionCases, bannerCases, colorCases }, null, 2));
