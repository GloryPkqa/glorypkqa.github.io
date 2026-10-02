import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTs } from "./mc-test-runtime.mjs";
import { mount, respond, flush } from "./mc-interaction-runtime.mjs";

const { MC_VERSIONS, makeGiveCommand, versionAtLeast } = loadTs("../src/lib/mc/give.ts");
const { isMcCatalog } = loadTs("../src/lib/mc/catalog.ts");
const { importGiveForRecipe } = loadTs("../src/lib/mc/give-recipe.ts");
const { characters, coloredParts, defaultTextStyle } = loadTs("../src/lib/mc/textColors.ts");
const catalogs = Object.fromEntries(MC_VERSIONS.map((version) => [version, JSON.parse(readFileSync(new URL(`../public/mc-data/${version}.json`, import.meta.url), "utf8"))]));
const modern = MC_VERSIONS.filter((version) => versionAtLeast(version, "1.20.5"));
const giveVersions = MC_VERSIONS.filter((version) => versionAtLeast(version, "1.16"));
const counts = { catalogMutations: 0, requestTransitions: 0, giveTransitions: 0, potionTransitions: 0, importerCases: 0, unicodeCases: 0, recoveryCases: 0 };

for (const version of MC_VERSIONS) {
  assert.equal(isMcCatalog(catalogs[version], version), true);
  for (const mutation of [null, {}, { ...catalogs[version], version: "wrong" }, { ...catalogs[version], items: {} }, { ...catalogs[version], enchantments: [{}] }, { ...catalogs[version], effects: [null] }, { ...catalogs[version], recipes: { broken: [{ shape: [[]], count: 1 }] } }, { ...catalogs[version], processingRecipes: [{ id: "bad" }] }]) {
    assert.equal(isMcCatalog(mutation, version), false); counts.catalogMutations++;
  }
  const block = mount("BlockTool", { version, catalog: catalogs[version] });
  block.nodes().find((node) => node.props.label === "终点").props.onChange(["100", "100", "100"]);
  assert.match(block.text(), version === "26.1" ? /minecraft:max_block_modifications/ : versionAtLeast(version, "1.19.4") ? /commandModificationBlockLimit/ : /上限固定/);
  counts.recoveryCases++;
}

// Every destination, in both directions. Old requests intentionally ignore abort.
for (const from of MC_VERSIONS) for (const to of MC_VERSIONS) {
  const ui = mount("McWorkbench");
  if (from !== "26.1") { ui.edit(ui.all("select")[0], from); ui.text(); }
  const first = ui.requests.at(-1);
  if (from !== to) {
    ui.edit(ui.all("select")[0], to); ui.text();
    assert.equal(first.signal.aborted, true);
    respond(first, catalogs[from]); await flush(); assert.doesNotMatch(ui.text(), /已载入 Java/);
  }
  const current = ui.requests.at(-1); respond(current, catalogs[to]); await flush();
  assert.match(ui.text(), new RegExp(`已载入 Java ${to.replaceAll(".", "\\.")} 数据`));
  ui.edit(ui.all("select")[0], to); assert.match(ui.text(), /已载入 Java/);
  ui.unmount(); counts.requestTransitions++;
}
for (const data of [null, {}, { ...catalogs["26.1"], version: "1.20.6" }, { ...catalogs["26.1"], items: [{}] }]) {
  const ui = mount("McWorkbench"); respond(ui.requests[0], data); await flush();
  assert.match(ui.text(), /暂时无法加载/);
  ui.button("重新载入").props.onClick(); ui.text(); respond(ui.requests[1], catalogs["26.1"]); await flush();
  assert.match(ui.text(), /已载入 Java 26.1/); ui.unmount(); counts.recoveryCases++;
}
const slow = mount("McWorkbench");
slow.requests[0].signal.addEventListener("abort", () => slow.requests[0].reject(new DOMException("Aborted", "AbortError")));
slow.tick(10000); await flush(); assert.match(slow.text(), /加载超时/);
slow.button("重新载入").props.onClick(); slow.text(); respond(slow.requests[1], catalogs["26.1"]); await flush(); assert.match(slow.text(), /已载入 Java/);
slow.unmount(); counts.recoveryCases++;

for (const from of giveVersions) for (const to of giveVersions) {
  const ui = mount("McWorkbench", { version: from, catalog: catalogs[from] }, { exportName: "GiveTool" });
  const candidate = catalogs[from].enchantments.find((entry) => !catalogs[to].enchantments.some((other) => other.name === entry.name)) ?? catalogs[from].enchantments[0];
  ui.edit(ui.all("select")[0], candidate.name);
  ui.props({ version: to, catalog: null }); assert.equal(ui.button("添加 ＋").props.disabled, true);
  ui.props({ version: to, catalog: catalogs[to] });
  const exists = catalogs[to].enchantments.some((entry) => entry.name === candidate.name);
  assert.equal(ui.button("添加 ＋").props.disabled, !exists);
  if (!exists) { ui.button("添加 ＋").props.onClick(); ui.props({ version: from, catalog: catalogs[from] }); assert.doesNotMatch(ui.commands()[0], new RegExp(`minecraft:${candidate.name}`)); }
  else { ui.button("添加 ＋").props.onClick(); assert.match(ui.commands()[0], new RegExp(`minecraft:${candidate.name}`)); }
  ui.unmount(); counts.giveTransitions++;
}

for (const from of MC_VERSIONS) for (const to of MC_VERSIONS) {
  const ui = mount("EffectTool", { catalog: catalogs[from] });
  ui.edit(ui.all("input").find((node) => node.props.type === "checkbox"), true);
  const exclusive = catalogs[from].effects.find((entry) => !catalogs[to].effects.some((other) => other.name === entry.name));
  if (exclusive) ui.edit(ui.all("select")[0], exclusive.name);
  ui.props({ catalog: null }); assert.equal(ui.commands().length, 0);
  ui.props({ catalog: catalogs[to] }); assert.match(ui.commands()[0], /^\/give @p minecraft:potion/);
  if (exclusive) assert.ok(!ui.commands()[0].includes(`minecraft:${exclusive.name}`));
  ui.props({ catalog: catalogs[from] }); if (exclusive) assert.ok(ui.commands()[0].includes(`minecraft:${exclusive.name}`) || ui.commands()[0].includes(`Id:${exclusive.id}b`));
  ui.unmount(); counts.potionTransitions++;
}

for (const version of modern) {
  const catalog = catalogs[version];
  for (const enchantment of catalog.enchantments) for (const item of ["diamond_sword", "enchanted_book"]) {
    const command = makeGiveCommand({ version, item, count: 2, target: "@p", name: "测试 🌈", lore: ["第一行", "第二行"], unbreakable: true, enchantments: [{ name: enchantment.name, level: 5 }] });
    const parsed = importGiveForRecipe(command, version, catalog);
    const levels = parsed.components[`minecraft:${item === "enchanted_book" ? "stored_enchantments" : "enchantments"}`];
    assert.equal((version === "1.20.6" ? levels.levels : levels)[`minecraft:${enchantment.name}`], 5); counts.importerCases++;
  }
  const enchantments = version === "1.20.6" ? "{levels:{'minecraft:missing':1}}" : "{'minecraft:missing':1}";
  assert.throws(() => importGiveForRecipe(`/give @p diamond[enchantments=${enchantments}]`, version, catalog), /不属于当前版本/); counts.importerCases++;
  for (const value of [{ text: 123 }, { text: "x", color: "bad" }, { text: "x", bold: "bad" }, { text: "x", extra: { text: "wrong" } }, { text: "x", extra: [{ text: 123 }] }, { text: "x", click_event: { action: "run_command" } }, { text: "x", constructor: "bad" }]) {
    const json = JSON.stringify(value);
    const encoded = version === "1.20.6" ? `'${json.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'` : json;
    assert.throws(() => importGiveForRecipe(`/give @p diamond[custom_name=${encoded}]`, version, catalog)); counts.importerCases++;
  }
  for (const count of ["0", "65", "1.5", "-1", "NaN", "9999999999999999999999999"]) { assert.throws(() => importGiveForRecipe(`/give @p diamond ${count}`, version, catalog)); counts.importerCases++; }
  const ui = mount("DataPackTool", { version, catalog });
  ui.edit(ui.all("textarea")[0], `/give @p diamond[enchantments=${enchantments}]`); ui.button("导入 /give").props.onClick(); assert.match(ui.text(), /不属于当前版本/);
  ui.props({ version, catalog: null }); ui.button("导入 /give").props.onClick(); assert.match(ui.text(), /等待当前版本/); counts.recoveryCases += 2;
}

// Persisted selections must track command syntax when moving between versions.
for (const from of MC_VERSIONS) for (const to of MC_VERSIONS) {
  const coordinate = mount("CoordinateTool", { version: from });
  coordinate.props({ version: to });
  assert.equal(coordinate.commands()[0], `/tp ${to === "1.8.9" ? "@p" : "@s"} 100 64 -200`);
  const title = mount("TitleTool", { version: from });
  title.edit(title.all("input")[0], "玩家的 '标题' 🌈"); title.props({ version: to });
  assert.equal(title.commands().length, 3); assert.ok(!title.commands()[2].includes("undefined"));
  coordinate.unmount(); title.unmount(); counts.recoveryCases += 2;
}
const pack = mount("DataPackTool", { version: "26.1", catalog: catalogs["26.1"] });
pack.edit(pack.all("textarea")[0], "/give @p diamond_sword[enchantments={'minecraft:sharpness':5}] 1"); pack.button("导入 /give").props.onClick();
assert.match(pack.text(), /属性已写入/);
pack.props({ version: "1.16.5", catalog: catalogs["1.16.5"] }); assert.doesNotMatch(pack.text(), /属性已写入/); assert.match(pack.text(), /原有属性不会写入/);
pack.props({ version: "26.1", catalog: catalogs["26.1"] }); assert.match(pack.text(), /属性已写入/); counts.recoveryCases += 3;

const pattern = mount("BannerTool", { version: "26.1" });
pattern.button("特殊").props.onClick(); pattern.all("button").find((node) => node.key === "flow").props.onClick(); assert.match(pattern.commands()[0], /minecraft:flow"/);
pattern.props({ version: "1.16.5" }); assert.doesNotMatch(pattern.commands()[0], /minecraft:flow/); assert.match(pattern.text(), /不支持部分图案/);
pattern.props({ version: "26.1" }); assert.match(pattern.commands()[0], /minecraft:flow/); counts.recoveryCases += 3;

for (const [text, expected] of [["👨‍👩‍👧‍👦🇨🇳e\u0301", ["👨‍👩‍👧‍👦", "🇨🇳", "e\u0301"]], ["👍🏽A", ["👍🏽", "A"]], ["中\n文", ["中", "\n", "文"]]]) {
  assert.deepEqual(characters(text), expected);
  for (const mode of ["solid", "gradient", "alternate", "manual"]) {
    const parts = coloredParts(text, { ...defaultTextStyle(), mode }); assert.equal(parts.map((entry) => entry.text).join(""), text);
    assert.ok(parts.every((entry) => expected.some((cluster) => entry.text.includes(cluster)))); counts.unicodeCases++;
  }
}
let painted;
const style = { ...defaultTextStyle(), mode: "manual" };
const controls = mount("TextStyleControls", { text: "ABCDE", label: "文字", style, onChange(value) { painted = value; } });
controls.all("button").find((node) => node.props["aria-label"] === "第 5 字 E").props.onClick({ shiftKey: false });
controls.props({ text: "X", label: "文字", style, onChange(value) { painted = value; } });
controls.all("button").find((node) => node.props["aria-label"] === "应用颜色 #FF5555").props.onClick();
assert.deepEqual(painted.overrides, { 0: "#FF5555" }); counts.recoveryCases++;

const icon = mount("RecipeTool", { id: "diamond", item: { icon: true } }, { exportName: "ItemIcon" });
const oldError = icon.all("img")[0].props.onError; oldError(); assert.equal(icon.all("img").length, 0);
icon.props({ id: "stick", item: { icon: true } }); assert.equal(icon.all("img").length, 1);
oldError(); assert.equal(icon.all("img").length, 1); counts.recoveryCases++;

const player = mount("PlayerLookup");
player.edit(player.all("input")[0], "Notch"); player.tick(0); assert.equal(player.requests.length, 0);
player.submit(); assert.match(player.requests[0].url, /\/Notch$/); player.tick(0); assert.equal(player.requests.length, 1);
respond(player.requests[0], { data: { player: { id: "test", username: "Notch", properties: {} } } }); await flush(); assert.match(player.text(), /数据不完整/);
player.submit(); respond(player.requests[1], { data: { player: { id: "test", username: { invalid: true } } } }); await flush(); assert.match(player.text(), /没有查到/);
player.unmount(); counts.recoveryCases += 3;

for (const data of [null, { latest: { release: { bad: true }, snapshot: "test" }, versions: [] }, { latest: { release: "test", snapshot: "test" }, versions: [null] }, { latest: { release: "test", snapshot: "test" }, versions: [{ id: "test", type: "release", releaseTime: "not a date" }] }]) {
  const ui = mount("VersionFeed"); ui.tick(0); respond(ui.requests[0], data); await flush();
  assert.match(ui.text(), /格式无法识别/); assert.doesNotThrow(() => renderToStaticMarkup(ui.all("section")[0])); ui.unmount(); counts.recoveryCases++;
}
for (const data of [{ online: true, players: { online: { invalid: true } } }, { online: true, motd: { clean: { invalid: true } } }, { online: true, version: { name_clean: ["bad"] } }]) {
  const ui = mount("ServerLookup"); ui.edit(ui.all("input")[0], "example.com"); ui.submit(); respond(ui.requests[0], data); await flush();
  assert.equal(ui.requests.length, 2); respond(ui.requests[1], { online: true, version: "Fallback 1.21", players: { online: 3, max: 20 } }); await flush();
  assert.match(ui.text(), /Fallback 1.21/); assert.doesNotThrow(() => renderToStaticMarkup(ui.all("section")[0])); ui.unmount(); counts.recoveryCases++;
}
const bedrock = mount("ServerLookup"); bedrock.button("Bedrock Edition").props.onClick(); bedrock.edit(bedrock.all("input")[0], "example.com:19132"); bedrock.submit();
// Field names and nullable values follow the provider's Bedrock API docs.
respond(bedrock.requests[0], { online: true, version: { name: "1.19.70" }, players: { online: null, max: null }, port: 19132 }); await flush();
assert.match(bedrock.text(), /1.19.70/); assert.doesNotThrow(() => renderToStaticMarkup(bedrock.all("section")[0])); bedrock.unmount(); counts.recoveryCases++;

Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async () => { throw new Error("Denied"); } } } });
const banner = mount("BannerTool", { version: "26.1" });
await banner.button("复制旗帜").props.onClick(); assert.match(banner.text(), /复制失败/);
navigator.clipboard.writeText = async () => {};
await banner.button("复制旗帜").props.onClick(); assert.match(banner.text(), /已复制/); assert.doesNotMatch(banner.text(), /复制失败/); counts.recoveryCases += 2;

console.log(`Deep MC regression checks passed: ${JSON.stringify(counts)}`);
