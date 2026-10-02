import { versionAtLeast } from "@/lib/mc/give";

export function isBlockInteger(value: number) {
  return Number.isInteger(value) && value >= -2_147_483_648 && value <= 2_147_483_647;
}

export function isWorldHorizontalPosition(point: number[]) {
  const [x, , z] = point;
  return x >= -30_000_000 && x < 30_000_000 && z >= -30_000_000 && z < 30_000_000;
}

export function isSpawnablePosition(point: number[], version: string) {
  if (point.length !== 3 || !point.every(isBlockInteger)) return false;
  const [, y] = point;
  return isWorldHorizontalPosition(point)
    && (!versionAtLeast(version, "1.13") || (y >= -20_000_000 && y < 20_000_000));
}
