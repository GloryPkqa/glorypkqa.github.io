import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./mc-test-runtime.mjs";

const give = loadTs("../src/lib/mc/give.ts");
const { makePotionCommand } = loadTs("../src/lib/mc/potion.ts", { "@/lib/mc/give": give });
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

console.log("MC potion command fixtures passed for 1.8.9 through 26.1.");
