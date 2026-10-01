import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/lib/mc/give.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function("exports", compiled)(exports);
const { makeGiveCommand } = exports;

function sample(version, item = "diamond_sword") {
  return makeGiveCommand({ version, item, count: 1, target: "@p", name: "星尘", lore: ["第一行"], unbreakable: true, enchantments: [{ name: "sharpness", level: 5 }] });
}

assert.match(sample("1.20.4"), /diamond_sword\{Enchantments:\[\{id:'minecraft:sharpness',lvl:5s\}\]/);
assert.match(sample("1.16.5"), /diamond_sword\{Enchantments:\[\{id:'minecraft:sharpness',lvl:5s\}\]/);
assert.match(sample("1.17"), /diamond_sword\{Enchantments:\[\{id:'minecraft:sharpness',lvl:5s\}\]/);
assert.match(sample("1.20.4", "enchanted_book"), /StoredEnchantments:/);
assert.match(sample("1.20.6"), /enchantments=\{levels:\{'minecraft:sharpness':5\}\}/);
assert.match(sample("1.20.6"), /custom_name='\{"text":"星尘","italic":false\}'/);
assert.match(sample("1.21.5"), /enchantments=\{'minecraft:sharpness':5\}/);
assert.doesNotMatch(sample("1.21.5"), /levels:/);
assert.match(sample("1.21.5", "enchanted_book"), /stored_enchantments=/);
assert.match(sample("26.1"), /custom_name=\{text:'星尘',italic:false\}/);
assert.equal(makeGiveCommand({ version: "1.21.5", item: "stone", count: 1, target: "@s", name: "", lore: [], unbreakable: false, enchantments: [] }), "/give @s minecraft:stone 1");
assert.match(makeGiveCommand({ version: "1.21.5", item: "stick", count: 1, target: "@p", name: "Traveler's \\ Map", lore: [], unbreakable: false, enchantments: [] }), /custom_name=\{text:'Traveler\\'s \\\\ Map',italic:false\}/);

console.log("MC command fixtures passed for 1.16.5 through 26.1.");
