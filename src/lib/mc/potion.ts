import { versionAtLeast, type McCatalog } from "@/lib/mc/give";

export type PotionEffect = { name: string; duration: number; level: number };

export function makePotionCommand(input: {
  version: string;
  target: string;
  effects: PotionEffect[];
  catalog: McCatalog;
  hideParticles: boolean;
}) {
  const { version, target, catalog, hideParticles } = input;
  const selected = input.effects.map((entry) => ({ ...entry, effect: catalog.effects.find((effect) => effect.name === entry.name) }))
    .filter((entry) => entry.effect);
  if (!selected.length) return "";
  const legacyNumeric = !versionAtLeast(version, "1.20.2");
  const entries = selected.map(({ effect, duration, level }) => {
    const ticks = Math.max(1, Math.min(20_000_000, Math.floor((Number.isFinite(duration) ? duration : 1) * 20)));
    const amplifier = Math.max(0, Math.min(legacyNumeric ? 127 : 255, Math.floor(Number.isFinite(level) ? level : 1) - 1));
    if (legacyNumeric) return `{Id:${effect!.id}b,Amplifier:${amplifier}b,Duration:${ticks},ShowParticles:${hideParticles ? "0b" : "1b"}}`;
    return `{id:"minecraft:${effect!.name}",amplifier:${amplifier},duration:${ticks},show_particles:${!hideParticles}}`;
  });
  if (versionAtLeast(version, "1.20.5")) {
    return `/give ${target} minecraft:potion[potion_contents={custom_effects:[${entries.join(",")}]}] 1`;
  }
  const tag = versionAtLeast(version, "1.20.2") ? "custom_potion_effects" : "CustomPotionEffects";
  if (!versionAtLeast(version, "1.13")) {
    return `/give ${target} minecraft:potion 1 0 {${tag}:[${entries.join(",")}]}`;
  }
  return `/give ${target} minecraft:potion{${tag}:[${entries.join(",")}]} 1`;
}
