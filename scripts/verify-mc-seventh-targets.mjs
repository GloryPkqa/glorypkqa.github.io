import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./mc-test-runtime.mjs";
import { mount } from "./mc-interaction-runtime.mjs";
import { MODERN_TARGET_FIXTURES, TARGET_NATIVE_ORACLE, modernTargetNativeFixtures } from "./mc-target-fixtures.mjs";

const { isCommandTarget, targetErrorHint } = loadTs("../src/lib/mc/target.ts");
const { compoundNbt } = loadTs("../src/lib/mc/targetNbt.ts");
const { importGiveForRecipe } = loadTs("../src/lib/mc/give-recipe.ts");
const modern = ["26.1", "1.21.8", "1.21.5", "1.20.6", "1.20.4", "1.17", "1.16.5"];
const legacy = ["1.12.2", "1.8.9"];
const catalogs = Object.fromEntries([...modern, ...legacy].map((version) => [version, JSON.parse(readFileSync(new URL(`../public/mc-data/${version}.json`, import.meta.url), "utf8"))]));
const counts = { frozenOracle: 0, versionSyntax: 0, importerTargets: 0, visibleTools: 0, supportedLimits: 0 };
function checked(kind, fn) { fn(); counts[kind]++; }

// Frozen expected values came from 1,060 direct official parser calls. They are
// deliberately independent of the validator under test. Repeated positive /
// inverted options, circular rotations, empty fields, maps, quoting, UUID and
// player-only selectors all contain both accepted and rejected controls.
assert.equal(MODERN_TARGET_FIXTURES.length * 2, TARGET_NATIVE_ORACLE.cases);
assert.equal(modernTargetNativeFixtures().filter((row) => row.reject).length, TARGET_NATIVE_ORACLE.rejected);
for (const version of modern) for (const [target, entities, players] of MODERN_TARGET_FIXTURES) {
  checked("frozenOracle", () => assert.equal(isCommandTarget(target, version), entities, `${version} /effect ${target}`));
  checked("frozenOracle", () => assert.equal(isCommandTarget(target, version, { playersOnly: true }), players, `${version} /give ${target}`));
}
for (const version of [...modern, ...legacy]) {
  const isModern = modern.includes(version);
  for (const target of ["@p[r=10]", "@p[rm=1,r=10]", "@a[c=-1]", "@a[l=5,lm=1]", "@p[m=1]", "@a[score_demo_min=1,score_demo=5]", "@a[rxm=-20,rx=20,rym=-180,ry=180]"]) {
    checked("versionSyntax", () => assert.equal(isCommandTarget(target, version), !isModern, `${version}: ${target}`));
  }
  for (const target of ["@p[distance=..10]", "@a[limit=2,sort=nearest]", "@p[level=1..5]", "@p[gamemode=creative]", "@p[scores={demo=1..5}]", "@p[advancements={minecraft:story/root=true}]", "@e[x_rotation=170..-170]"]) {
    checked("versionSyntax", () => assert.equal(isCommandTarget(target, version), isModern, `${version}: ${target}`));
  }
  checked("versionSyntax", () => assert.equal(isCommandTarget("@s", version), version !== "1.8.9"));
  checked("versionSyntax", () => assert.equal(isCommandTarget("@s[x=1,y=2,z=3]", version), version !== "1.8.9"));
  for (const target of ["@x", "@p[name=Alex,,tag=demo]", "@p[distance=1..0]", "@p[sort=nearest,sort=random]", "@p[limit=0]", "@p[limit=1.5]"]) {
    checked("versionSyntax", () => assert.equal(isCommandTarget(target, version), false, `${version}: ${target}`));
  }
  checked("versionSyntax", () => assert.equal(isCommandTarget("@p[tag=abc\n]", version), isModern));
  checked("versionSyntax", () => assert.equal(isCommandTarget("@p[x=1,x=2]", version), !isModern));
  if (isModern) for (const type of ["player", "fishing_bobber"]) {
    checked("versionSyntax", () => assert.equal(isCommandTarget(`@e[type=${type}]`, version), true));
    checked("versionSyntax", () => assert.equal(isCommandTarget(`@e[type=minecraft:${type}]`, version), true));
  }
  if (isModern) for (const type of ["not_a_vanilla_entity", "minecraft:not_a_vanilla_entity", "example:player"]) {
    checked("versionSyntax", () => assert.equal(isCommandTarget(`@e[type=${type}]`, version), false));
  }
}

// Independently reproduced in checksum-pinned 1.16.5 and 26.1 TagParser:
// quoted empty keys are invalid, while a nonempty key with an empty value is valid.
for (const version of modern) for (const [snbt, accepted] of [
  ['{"":1}', false], ["{'':1}", false], ['{outer:{"":1}}', false],
  ['{key:""}', true], ["{'key':''}", true],
]) {
  checked("versionSyntax", () => assert.equal(compoundNbt(snbt, version), accepted, `${version} ${snbt}`));
  checked("versionSyntax", () => assert.equal(isCommandTarget(`@p[nbt=${snbt}]`, version, { playersOnly: true }), accepted, `${version} selector ${snbt}`));
}

const targets = [
  ["@p[distance=..10]", true],
  ['@a[name="Alex, Jr"]', true],
  ["@e[type=player]", true],
  ["@e[gamemode=!creative]", true],
  ["@e[level=1..5]", true],
  ["@e[advancements={minecraft:story/root=true}]", true],
  ["@p[nbt={Foo:{List:[{a:1b},{a:2b}]}}]", true],
  ['@p[nbt={"":1}]', false],
  ["@p[nbt={'':1}]", false],
  ["@p[type=player]", false],
  ["@e[type=player,type=!zombie]", false],
  ["@a[name=Alex,name=!Bob]", false],
  ["@s[limit=1]", false],
  ["@e[type=not_a_vanilla_entity]", false],
  ["@e", false],
  ["d5ebe79d-588c-4cba-b338-f5f27109ec83", false],
];
for (const version of modern) {
  const catalog = catalogs[version];
  if (["26.1", "1.21.8", "1.21.5", "1.20.6"].includes(version)) for (const [target, allowed] of targets) {
    checked("importerTargets", () => {
      const command = `/give ${target} minecraft:diamond 1`;
      if (allowed) assert.equal(importGiveForRecipe(command, version, catalog).item, "diamond");
      else assert.throws(() => importGiveForRecipe(command, version, catalog), /目标|UUID/);
    });
  }
  else checked("importerTargets", () => assert.throws(() => importGiveForRecipe("/give @p minecraft:diamond 1", version, catalog), /不能直接生成带属性/));
  for (const [name, props, options] of [
    ["McWorkbench", { version, catalog }, { exportName: "GiveTool" }],
    ["TitleTool", { version }, {}],
  ]) {
    const ui = mount(name, props, options);
    let previous = name === "TitleTool" ? "@a" : "@p";
    for (const [target, allowed] of targets) {
      const field = ui.all("input").find((node) => node.props.value === previous);
      assert.ok(field, `${name} target field`); ui.edit(field, target);
      previous = target;
      checked("visibleTools", () => assert.equal(ui.commands().length > 0, allowed, `${name} ${version} ${target}`));
    }
    ui.unmount();
  }
  const effects = mount("EffectTool", { catalog });
  const targetInput = () => effects.all("input").find((node) => node.props.value === "@p") ?? effects.all("input").find((node) => ["@e[y_rotation=170..-170]", "@e[type=player]", "d5ebe79d-588c-4cba-b338-f5f27109ec83"].includes(node.props.value));
  effects.edit(targetInput(), "@e[y_rotation=170..-170]");
  checked("visibleTools", () => assert.equal(effects.commands().length, 1));
  effects.edit(effects.all("input").find((node) => node.props.type === "checkbox"), true);
  checked("visibleTools", () => assert.equal(effects.commands().length, 0));
  effects.edit(targetInput(), "@e[type=player]");
  checked("visibleTools", () => assert.equal(effects.commands().length, 1));
  effects.edit(targetInput(), "d5ebe79d-588c-4cba-b338-f5f27109ec83");
  checked("visibleTools", () => assert.equal(effects.commands().length, 0));
  effects.edit(effects.all("input").find((node) => node.props.type === "checkbox"), false);
  checked("visibleTools", () => assert.equal(effects.commands().length, 1)); effects.unmount();
}

// Capability exclusions must be explained, rather than described as Vanilla
// syntax errors or included as an official negative control.
const namedEscape = '@p[nbt={Text:"\\N{LATIN CAPITAL LETTER A}"}]';
checked("supportedLimits", () => { assert.equal(isCommandTarget(namedEscape, "26.1"), false); assert.match(targetErrorHint(namedEscape, "26.1"), /暂不支持|Unicode/); assert.match(targetErrorHint(namedEscape, "26.1"), /\\u|\\U/); });
checked("supportedLimits", () => { assert.equal(isCommandTarget('@p[nbt={Text:"A"}]', "26.1"), true); assert.equal(isCommandTarget('@p[nbt={Text:"\\u0041"}]', "26.1"), true); });
checked("supportedLimits", () => assert.match(targetErrorHint("d5ebe79d-588c-4cba-b338-f5f27109ec83", "26.1", { playersOnly: true }), /不能直接使用 UUID/));
checked("supportedLimits", () => assert.doesNotMatch(targetErrorHint("d5ebe79d-588c-4cba-b338-f5f27109ec83", "26.1"), /不能直接使用 UUID/));
console.log("Seventh-pass selector checks passed:", JSON.stringify(counts), "total", Object.values(counts).reduce((a, b) => a + b, 0), "; fixed official oracle", TARGET_NATIVE_ORACLE.cases);
