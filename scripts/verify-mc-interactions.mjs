import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./mc-test-runtime.mjs";
import { mount, flush, respond } from "./mc-interaction-runtime.mjs";

const give = loadTs("../src/lib/mc/give.ts");
let cases = 0;
const workbench = mount("McWorkbench");
respond(workbench.requests[0], JSON.parse(readFileSync(new URL("../public/mc-data/26.1.json", import.meta.url), "utf8"))); await flush();
assert.match(workbench.text(), /已载入 Java 26.1 数据/);
workbench.edit(workbench.all("select")[0], "26.1");
assert.match(workbench.text(), /已载入 Java 26.1 数据/); assert.equal(workbench.requests.length, 1); cases++;
workbench.unmount();
for (const version of give.MC_VERSIONS) {
  const catalog = JSON.parse(readFileSync(new URL(`../public/mc-data/${version}.json`, import.meta.url), "utf8"));
  const coordinate = mount("CoordinateTool", { version });
  assert.match(coordinate.commands()[0], new RegExp(`^/tp ${version === "1.8.9" ? "@p" : "@s"} 100 64 -200$`));
  coordinate.edit(coordinate.all("input")[0], "-1"); assert.match(coordinate.commands()[0], / -1 64 -200$/);
  coordinate.edit(coordinate.all("input")[0], "1e308"); assert.equal(coordinate.commands().length, 0); cases += 3;
  const title = mount("TitleTool", { version });
  assert.equal(title.commands().length, 3);
  title.edit(title.all("input").find((node) => node.props.value === "@a"), "@s");
  assert.equal(title.commands().length, version === "1.8.9" ? 0 : 3); cases += 2;
  const world = mount("WorldTool"); world.button("夜晚").props.onClick(); assert.ok(world.commands().includes("/time set 13000"));
  world.edit(world.all("input")[0], "24000"); assert.ok(!world.commands().some((command) => command.startsWith("/time"))); cases += 2;
  const effect = mount("EffectTool", { catalog }); assert.match(effect.commands()[0], /^\/effect /);
  effect.edit(effect.all("input").find((node) => node.props.type === "checkbox"), true); assert.match(effect.commands()[0], /^\/give @p minecraft:potion/);
  effect.edit(effect.all("input").find((node) => node.props.value === "@p"), "@e"); assert.equal(effect.commands().length, 0); cases += 3;
  const block = mount("BlockTool", { version, catalog }); assert.equal(block.commands().length, 2);
  const start = block.nodes().find((node) => node.props.label === "起点"); start.props.onChange(["0.5", "64", "0"]); assert.equal(block.commands().length, 0);
  start.props.onChange(["0", "64", "0"]); block.edit(block.all("input")[0], "not_a_block"); assert.equal(block.commands().length, 0); cases += 3;
  if (give.versionAtLeast(version, "1.12")) {
    const summon = mount("SummonTool", { version, catalog });
    for (const entity of catalog.entities) { summon.edit(summon.all("input")[0], entity.name); assert.ok(summon.commands()[0].startsWith(`/summon minecraft:${entity.name} `)); cases++; }
    summon.edit(summon.all("input")[0], "missing_entity"); assert.equal(summon.commands().length, 0); cases++;
  }
  if (give.versionAtLeast(version, "1.16")) {
    const recipes = mount("RecipeTool", { version, catalog }); assert.match(recipes.text(), /minecraft:diamond_pickaxe/);
    recipes.edit(recipes.all("input")[0], "zzzz_no_recipe"); assert.match(recipes.text(), /没有收录的工作台配方/); cases += 2;
    const process = mount("ProcessingRecipeTool", { version, catalog });
    for (const station of ["熔炼", "切石", "锻造", "酿造"]) { process.button(station).props.onClick(); assert.ok(process.text().length > 100); cases++; }
    process.edit(process.all("input")[0], "zzzz_no_recipe"); assert.match(process.text(), /没有匹配配方/); cases++;
    const pack = mount("DataPackTool", { version, catalog }); assert.equal(pack.button("ZIP").props.disabled, false);
    pack.edit(pack.all("input").find((node) => node.props.value === "pkqa"), "../invalid"); assert.equal(pack.button("ZIP").props.disabled, true); cases += 2;
  }
}

const server = mount("ServerLookup"); server.submit(); assert.match(server.text(), /请先输入/);
server.edit(server.all("input")[0], "example.com:99999"); server.submit(); assert.equal(server.requests.length, 0); cases += 2;
server.edit(server.all("input")[0], "first.example.com"); server.submit();
server.edit(server.all("input")[0], "second.example.com"); assert.equal(server.requests[0].signal.aborted, true); server.submit();
respond(server.requests[0], { online: true }); await flush(); assert.doesNotMatch(server.text(), /服务器在线/);
respond(server.requests[1], { online: false }); await flush(); assert.match(server.requests[2].url, /api.mcsrvstat.us/);
respond(server.requests[2], { online: true, players: { online: 2, max: 20 }, motd: { clean: ["&lt;Server&gt;"] } }); await flush();
assert.match(server.text(), /second.example.com/); assert.match(server.text(), /<Server>/); cases += 4;
server.button("Bedrock Edition").props.onClick(); server.submit(); assert.match(server.requests[3].url, /\/bedrock\//);
server.requests[3].reject(new Error("network failure")); await flush(); server.requests[4].reject(new Error("network failure")); await flush();
assert.match(server.text(), /两家状态接口暂时无法访问/); assert.equal(server.button("查询服务器").props.disabled, false); cases += 2; server.unmount();

const versions = mount("VersionFeed"); versions.tick(0); assert.equal(versions.requests.length, 1);
versions.requests[0].signal.addEventListener("abort", () => versions.requests[0].reject(new DOMException("Timeout", "AbortError")));
versions.tick(10000); await flush(); assert.match(versions.text(), /查询超时/);
versions.button("刷新").props.onClick(); respond(versions.requests[1], { latest: { release: "test-release", snapshot: "test-snapshot" }, versions: [{ id: "test-release", type: "release", releaseTime: "2026-10-01T00:00:00Z" }] }); await flush();
assert.match(versions.text(), /test-release/); assert.doesNotMatch(versions.text(), /查询超时/); cases += 3; versions.unmount();
console.log(`MC interaction fixtures passed: ${cases} cases across 9 versions, server fallback/cancellation and version refresh recovery.`);
const theme = loadTs("../src/components/ThemeToggle.tsx", { react: { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() } }).default;
globalThis.document = { documentElement: { dataset: { theme: "dark" } } };
let notifications = 0;
globalThis.window = { localStorage: { setItem() { throw new Error("Storage blocked"); } }, dispatchEvent() { notifications++; } };
assert.doesNotThrow(() => theme().props.onClick());
assert.equal(document.documentElement.dataset.theme, "light"); assert.equal(notifications, 1);
console.log("Theme switching passed with browser storage blocked.");
