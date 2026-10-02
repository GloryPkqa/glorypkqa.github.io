import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./mc-test-runtime.mjs";
import { mount } from "./mc-interaction-runtime.mjs";

const give = loadTs("../src/lib/mc/give.ts");
const { makePotionCommand, maxPotionLevelForVersion } = loadTs("../src/lib/mc/potion.ts", { "@/lib/mc/give": give });
const effects = [{ name: "speed", duration: 60, level: 2 }, { name: "strength", duration: 30, level: 1 }];
function sample(version, selected = effects) {
  const catalog = JSON.parse(readFileSync(new URL(`../public/mc-data/${version}.json`, import.meta.url), "utf8"));
  return makePotionCommand({ version, target: "@p", catalog, hideParticles: true, effects: selected });
}

for (const version of ["1.8.9", "1.12.2"]) {
  assert.match(sample(version), /^\/give @p minecraft:potion 1 0 \{CustomPotionEffects:\[/);
  assert.match(sample(version), /Id:1b,Amplifier:1b,Duration:1200,ShowParticles:0b/);
  assert.match(sample(version), /Id:5b,Amplifier:0b,Duration:600,ShowParticles:0b/);
}
assert.match(sample("1.16.5"), /^\/give @p minecraft:potion\{CustomPotionEffects:/);
assert.match(sample("1.20.4"), /custom_potion_effects:\[\{id:"minecraft:speed",amplifier:1,duration:1200,show_particles:false\}/);
for (const version of ["1.20.6", "1.21.5", "26.1"]) {
  assert.match(sample(version), /minecraft:potion\[potion_contents=\{custom_effects:\[\{id:"minecraft:speed",amplifier:1,duration:1200,show_particles:false\}/);
}
assert.doesNotMatch(sample("1.8.9", [...effects, { name: "darkness", duration: 60, level: 1 }]), /darkness/);
assert.equal(sample("1.8.9", [{ name: "darkness", duration: 60, level: 1 }]), "");
assert.doesNotMatch(sample("1.8.9", [{ name: "speed", duration: 60, level: 256 }]), /Amplifier:255/);
assert.doesNotMatch(sample("26.1", [{ name: "speed", duration: Number.NaN, level: Number.NaN }]), /NaN/);

// Mojang's 1.20.4 PotionUtils/MobEffectInstance loads 128/254/255 as 0;
// MC-118857 is fixed in 1.20.5, separately from the 1.20.2 field rename.
for (const version of give.MC_VERSIONS) {
  const modernComponents = give.versionAtLeast(version, "1.20.5");
  assert.equal(maxPotionLevelForVersion(version), modernComponents ? 256 : 128);
  for (const level of [127, 128, 129, 255, 256]) {
    const expected = Math.min(level - 1, modernComponents ? 255 : 127);
    assert.match(sample(version, [{ name: "speed", duration: 60, level }]), new RegExp(`${give.versionAtLeast(version, "1.20.2") ? "amplifier" : "Amplifier"}:${expected}${give.versionAtLeast(version, "1.20.2") ? "[,}]" : "b"}`));
  }
}

const catalogs = Object.fromEntries(["1.20.4", "1.20.6"].map((version) => [version, JSON.parse(readFileSync(new URL(`../public/mc-data/${version}.json`, import.meta.url), "utf8"))]));
{
  const ui = mount("EffectTool", { catalog: catalogs["1.20.4"] });
  const number = () => ui.all("input").filter((node) => node.props.type === "number");
  ui.edit(number()[1], "256");
  assert.match(ui.commands()[0], /\/effect give @p minecraft:speed 60 255 false$/);
  ui.edit(ui.all("input").find((node) => node.props.type === "checkbox"), true);
  assert.equal(number()[1].props.max, 128);
  for (const requested of [128, 129, 256]) {
    ui.edit(number()[1], String(requested));
    assert.equal(number()[1].props.value, 128);
    assert.match(ui.commands()[0], /amplifier:127[,}]/);
  }
  ui.props({ catalog: catalogs["1.20.6"] });
  assert.equal(number()[1].props.max, 256);
  ui.edit(number()[1], "256");
  assert.match(ui.commands()[0], /amplifier:255[,}]/);
  ui.props({ catalog: catalogs["1.20.4"] });
  assert.equal(number()[1].props.value, 128);
  assert.match(ui.commands()[0], /amplifier:127[,}]/);
  ui.props({ catalog: catalogs["1.20.6"] });
  assert.equal(number()[1].props.value, 256);
  ui.edit(ui.all("input").find((node) => node.props.type === "checkbox"), false);
  ui.props({ catalog: catalogs["1.20.4"] });
  assert.match(ui.commands()[0], /\/effect give @p minecraft:speed 60 255 false$/);
  ui.unmount();
}

console.log("MC potion command fixtures passed for 1.8.9 through 26.1.");
